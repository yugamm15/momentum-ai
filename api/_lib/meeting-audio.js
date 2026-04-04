/* global process */
import { Buffer } from 'node:buffer';
import { getLegacyTableNames } from './legacy-tables.js';
import {
  createPersonDirectory,
  dedupeParticipantDisplayNames,
  matchDirectoryPerson,
} from './people-directory.js';
import { supportsV2WorkspaceSchema } from './v2-persistence.js';

const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'meetings';
const RAW_UPLOAD_STATUS_PREFIX = 'raw-uploaded:';
const LEGACY_RAW_UPLOAD_STATUS_PREFIX = 'audio-uploaded:';
const MAX_EMBEDDED_AUDIO_BYTES = 6 * 1024 * 1024;
const LEGACY_METADATA_MARKER = '[MOMENTUM_META]';

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
  meetingLabel,
  participantNames,
  sessionId,
  recordingStartedAt,
  recordingStoppedAt,
  sourcePlatform,
  extensionVersion,
  connectionToken,
  workspaceId,
  userId,
  bucketName = STORAGE_BUCKET,
}) {
  const normalizedFile = await normalizeInputFile(file, contentType, meetingCode);
  const storage = await persistRecordingArtifact(
    supabase,
    normalizedFile,
    normalizedFile.type,
    meetingCode,
    bucketName
  );
  const legacyTables = await getLegacyTableNames(supabase);
  const useUnifiedMeetingsTable =
    legacyTables.meetings === 'meetings' && (await supportsV2WorkspaceSchema(supabase));
  const payload = buildRawMeetingPayload({
    meetingCode,
    meetingUrl,
    meetingLabel,
    participantNames,
    sessionId,
    audioUrl: storage.audioUrl,
    contentType: normalizedFile.type,
    bytes: normalizedFile.size,
    recordingStartedAt,
    recordingStoppedAt,
    sourcePlatform,
    extensionVersion,
    connectionToken,
    workspaceId,
    userId,
    useUnifiedMeetingsTable,
    storageMode: storage.mode,
    storageError: storage.error,
  });
  const meeting = await upsertRawMeetingRow(supabase, sessionId, payload, {
    useUnifiedMeetingsTable,
  });

  if (useUnifiedMeetingsTable && meeting?.id) {
    await syncRawMeetingParticipants(supabase, meeting.id, participantNames, workspaceId).catch(() => {});
  }

  return {
    meeting,
    audioUrl: storage.audioUrl,
    analysisComplete: false,
    storageMode: storage.mode,
    detail:
      storage.audioUrl
        ? 'Raw meeting audio is safely stored. Finish AI analysis from the dashboard when the processing pipeline is ready.'
        : 'Momentum saved the meeting metadata, but the audio artifact still needs storage attention before playback is available.',
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

export function extractRawMeetingMetadata(meeting, participantRows = []) {
  const summary = String(meeting?.summary || '').trim();
  const summaryMetadata = extractLegacySummaryMetadata(summary);
  const participantNames = dedupeParticipantDisplayNames([
    ...(Array.isArray(participantRows) ? participantRows : []).map((row) => row?.display_name),
    ...(summaryMetadata.participantNames || []),
    ...parseSummaryParticipants(summary),
  ]);

  return {
    sourcePlatform:
      cleanNullable(meeting?.source_platform) ||
      cleanNullable(summaryMetadata.sourcePlatform) ||
      parseSummaryField(summary, /Platform:\s([^.]*)\./i),
    meetingCode:
      sanitizeMeetingCode(meeting?.source_meeting_code || '') ||
      sanitizeMeetingCode(summaryMetadata.meetingCode || '') ||
      inferMeetingCode(meeting),
    meetingUrl:
      cleanNullable(meeting?.source_meeting_url) ||
      cleanNullable(summaryMetadata.meetingUrl) ||
      parseSummaryField(summary, /Source:\s(https?:\/\/\S+)/i),
    meetingLabel:
      cleanNullable(meeting?.source_meeting_label) ||
      cleanNullable(summaryMetadata.meetingLabel) ||
      parseSummaryField(summary, /Visible label:\s([^.]*)\./i),
    participantNames,
    recordingStartedAt:
      cleanNullable(meeting?.recording_started_at) ||
      cleanNullable(summaryMetadata.recordingStartedAt) ||
      parseSummaryField(summary, /Started:\s([^.]*)\./i),
    recordingStoppedAt:
      cleanNullable(meeting?.recording_stopped_at) ||
      cleanNullable(summaryMetadata.recordingStoppedAt) ||
      parseSummaryField(summary, /Stopped:\s([^.]*)\./i),
    workspaceId:
      cleanNullable(meeting?.workspace_id) ||
      cleanNullable(summaryMetadata.workspaceId) ||
      parseSummaryField(summary, /Workspace id:\s([^.]*)\./i),
    userId:
      cleanNullable(meeting?.created_by_profile_id) ||
      cleanNullable(summaryMetadata.userId) ||
      parseSummaryField(summary, /User id:\s([^.]*)\./i),
  };
}

function buildRawMeetingPayload({
  meetingCode,
  meetingUrl,
  meetingLabel,
  participantNames,
  sessionId,
  audioUrl,
  contentType,
  bytes,
  recordingStartedAt,
  recordingStoppedAt,
  sourcePlatform,
  extensionVersion,
  connectionToken,
  workspaceId,
  userId,
  useUnifiedMeetingsTable,
  storageMode,
  storageError,
}) {
  const readableCode = sanitizeMeetingCode(meetingCode) || 'meet-session';
  const recordedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Calcutta' });
  const legacySummaryBase = [
    'Raw meeting audio was saved by Momentum.',
    'AI transcription and analysis are pending.',
    meetingUrl ? `Source: ${meetingUrl}` : null,
    sourcePlatform ? `Platform: ${sourcePlatform}.` : null,
    meetingLabel ? `Visible label: ${meetingLabel}.` : null,
    Array.isArray(participantNames) && participantNames.length > 0
      ? `Participants: ${participantNames.join(', ')}.`
      : null,
    `Format: ${contentType}. Size: ${Math.max(1, Math.round(bytes / 1024))} KB.`,
    sessionId ? `Session: ${sessionId}.` : null,
    recordingStartedAt ? `Started: ${recordingStartedAt}.` : null,
    recordingStoppedAt ? `Stopped: ${recordingStoppedAt}.` : null,
    extensionVersion ? `Extension version: ${extensionVersion}.` : null,
    connectionToken ? `Connection token present.` : null,
    workspaceId ? `Workspace id: ${workspaceId}.` : null,
    userId ? `User id: ${userId}.` : null,
    `Captured at: ${recordedAt}.`,
  ]
    .filter(Boolean)
    .join(' ');
  const legacySummary = buildLegacySummaryWithMetadata(legacySummaryBase, {
    sourcePlatform,
    meetingCode,
    meetingUrl,
    meetingLabel,
    participantNames,
    recordingStartedAt,
    recordingStoppedAt,
    connectionToken,
    workspaceId,
    userId,
    extensionVersion,
    audioMode: storageMode,
    audioError: storageError,
  });
  const title = meetingLabel ? `Audio captured for ${meetingLabel}` : `Audio captured for ${readableCode}`;
  const summaryParagraph = 'Raw meeting audio was saved by Momentum. AI transcription and analysis are pending.';
  const summaryBullets = [
    meetingLabel ? `Visible label: ${meetingLabel}` : null,
    Array.isArray(participantNames) && participantNames.length > 0
      ? `Participants: ${participantNames.join(', ')}`
      : null,
    meetingUrl ? `Source: ${meetingUrl}` : null,
  ].filter(Boolean);

  return {
    title,
    summary: legacySummary,
    transcript: null,
    clarity: 0,
    actionability: 0,
    audio_url: audioUrl,
    status: buildRawUploadStatus(sessionId),
    ...(useUnifiedMeetingsTable
      ? {}
      : {
          user_id: cleanNullable(userId) || null,
        }),
    ...(useUnifiedMeetingsTable
      ? {
          workspace_id: cleanNullable(workspaceId),
          created_by_profile_id: cleanNullable(userId),
          source_platform: cleanNullable(sourcePlatform) || 'google_meet',
          source_meeting_url: cleanNullable(meetingUrl),
          source_meeting_code: sanitizeMeetingCode(meetingCode) || null,
          source_meeting_label: cleanNullable(meetingLabel),
          ai_title: title,
          summary_paragraph: summaryParagraph,
          summary_markdown: [summaryParagraph, ...summaryBullets.map((bullet) => `- ${bullet}`)]
            .filter(Boolean)
            .join('\n'),
          transcript_text: null,
          audio_storage_path: audioUrl,
          recording_started_at: normalizeTimestamp(recordingStartedAt),
          recording_stopped_at: normalizeTimestamp(recordingStoppedAt),
          transcript_status: 'pending',
          extraction_status: 'pending',
          scoring_status: 'pending',
          processing_status: 'pending-analysis',
          processing_error: null,
          overall_score: 0,
          clarity_score: 0,
          ownership_score: 0,
          execution_score: 0,
          score_rationale: 'Analysis pending.',
          analysis_version: 'v2-raw-upload',
          updated_at: new Date().toISOString(),
        }
      : {}),
  };
}

async function upsertRawMeetingRow(supabase, sessionId, payload, options = {}) {
  const legacyTables = await getLegacyTableNames(supabase);
  const existing = sessionId ? await findExistingRawMeeting(supabase, sessionId) : null;
  const useUnifiedMeetingsTable = Boolean(options?.useUnifiedMeetingsTable);

  if (existing?.id) {
    const { data, error } = await supabase
      .from(legacyTables.meetings)
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();

    if (error || !data?.id) {
      throw new Error(error?.message || 'Supabase could not update the stored raw meeting row.');
    }

    if (useUnifiedMeetingsTable && !data.legacy_meeting_id) {
      await supabase.from(legacyTables.meetings).update({ legacy_meeting_id: data.id }).eq('id', data.id);
      return { ...data, legacy_meeting_id: data.id };
    }

    return data;
  }

  const { data, error } = await supabase
    .from(legacyTables.meetings)
    .insert(payload)
    .select()
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || 'Supabase rejected the raw meeting row.');
  }

  if (useUnifiedMeetingsTable && !data.legacy_meeting_id) {
    await supabase.from(legacyTables.meetings).update({ legacy_meeting_id: data.id }).eq('id', data.id);
    return { ...data, legacy_meeting_id: data.id };
  }

  return data;
}

