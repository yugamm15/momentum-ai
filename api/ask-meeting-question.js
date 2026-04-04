import {
  buildFallbackAnalysis,
  createSupabaseClient,
  getEnv,
} from './_lib/meeting-processing.js';
import { getUnifiedWorkspaceSnapshot } from './_lib/unified-workspace.js';
import { resolveRequestWorkspaceContext } from './_lib/request-auth.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request) {
  try {
    const env = getEnv({ requireGroq: false, requireGemini: false });
    const body = await request.json();
    const meetingId = String(body?.meetingId || '').trim();
    const question = String(body?.question || '').trim();

    if (!meetingId) {
      return json({ error: 'Missing meetingId.' }, 400);
    }

    if (!question) {
      return json({ error: 'Missing question.' }, 400);
    }

    const supabase = createSupabaseClient(env);
    const workspaceContext = await resolveRequestWorkspaceContext(request, supabase, {
      allowAnonymous: true,
    }).catch(() => null);
    const snapshot = await getUnifiedWorkspaceSnapshot(supabase, {
      workspaceId: workspaceContext?.workspaceId || null,
      profileId: workspaceContext?.profileId || null,
    });
    const meeting = snapshot.meetings.find((item) => item.id === meetingId);

    if (!meeting?.id) {
      return json({ error: 'Meeting not found.' }, 404);
    }

    const transcript = String(meeting.transcriptText || '').trim() ||
      (Array.isArray(meeting.transcript) ? meeting.transcript.map((segment) => segment.text).join(' ') : '');

    if (!String(transcript || '').trim()) {
      return json({ error: 'This meeting does not have a transcript yet.' }, 400);
    }

    const answer = await answerQuestionFromTranscript({
      transcript,
      summary: meeting.summaryParagraph,
      question,
      geminiKey: env.geminiKey,
    });

    return json({ ok: true, answer });
  } catch (error) {
    return json({ error: error.message || 'Meeting Q&A failed.' }, 500);
  }
}

async function answerQuestionFromTranscript({ transcript, summary, question, geminiKey }) {
  try {
    const prompt = [
      'You answer questions about a single meeting.',
      'Use only the transcript and summary below.',
      'If the answer is not supported by the transcript, say that clearly.',
      '',
      `Summary: ${String(summary || '').trim() || 'No summary available.'}`,
      '',
      'Transcript:',
      transcript,
      '',
      `Question: ${question}`,
    ].join('\n');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Gemini could not answer the meeting question.'));
    }

    const data = await response.json();
    const answer = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();

    if (!answer) {
      throw new Error('Gemini returned an empty meeting answer.');
    }

    return answer;
  } catch {
    return buildFallbackAnswer({ transcript, summary, question });
  }
}

function buildFallbackAnswer({ transcript, summary, question }) {
  const sentences = String(transcript || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const keywords = String(question || '')
    .toLowerCase()
    .match(/[a-z0-9]{3,}/g) || [];

  const rankedSentences = sentences
    .map((sentence) => ({
      sentence,
      score: keywords.reduce(
        (total, keyword) => total + (sentence.toLowerCase().includes(keyword) ? 1 : 0),
        0
      ),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  if (rankedSentences.length > 0) {
    const answer = rankedSentences
      .slice(0, 3)
      .map((entry) => entry.sentence)
      .join(' ');

    if (answer.trim().length >= 20) {
      return answer;
    }

    const fallbackAnalysis = buildFallbackAnalysis(transcript);
    return fallbackAnalysis.summary;
  }

  const fallbackAnalysis = buildFallbackAnalysis(transcript);
  if (keywords.some((keyword) => ['task', 'owner', 'deadline', 'action'].includes(keyword))) {
    if (fallbackAnalysis.tasks.length === 0) {
      return 'The transcript does not contain a clearly extractable task for that question.';
    }

    return fallbackAnalysis.tasks
      .slice(0, 3)
      .map(
        (task) =>
          `${task.title} Owner: ${task.assignee}. Deadline: ${task.deadline}.`
      )
      .join(' ');
  }

  const normalizedSummary = String(summary || '').trim();
  return looksLowSignalText(normalizedSummary) ? fallbackAnalysis.summary : normalizedSummary;
}

async function readErrorMessage(response, fallback) {
  const text = await response.text().catch(() => '');

  if (!text) {
    return fallback;
  }

  try {
    const data = JSON.parse(text);
    return data?.error?.message || data?.message || data?.error_description || fallback;
  } catch {
    return text.slice(0, 200);
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function looksLowSignalText(text) {
  const words = String(text || '')
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];

  return words.length < 6 || new Set(words).size < 3;
}
