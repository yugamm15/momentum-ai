/* global process */
import { createClient } from '@supabase/supabase-js';

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
    const env = getEnv();
    const body = await request.json();
    const sessionId = String(body?.sessionId || '').trim();

    if (!sessionId) {
      return json({ error: 'Missing sessionId.' }, 400);
    }

    const supabase = createClient(env.supabaseUrl, env.supabaseKey);
    const chunkPrefix = `chunks/${sessionId}`;
    const chunkFiles = await listChunkFiles(supabase, chunkPrefix);

    if (chunkFiles.length === 0) {
      return json({ error: 'No uploaded audio chunks were found for this session.' }, 404);
    }

    const chunkBuffers = [];
    for (const path of chunkFiles) {
      chunkBuffers.push(await downloadChunkBuffer(supabase, path));
    }

    const contentType = String(body?.contentType || 'audio/webm').trim() || 'audio/webm';
    const meetingCode = sanitizeMeetingCode(body?.meetingCode);
    const recordingBlob = new Blob(chunkBuffers, { type: contentType });
    const fileName = `momentum_${meetingCode || 'meeting'}_${Date.now()}.webm`;
    const audioFile = new File([recordingBlob], fileName, { type: contentType });

    const storagePath = `raw/${Date.now()}_${sanitizeFileName(fileName)}`;
    const uploadResult = await supabase.storage
      .from('meetings')
      .upload(storagePath, audioFile, {
        contentType,
        upsert: false,
      });

    if (uploadResult.error) {
      throw new Error(uploadResult.error.message || 'Supabase storage rejected the uploaded meeting.');
    }

    const { data: publicUrlData } = supabase.storage.from('meetings').getPublicUrl(storagePath);
    const transcript = await transcribeRecording(audioFile, env.groqKey);
    const analysis = await analyzeTranscript(transcript, env.geminiKey);
    const meeting = await saveMeetingRecord(supabase, {
      title: analysis.title,
      summary: analysis.summary,
      transcript,
      clarity: analysis.clarity_score,
      actionability: analysis.actionability_score,
      audioUrl: publicUrlData.publicUrl,
    });

    if (analysis.tasks.length > 0) {
      await saveTasks(supabase, meeting.id, analysis.tasks);
    }

    await removeChunks(supabase, chunkFiles);

    return json({
      ok: true,
      meetingId: meeting.id,
      meetingTitle: meeting.title,
    });
  } catch (error) {
    return json({ error: error.message || 'Meeting finalization failed.' }, 500);
  }
}

function getEnv() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!supabaseUrl || !supabaseKey || !groqKey || !geminiKey) {
    throw new Error('Server environment variables are incomplete.');
  }

  return { supabaseUrl, supabaseKey, groqKey, geminiKey };
}

async function listChunkFiles(supabase, prefix) {
  const { data, error } = await supabase.storage.from('meetings').list(prefix, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  });

  if (error) {
    throw new Error(error.message || 'Could not list uploaded meeting chunks.');
  }

  return (data || [])
    .filter((item) => item.name)
    .map((item) => `${prefix}/${item.name}`);
}

async function downloadChunkBuffer(supabase, path) {
  const { data, error } = await supabase.storage.from('meetings').download(path);

  if (error || !data) {
    throw new Error(error?.message || `Could not download chunk ${path}.`);
  }

  return await data.arrayBuffer();
}

async function transcribeRecording(file, groqKey) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'json');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Groq could not transcribe the uploaded meeting.'));
  }

  const data = await response.json();
  const transcript = String(data?.text || '').trim();

  if (!transcript) {
    throw new Error('Groq returned an empty transcript.');
  }

  return transcript;
}

async function analyzeTranscript(transcript, geminiKey) {
  const prompt = [
    'You are an expert AI meeting assistant.',
    'Read the transcript and return only JSON with this exact shape:',
    '{',
    '  "title": "Short clear meeting title",',
    '  "summary": "A concise 2-3 sentence summary",',
    '  "actionability_score": 85,',
    '  "clarity_score": 90,',
    '  "tasks": [',
    '    { "title": "Task description", "assignee": "Name or UNCLEAR", "deadline": "Date or Missing" }',
    '  ]',
    '}',
    'Use UNCLEAR when the owner is not explicit.',
    'Use Missing when no deadline is given.',
    'Transcript:',
    transcript,
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
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Gemini could not analyze the meeting transcript.'));
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
  const parsed = JSON.parse(extractJsonObject(rawText));

  return normalizeAnalysis(parsed);
}

async function saveMeetingRecord(supabase, meeting) {
  const { data, error } = await supabase
    .from('meetings')
    .insert({
      title: meeting.title,
      summary: meeting.summary,
      transcript: meeting.transcript,
      clarity: meeting.clarity,
      actionability: meeting.actionability,
      audio_url: meeting.audioUrl,
      status: 'completed',
    })
    .select()
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || 'Supabase rejected the meeting record.');
  }

  return data;
}

async function saveTasks(supabase, meetingId, tasks) {
  const rows = tasks.map((task) => {
    const assignee = sanitizeField(task.assignee, 'UNCLEAR');
    const deadline = sanitizeField(task.deadline, 'Missing');
    const hasAmbiguity = assignee === 'UNCLEAR' || deadline === 'Missing';

    return {
      meeting_id: meetingId,
      title: sanitizeField(task.title, 'Follow up on discussion'),
      assignee,
      deadline,
      status: hasAmbiguity ? 'needs-review' : 'todo',
    };
  });

  const { error } = await supabase.from('tasks').insert(rows);

  if (error) {
    throw new Error(error.message || 'Supabase rejected the extracted tasks.');
  }
}

async function removeChunks(supabase, paths) {
  if (!paths.length) {
    return;
  }

  await supabase.storage.from('meetings').remove(paths);
}

function normalizeAnalysis(analysis) {
  const tasks = Array.isArray(analysis?.tasks) ? analysis.tasks : [];

  return {
    title: sanitizeField(analysis?.title, 'Meeting Summary'),
    summary: sanitizeField(analysis?.summary, 'Transcript processed successfully.'),
    clarity_score: clampScore(analysis?.clarity_score ?? analysis?.clarity),
    actionability_score: clampScore(analysis?.actionability_score ?? analysis?.actionability),
    tasks: tasks
      .map((task) => ({
        title: sanitizeField(task?.title, ''),
        assignee: sanitizeField(task?.assignee, 'UNCLEAR'),
        deadline: sanitizeField(task?.deadline, 'Missing'),
      }))
      .filter((task) => task.title),
  };
}

function extractJsonObject(text) {
  const cleaned = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Gemini returned invalid JSON.');
  }

  return cleaned.slice(start, end + 1);
}

function clampScore(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(number)));
}

function sanitizeField(value, fallback) {
  const text = String(value || '').trim();
  return text || fallback;
}

function sanitizeMeetingCode(value) {
  return String(value || '').trim().replace(/[^a-z0-9-]/gi, '').slice(0, 32);
}

function sanitizeFileName(fileName) {
  return String(fileName || 'meeting.webm').replace(/[^a-zA-Z0-9._-]/g, '_');
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