async function findExistingRawMeeting(supabase, sessionId) {
  const legacyTables = await getLegacyTableNames(supabase);
  const statuses = [
    buildRawUploadStatus(sessionId),
    sessionId ? `${LEGACY_RAW_UPLOAD_STATUS_PREFIX}${sessionId}` : LEGACY_RAW_UPLOAD_STATUS_PREFIX.slice(0, -1),
  ];

  const { data, error } = await supabase
    .from(legacyTables.meetings)
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
    return {
      audioUrl: await buildEmbeddedAudioDataUrl(file),
      mode: 'embedded',
      error: 'Supabase Storage is not configured for raw meeting uploads.',
    };
  }

  const safeMeetingCode = sanitizeMeetingCode(meetingCode) || 'meeting';
  const storagePath = `raw/${Date.now()}_${sanitizeFileName(file.name || `momentum_${safeMeetingCode}.webm`)}`;
  const uploadResult = await supabase.storage.from(bucketName).upload(storagePath, file, {
    contentType,
    upsert: false,
  });

  if (uploadResult.error) {
    return {
      audioUrl: await buildEmbeddedAudioDataUrl(file),
      mode: 'embedded',
      error: describeStorageError(uploadResult.error.message, bucketName),
    };
  }

  const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
  const audioUrl = publicUrlData?.publicUrl || '';

  if (!audioUrl) {
    return {
      audioUrl: await buildEmbeddedAudioDataUrl(file),
      mode: 'embedded',
      error: 'Supabase Storage did not return a public audio URL.',
    };
  }

  return {
    audioUrl,
    mode: 'bucket',
    error: '',
  };
}

