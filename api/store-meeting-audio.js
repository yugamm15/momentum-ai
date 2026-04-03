/* global process */
import { Buffer } from 'node:buffer';
import { createClient } from '@supabase/supabase-js';

const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'meetings';

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
    const formData = await request.formData();
    const audioFile = formData.get('file');
    const meetingCode = sanitizeMeetingCode(formData.get('meetingCode'));
    const meetingUrl = String(formData.get('meetingUrl') || '').trim();
    const sessionId = sanitizeSessionId(formData.get('sessionId'));
    const contentType =
      String(formData.get('contentType') || audioFile?.type || 'audio/webm').trim() || 'audio/webm';

    if (!(audioFile instanceof Blob) || audioFile.size === 0) {
      return json({ error: 'Missing meeting audio file.' }, 400);
    }

    const supabase = createClient(env.supabaseUrl, env.supabaseKey);
    const normalizedFile = await normalizeInputFile(audioFile, contentType, meetingCode);
    const storageResult = await persistAudioArtifact(supabase, normalizedFile, contentType, meetingCode, env.storageBucket);
    const meetingPayload = buildMeetingPayload({
      meetingCode,
      meetingUrl,
      sessionId,
      audioUrl: storageResult.audioUrl,
      contentType,
      bytes: normalizedFile.size,
    });

    const meeting = await upsertMeetingRow(supabase, sessionId, meetingPayload);

    return json({
      ok: true,
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      audioStored: Boolean(meeting.audio_url),
      storageMode: storageResult.mode,
    });
  } catch (error) {
    return json({ error: error.message || 'Meeting audio could not be stored.' }, 500);
  }
}

function getEnv() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Server environment variables are incomplete.');
  }

  return {
    supabaseUrl,
    supabaseKey,
    storageBucket: STORAGE_BUCKET,
  };
}

async function normalizeInputFile(file, contentType, meetingCode) {
  if (file instanceof File) {
    return file;
  }

  const safeMeetingCode = meetingCode || 'meeting';
  const type = String(contentType || file.type || 'audio/webm').trim() || 'audio/webm';
  const extension = getFileExtension(type);
  const blob = file instanceof Blob ? file : new Blob([file], { type });
  return new File([blob], `momentum_${safeMeetingCode}_${Date.now()}.${extension}`, { type });
}

async function persistAudioArtifact(supabase, file, contentType, meetingCode, bucketName) {
  const bucketUrl = await tryUploadRecordingToStorage(supabase, file, contentType, meetingCode, bucketName);
  if (bucketUrl) {
    return {
      audioUrl: bucketUrl,
      mode: 'bucket',
    };
  }

  return {
    audioUrl: await blobToDataUrl(file, contentType),
    mode: 'inline',
  };
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

function buildMeetingPayload({ meetingCode, meetingUrl, sessionId, audioUrl, contentType, bytes }) {
  const readableCode = meetingCode || 'meet-session';
  const recordedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Calcutta' });
  const title = `Audio captured for ${readableCode}`;
  const summary = [
    'Raw meeting audio was saved by Momentum.',
    'AI transcription and analysis can run later.',
    meetingUrl ? `Source: ${meetingUrl}` : null,
    `Format: ${contentType}. Size: ${Math.max(1, Math.round(bytes / 1024))} KB.`,
    sessionId ? `Session: ${sessionId}.` : null,
    `Captured at: ${recordedAt}.`,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    title,
    summary,
    transcript: null,
    clarity: 0,
    actionability: 0,
    audio_url: audioUrl,
    status: buildSessionStatus(sessionId),
  };
}

async function upsertMeetingRow(supabase, sessionId, payload) {
  const existing = sessionId ? await findExistingMeeting(supabase, sessionId) : null;

  if (existing?.id) {
    const { data, error } = await supabase
      .from('meetings')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();

    if (error || !data?.id) {
      throw new Error(error?.message || 'Supabase could not update the raw audio meeting row.');
    }

    return data;
  }

  const { data, error } = await supabase
    .from('meetings')
    .insert(payload)
    .select()
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || 'Supabase rejected the raw audio meeting row.');
  }

  return data;
}

async function findExistingMeeting(supabase, sessionId) {
  const { data, error } = await supabase
    .from('meetings')
    .select('id')
    .eq('status', buildSessionStatus(sessionId))
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    return null;
  }

  return data?.[0] || null;
}

async function blobToDataUrl(blob, contentType) {
  const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64');
  return `data:${contentType || blob.type || 'audio/webm'};base64,${base64}`;
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

function sanitizeMeetingCode(value) {
  return String(value || '').trim().replace(/[^a-z0-9-]/gi, '').slice(0, 32);
}

function sanitizeSessionId(value) {
  const text = String(value || '').trim();
  return /^[a-zA-Z0-9_-]{8,128}$/.test(text) ? text : '';
}

function buildSessionStatus(sessionId) {
  return sessionId ? `audio-uploaded:${sessionId}` : 'audio-uploaded';
}

function sanitizeFileName(fileName) {
  return String(fileName || 'meeting.webm').replace(/[^a-zA-Z0-9._-]/g, '_');
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
