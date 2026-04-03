/* global process */
import { Buffer } from 'node:buffer';

const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'meetings';
const RAW_UPLOAD_STATUS_PREFIX = 'raw-uploaded:';
const LEGACY_RAW_UPLOAD_STATUS_PREFIX = 'audio-uploaded:';

export function isRawUploadStatus(status) {
  const value = String(status || '').trim();
  return value.startsWith(RAW_UPLOAD_STATUS_PREFIX) || value.startsWith(LEGACY_RAW_UPLOAD_STATUS_PREFIX);
}

export function buildRawUploadStatus(sessionId) {
  return sessionId ? `${RAW_UPLOAD_STATUS_PREFIX}${sessionId}` : RAW_UPLOAD_STATUS_PREFIX.slice(0, -1);
}

export async function storeRawMeetingAudio({
  supabase,
  file,
  contentType,
  meetingCode,
  meetingUrl,
  sessionId,
  bucketName = STORAGE_BUCKET,
}) {
  const normalizedFile = await normalizeInputFile(file, contentType, meetingCode);
  const storage = await uploadRecordingToStorage(supabase, normalizedFile, normalizedFile.type, meetingCode, bucketName);
  const payload = buildRawMeetingPayload({
    meetingCode,
    meetingUrl,
    sessionId,
    audioUrl: storage.audioUrl,
    contentType: normalizedFile.type,
    bytes: normalizedFile.size,
  });
  const meeting = await upsertRawMeetingRow(supabase, sessionId, payload);

  return {
    meeting,
    audioUrl: storage.audioUrl,
    analysisComplete: false,
    storageMode: storage.mode,
    detail: 'Raw meeting audio is safely stored. Finish AI analysis from the dashboard when the processing pipeline is ready.',
  };
}

