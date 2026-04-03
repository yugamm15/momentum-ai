import {
  createSupabaseClient,
  getEnv,
} from './_lib/meeting-processing.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request) {
  try {
    const env = getEnv({ requireGroq: false });
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
    const { data: meeting, error } = await supabase
      .from('meetings')
      .select('id, title, transcript, summary')
      .eq('id', meetingId)
      .single();

    if (error || !meeting?.id) {
      return json({ error: error?.message || 'Meeting not found.' }, 404);
    }

    if (!String(meeting.transcript || '').trim()) {
      return json({ error: 'This meeting does not have a transcript yet.' }, 400);
    }

    const answer = await answerQuestionFromTranscript({
      transcript: meeting.transcript,
      summary: meeting.summary,
      question,
      geminiKey: env.geminiKey,
    });

    return json({ ok: true, answer });
  } catch (error) {
    return json({ error: error.message || 'Meeting Q&A failed.' }, 500);
  }
}

async function answerQuestionFromTranscript({ transcript, summary, question, geminiKey }) {
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
