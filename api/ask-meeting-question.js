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
const answerStopWords = new Set([
  'what',
  'when',
  'where',
  'which',
  'would',
  'could',
  'should',
  'about',
  'into',
  'just',
  'your',
  'their',
  'there',
  'here',
  'from',
  'with',
  'that',
  'this',
  'have',
  'were',
  'been',
  'they',
  'them',
  'does',
  'did',
  'than',
  'will',
  'shall',
  'might',
  'need',
  'needs',
  'meeting',
  'transcript',
  'momentum',
]);

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
      meeting,
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

async function answerQuestionFromTranscript({ meeting, transcript, summary, question, geminiKey }) {
  const transcriptSegments = normalizeEvidenceSegments(meeting, transcript);
  let answerText = '';

  try {
    answerText = await generateMeetingAnswer({ transcript, summary, question, geminiKey });
  } catch {
    answerText = '';
  }

  if (!answerText) {
    answerText = buildFallbackAnswer({ transcript, summary, question });
  }

  const evidence = buildEvidenceSnippets(transcriptSegments, `${question}\n${answerText}`);
  const support = classifyAnswerSupport(evidence, answerText);

  if (support === 'not_supported') {
    return buildUnsupportedAnswer();
  }

  return {
    text: answerText,
    support,
    note:
      support === 'grounded'
        ? 'Supported by transcript evidence.'
        : 'Momentum found partial support in the transcript. Review the snippets before relying on this answer.',
    evidence: evidence.map((entry) => ({
      id: entry.id,
      speaker: entry.speaker,
      time: entry.time,
      text: entry.text,
    })),
  };
}

async function generateMeetingAnswer({ transcript, summary, question, geminiKey }) {
  const prompt = [
    'You answer questions about a single meeting.',
    'Use only the transcript and summary below.',
    'If the transcript does not clearly support an answer, reply exactly: "The transcript does not clearly support an answer to that question."',
    'Keep the answer brief, concrete, and operational.',
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

function buildUnsupportedAnswer() {
  return {
    text: 'The transcript does not clearly support an answer to that question.',
    support: 'not_supported',
    note: 'Try asking about a named person, a follow-up, a deadline, or a specific decision.',
    evidence: [],
  };
}

function normalizeEvidenceSegments(meeting, transcript) {
  const directSegments = Array.isArray(meeting?.transcript) ? meeting.transcript : [];
  if (directSegments.length > 0) {
    return directSegments
      .map((segment, index) => ({
        id: segment?.id || `segment-${index + 1}`,
        speaker: String(segment?.speaker || segment?.speakerLabel || '').trim(),
        time: String(segment?.time || '').trim(),
        text: String(segment?.text || '').trim(),
      }))
      .filter((segment) => segment.text);
  }

  return String(transcript || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((text, index) => ({
      id: `segment-${index + 1}`,
      speaker: '',
      time: '',
      text: String(text || '').trim(),
    }))
    .filter((segment) => segment.text);
}

function buildEvidenceSnippets(segments, queryText) {
  const terms = extractAnswerTerms(queryText);

  return (Array.isArray(segments) ? segments : [])
    .map((segment) => ({
      ...segment,
      score: scoreEvidenceSegment(segment.text, terms),
    }))
    .filter((segment) => segment.score >= 2)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
}

function extractAnswerTerms(value) {
  return Array.from(
    new Set(
      String(value || '')
        .toLowerCase()
        .match(/[a-z0-9]{4,}/g) || []
    )
  )
    .filter((term) => !answerStopWords.has(term))
    .slice(0, 14);
}

function scoreEvidenceSegment(text, terms) {
  if (!terms.length) {
    return 0;
  }

  const normalizedText = String(text || '').toLowerCase();
  let matches = 0;

  terms.forEach((term) => {
    if (normalizedText.includes(term)) {
      matches += 1;
    }
  });

  if (matches === 0) {
    return 0;
  }

  return matches + Math.min(2, Math.floor(normalizedText.length / 140));
}

function classifyAnswerSupport(evidence, answerText) {
  const normalizedAnswer = String(answerText || '').trim().toLowerCase();

  if (!evidence.length || normalizedAnswer === 'the transcript does not clearly support an answer to that question.') {
    return 'not_supported';
  }

  if (evidence.length >= 2 && evidence[0]?.score >= 3) {
    return 'grounded';
  }

  return 'partial';
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