export async function downloadMeetingAudioFile(meeting) {
  const audioUrl = String(meeting?.audio_url || '').trim();
  if (!audioUrl) {
    throw new Error('This meeting does not have a saved audio file to analyze.');
  }

  const fileName = buildMeetingFileName(meeting);

  if (audioUrl.startsWith('data:')) {
    const { contentType, buffer } = parseDataUrl(audioUrl);
    return new File([buffer], fileName, {
      type: contentType || inferContentTypeFromMeeting(meeting),
    });
  }

  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Momentum could not download the stored audio (${response.status}).`);
  }

  const blob = await response.blob();
  const contentType =
    blob.type ||
    response.headers.get('content-type') ||
    inferContentTypeFromMeeting(meeting);

  return new File([blob], fileName, { type: contentType || 'audio/webm' });
}

export function inferMeetingCode(meeting) {
  const sourceMatch = String(meeting?.summary || '').match(/https:\/\/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  if (sourceMatch) {
    return sanitizeMeetingCode(sourceMatch[1]);
  }

  const titleMatch = String(meeting?.title || '').match(/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  if (titleMatch) {
    return sanitizeMeetingCode(titleMatch[1]);
  }

  return '';
}

function buildRawMeetingPayload({ meetingCode, meetingUrl, sessionId, audioUrl, contentType, bytes }) {
  const readableCode = sanitizeMeetingCode(meetingCode) || 'meet-session';
  const recordedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Calcutta' });

  return {
    title: `Audio captured for ${readableCode}`,
    summary: [
      'Raw meeting audio was saved by Momentum.',
      'AI transcription and analysis are pending.',
      meetingUrl ? `Source: ${meetingUrl}` : null,
      `Format: ${contentType}. Size: ${Math.max(1, Math.round(bytes / 1024))} KB.`,
      sessionId ? `Session: ${sessionId}.` : null,
      `Captured at: ${recordedAt}.`,
    ]
      .filter(Boolean)
      .join(' '),
    transcript: null,
    clarity: 0,
    actionability: 0,
    audio_url: audioUrl,
    status: buildRawUploadStatus(sessionId),
  };
}

async function upsertRawMeetingRow(supabase, sessionId, payload) {
  const existing = sessionId ? await findExistingRawMeeting(supabase, sessionId) : null;

  if (existing?.id) {
    const { data, error } = await supabase
      .from('meetings')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();

    if (error || !data?.id) {
      throw new Error(error?.message || 'Supabase could not update the stored raw meeting row.');
    }

    return data;
  }

  const { data, error } = await supabase
    .from('meetings')
    .insert(payload)
    .select()
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || 'Supabase rejected the raw meeting row.');
  }

  return data;
}

async function findExistingRawMeeting(supabase, sessionId) {
  const statuses = [
    buildRawUploadStatus(sessionId),
    sessionId ? `${LEGACY_RAW_UPLOAD_STATUS_PREFIX}${sessionId}` : LEGACY_RAW_UPLOAD_STATUS_PREFIX.slice(0, -1),
  ];

  const { data, error } = await supabase
    .from('meetings')
    .select('id')
    .in('status', statuses)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    return null;
  }

  return data?.[0] || null;
}

async function uploadRecordingToStorage(supabase, file, contentType, meetingCode, bucketName) {
  if (!bucketName) {
    throw new Error('Supabase Storage is not configured for raw meeting uploads.');
  }

  const safeMeetingCode = sanitizeMeetingCode(meetingCode) || 'meeting';
  const storagePath = `raw/${Date.now()}_${sanitizeFileName(file.name || `momentum_${safeMeetingCode}.webm`)}`;
  const uploadResult = await supabase.storage.from(bucketName).upload(storagePath, file, {
    contentType,
    upsert: false,
  });

  if (uploadResult.error) {
    throw new Error(describeStorageError(uploadResult.error.message, bucketName));
  }

  const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
  const audioUrl = publicUrlData?.publicUrl || '';

  if (!audioUrl) {
    throw new Error('Supabase Storage did not return a public audio URL.');
  }

  return {
    audioUrl,
    mode: 'bucket',
  };
}

function normalizeInputFile(file, contentType, meetingCode) {
  if (!file) {
    throw new Error('Missing meeting audio file.');
  }

  if (file instanceof File) {
    return Promise.resolve(file);
  }

  const safeMeetingCode = sanitizeMeetingCode(meetingCode) || 'meeting';
  const type = String(contentType || file.type || 'audio/webm').trim() || 'audio/webm';
  const extension = getFileExtension(type);
  const name = `momentum_${safeMeetingCode}_${Date.now()}.${extension}`;
  const blob = file instanceof Blob ? file : new Blob([file], { type });
  return Promise.resolve(new File([blob], name, { type }));
}

function buildMeetingFileName(meeting) {
  const code = inferMeetingCode(meeting) || 'meeting';
  const contentType = inferContentTypeFromMeeting(meeting);
  return `momentum_${code}.${getFileExtension(contentType)}`;
}

function inferContentTypeFromMeeting(meeting) {
  const summaryMatch = String(meeting?.summary || '').match(/Format:\s([^.\s]+(?:;[^.\s]+)?)/i);
  if (summaryMatch) {
    return summaryMatch[1];
  }

  return 'audio/webm';
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/s);
  if (!match) {
    throw new Error('Stored audio data is invalid.');
  }

  const contentType = match[1] || 'audio/webm';
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || '';
  const buffer = isBase64
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');

  return {
    contentType,
    buffer,
  };
}

function describeStorageError(message, bucketName) {
  const text = String(message || '').trim();

  if (text.includes('row-level security policy')) {
    return 'Supabase Storage rejected the raw audio upload. Add SUPABASE_SERVICE_ROLE_KEY to the server or relax the storage bucket policy.';
  }

  if (text.includes('Bucket not found')) {
    return `Supabase bucket "${bucketName}" was not found.`;
  }

  return text || 'Supabase Storage could not save the raw meeting audio.';
}

function sanitizeMeetingCode(value) {
  return String(value || '').trim().replace(/[^a-z0-9-]/gi, '').slice(0, 32);
}

function sanitizeFileName(fileName) {
  return String(fileName || 'meeting.webm').replace(/[^a-zA-Z0-9._-]/g, '_');
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