async function persistRecordingArtifact(supabase, file, contentType, meetingCode, bucketName) {
  try {
    return await uploadRecordingToStorage(supabase, file, contentType, meetingCode, bucketName);
  } catch (error) {
    return {
      audioUrl: await buildEmbeddedAudioDataUrl(file),
      mode: 'embedded',
      error: error?.message || 'Supabase Storage could not save the raw meeting audio.',
    };
  }
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
  const value = String(dataUrl || '').trim();
  if (!value.startsWith('data:')) {
    throw new Error('Stored audio data is invalid.');
  }

  const commaIndex = value.indexOf(',');
  if (commaIndex === -1) {
    throw new Error('Stored audio data is invalid.');
  }

  const metadata = value.slice(5, commaIndex);
  const payload = value.slice(commaIndex + 1);
  const metadataParts = metadata.split(';').filter(Boolean);
  const isBase64 = metadataParts.some((part) => part.toLowerCase() === 'base64');
  const contentType = metadataParts
    .filter((part) => part.toLowerCase() !== 'base64')
    .join(';') || 'audio/webm';
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

async function buildEmbeddedAudioDataUrl(file) {
  if (!(file instanceof Blob) || Number(file.size || 0) <= 0 || Number(file.size || 0) > MAX_EMBEDDED_AUDIO_BYTES) {
    return null;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = String(file.type || 'audio/webm').trim() || 'audio/webm';
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

async function syncRawMeetingParticipants(supabase, meetingId, participantNames, workspaceId) {
  const dedupedNames = dedupeParticipantDisplayNames(participantNames);

  await supabase.from('meeting_participants').delete().eq('meeting_id', meetingId);

  if (!dedupedNames.length) {
    return;
  }

  const directory = workspaceId ? await loadWorkspaceDirectory(supabase, workspaceId) : [];
  const rows = dedupedNames.map((displayName) => {
    const match = matchDirectoryPerson(displayName, directory);
    return {
      meeting_id: meetingId,
      display_name: displayName,
      matched_profile_id: match.status === 'matched' ? match.record.id : null,
      confidence: match.status === 'matched' ? match.confidence : 0.68,
    };
  });

  await supabase.from('meeting_participants').insert(rows);
}

async function loadWorkspaceDirectory(supabase, workspaceId) {
  const [{ data: profiles }, { data: memberships }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name, workspace_id')
      .eq('workspace_id', workspaceId),
    supabase
      .from('workspace_members')
      .select('profile_id, role')
      .eq('workspace_id', workspaceId),
  ]);

  return createPersonDirectory(
    profiles || [],
    new Map((memberships || []).map((membership) => [membership.profile_id, membership]))
  );
}

function parseSummaryParticipants(summary) {
  const participants = parseSummaryField(summary, /Participants:\s([^.]*)\./i);
  if (!participants) {
    return [];
  }

  return dedupeParticipantDisplayNames(participants.split(','));
}

function parseSummaryField(summary, pattern) {
  const match = String(summary || '').match(pattern);
  return cleanNullable(match?.[1]);
}

function cleanNullable(value) {
  const text = String(value || '').trim();
  return text || null;
}

function normalizeTimestamp(value) {
  const text = cleanNullable(value);
  if (!text) {
    return null;
  }

  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString();
}

function extractLegacySummaryMetadata(summary) {
  const text = String(summary || '').trim();
  const markerIndex = text.lastIndexOf(LEGACY_METADATA_MARKER);
  if (markerIndex === -1) {
    return {};
  }

  const payload = text.slice(markerIndex + LEGACY_METADATA_MARKER.length).trim();
  try {
    const metadata = JSON.parse(payload);
    return {
      sourcePlatform: cleanNullable(metadata?.sourcePlatform),
      meetingCode: sanitizeMeetingCode(metadata?.meetingCode),
      meetingUrl: cleanNullable(metadata?.meetingUrl),
      meetingLabel: cleanNullable(metadata?.meetingLabel),
      participantNames: dedupeParticipantDisplayNames(metadata?.participantNames),
      recordingStartedAt: cleanNullable(metadata?.recordingStartedAt),
      recordingStoppedAt: cleanNullable(metadata?.recordingStoppedAt),
      workspaceId: cleanNullable(metadata?.workspaceId),
      userId: cleanNullable(metadata?.userId),
    };
  } catch {
    return {};
  }
}

function buildLegacySummaryWithMetadata(summary, metadata = {}) {
  const cleanSummary = sanitizeLegacySummaryForDisplay(summary);
  const safeMetadata = {
    sourcePlatform: cleanNullable(metadata?.sourcePlatform),
    meetingCode: sanitizeMeetingCode(metadata?.meetingCode),
    meetingUrl: cleanNullable(metadata?.meetingUrl),
    meetingLabel: cleanNullable(metadata?.meetingLabel),
    participantNames: dedupeParticipantDisplayNames(metadata?.participantNames),
    recordingStartedAt: cleanNullable(metadata?.recordingStartedAt),
    recordingStoppedAt: cleanNullable(metadata?.recordingStoppedAt),
    connectionTokenPresent: Boolean(cleanNullable(metadata?.connectionToken)),
    workspaceId: cleanNullable(metadata?.workspaceId),
    userId: cleanNullable(metadata?.userId),
    extensionVersion: cleanNullable(metadata?.extensionVersion),
    audioMode: cleanNullable(metadata?.audioMode),
    audioError: cleanNullable(metadata?.audioError),
  };
  const hasMetadata = Object.values(safeMetadata).some((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value)
  );

  if (!hasMetadata) {
    return cleanSummary;
  }

  return [cleanSummary, `${LEGACY_METADATA_MARKER} ${JSON.stringify(safeMetadata)}`]
    .filter(Boolean)
    .join('\n\n');
}

function sanitizeLegacySummaryForDisplay(summary) {
  const text = String(summary || '').trim();
  const markerIndex = text.lastIndexOf(LEGACY_METADATA_MARKER);
  if (markerIndex === -1) {
    return text;
  }

  return text.slice(0, markerIndex).trim();
}
