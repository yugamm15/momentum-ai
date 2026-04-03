/* global process */
import { createClient } from '@supabase/supabase-js';

const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'meetings';

export function getEnv(options = {}) {
  const requireGroq = options.requireGroq !== false;
  const requireGemini = options.requireGemini !== false;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (
    !supabaseUrl ||
    !supabaseKey ||
    (requireGroq && !groqKey) ||
    (requireGemini && !geminiKey)
  ) {
    throw new Error('Server environment variables are incomplete.');
  }

  return {
    supabaseUrl,
    supabaseKey,
    groqKey,
    geminiKey,
    storageBucket: STORAGE_BUCKET,
  };
}

export function createSupabaseClient(env) {
  return createClient(env.supabaseUrl, env.supabaseKey);
}

export async function processMeetingAudio({
  file,
  meetingCode,
  contentType,
  supabase,
  env,
  existingMeetingId = '',
  existingAudioUrl = null,
}) {
  const normalizedFile = await normalizeInputFile(file, contentType, meetingCode);
  const transcript = await transcribeRecording(normalizedFile, env.groqKey);
  const analysis = await analyzeTranscript(transcript, env.geminiKey);
  const audioUrl = await tryUploadRecordingToStorage(
    supabase,
    normalizedFile,
    normalizedFile.type || contentType || 'audio/webm',
    sanitizeMeetingCode(meetingCode),
    env.storageBucket
  );

  const meeting = await saveMeetingRecord(supabase, {
    title: analysis.title,
    summary: analysis.summary,
    transcript,
    clarity: analysis.clarity_score,
    actionability: analysis.actionability_score,
    audioUrl,
  }, {
    existingMeetingId,
    existingAudioUrl,
  });

  await replaceMeetingTasks(supabase, meeting.id, analysis.tasks);

  return {
    meeting,
    transcript,
    analysis,
    audioUrl,
  };
}

async function normalizeInputFile(file, contentType, meetingCode) {
  if (!file) {
    throw new Error('Missing meeting audio file.');
  }

  if (file instanceof File) {
    return file;
  }

  const safeMeetingCode = sanitizeMeetingCode(meetingCode) || 'meeting';
  const type = String(contentType || file.type || 'audio/webm').trim() || 'audio/webm';
  const extension = getFileExtension(type);
  const name = `momentum_${safeMeetingCode}_${Date.now()}.${extension}`;
  const blob = file instanceof Blob ? file : new Blob([file], { type });
  return new File([blob], name, { type });
}

function getFileExtension(contentType) {
  const normalized = String(contentType || '').toLowerCase();

  if (normalized.includes('wav')) {
    return 'wav';
  }

  if (normalized.includes('mp3') || normalized.includes('mpeg')) {
    return 'mp3';
  }

  if (normalized.includes('m4a') || normalized.includes('mp4')) {
    return 'm4a';
  }

  return 'webm';
}

async function tryUploadRecordingToStorage(supabase, file, contentType, meetingCode, bucketName) {
  if (!bucketName) {
    return null;
  }

  try {
    const safeMeetingCode = meetingCode || 'meeting';
    const storagePath = `raw/${Date.now()}_${sanitizeFileName(file.name || `momentum_${safeMeetingCode}.webm`)}`;

    const uploadResult = await supabase.storage.from(bucketName).upload(storagePath, file, {
      contentType,
      upsert: false,
    });

    if (uploadResult.error) {
      return null;
    }

    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
    return publicUrlData?.publicUrl || null;
  } catch {
    return null;
  }
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

async function saveMeetingRecord(supabase, meeting, options = {}) {
  const existingMeetingId = String(options?.existingMeetingId || '').trim();

  if (existingMeetingId) {
    const { data: existingMeeting, error: existingError } = await supabase
      .from('meetings')
      .select('id, audio_url')
      .eq('id', existingMeetingId)
      .single();

    if (existingError || !existingMeeting?.id) {
      throw new Error(existingError?.message || 'Momentum could not find the stored meeting row to update.');
    }

    const { data, error } = await supabase
      .from('meetings')
      .update({
        title: meeting.title,
        summary: meeting.summary,
        transcript: meeting.transcript,
        clarity: meeting.clarity,
        actionability: meeting.actionability,
        audio_url: meeting.audioUrl || existingMeeting.audio_url || options?.existingAudioUrl || null,
        status: 'completed',
      })
      .eq('id', existingMeetingId)
      .select()
      .single();

    if (error || !data?.id) {
      throw new Error(error?.message || 'Supabase could not update the existing meeting record.');
    }

    return data;
  }

  const placeholder = await findPlaceholderMeeting(supabase);

  if (placeholder?.id) {
    const { data, error } = await supabase
      .from('meetings')
      .update({
        title: meeting.title,
        summary: meeting.summary,
        transcript: meeting.transcript,
        clarity: meeting.clarity,
        actionability: meeting.actionability,
        audio_url: meeting.audioUrl,
        status: 'completed',
      })
      .eq('id', placeholder.id)
      .select()
      .single();

    if (error || !data?.id) {
      throw new Error(error?.message || 'Supabase could not update the processing meeting row.');
    }

    await cleanupBlankProcessingRows(supabase, data.id);
    return data;
  }

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

  await cleanupBlankProcessingRows(supabase, data.id);
  return data;
}

async function replaceMeetingTasks(supabase, meetingId, tasks) {
  const { error: deleteError } = await supabase.from('tasks').delete().eq('meeting_id', meetingId);

  if (deleteError) {
    throw new Error(deleteError.message || 'Supabase could not replace the extracted tasks.');
  }

  if (!tasks.length) {
    return;
  }

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

async function findPlaceholderMeeting(supabase) {
  const threshold = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('meetings')
    .select('id, created_at')
    .eq('status', 'processing')
    .is('title', null)
    .is('summary', null)
    .is('transcript', null)
    .is('audio_url', null)
    .gte('created_at', threshold)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    return null;
  }

  return data?.[0] || null;
}

async function cleanupBlankProcessingRows(supabase, keepId) {
  const threshold = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('meetings')
    .select('id')
    .eq('status', 'processing')
    .is('title', null)
    .is('summary', null)
    .is('transcript', null)
    .is('audio_url', null)
    .gte('created_at', threshold);

  if (error || !data?.length) {
    return;
  }

  const idsToDelete = data.map((row) => row.id).filter((id) => id !== keepId);
  if (!idsToDelete.length) {
    return;
  }

  await supabase.from('meetings').delete().in('id', idsToDelete);
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
