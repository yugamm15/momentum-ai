import {
  createSupabaseClient,
  getEnv,
  processMeetingAudio,
} from './_lib/meeting-processing.js';
import { storeRawMeetingAudio } from './_lib/meeting-audio.js';

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
    const env = getEnv({ requireGroq: false, requireGemini: false });
    const formData = await request.formData();
    const audioFile = formData.get('file');
    const meetingCode = String(formData.get('meetingCode') || '').trim();
    const meetingUrl = String(formData.get('meetingUrl') || '').trim();
    const sessionId = String(formData.get('sessionId') || '').trim();
    const meetingLabel = String(formData.get('meetingLabel') || '').trim();
    const participantNames = parseParticipantNames(formData);
    const recordingStartedAt = String(formData.get('recordingStartedAt') || '').trim();
    const recordingStoppedAt = String(formData.get('recordingStoppedAt') || '').trim();
    const sourcePlatform = String(formData.get('sourcePlatform') || 'google_meet').trim();
    const extensionVersion = String(formData.get('extensionVersion') || '').trim();
    const connectionToken = String(formData.get('connectionToken') || '').trim();
    const workspaceId = String(formData.get('workspaceId') || '').trim();
    const userId = String(formData.get('userId') || '').trim();
    const contentType =
      String(formData.get('contentType') || audioFile?.type || 'audio/webm').trim() || 'audio/webm';

    if (!(audioFile instanceof Blob) || audioFile.size === 0) {
      return json({ error: 'Missing meeting audio file.' }, 400);
    }

    const supabase = createSupabaseClient(env);
    try {
      if (!env.groqKey) {
        throw new Error('Transcription environment is incomplete.');
      }

      const result = await processMeetingAudio({
        file: audioFile,
        meetingCode,
        contentType,
        supabase,
        env,
        sourceMetadata: {
          sourcePlatform,
          meetingCode,
          meetingUrl,
          meetingLabel,
          participantNames,
          recordingStartedAt,
          recordingStoppedAt,
          extensionVersion,
          connectionToken,
          workspaceId,
          userId,
        },
      });

      return json({
        ok: true,
        analysisComplete: true,
        meetingId: result.meeting.id,
        meetingTitle: result.meeting.title,
        taskCount: result.analysis.tasks.length,
        audioStored: Boolean(result.audioUrl),
        detail: result.audioUrl
          ? 'Transcript, summary, and extracted tasks are ready in Momentum.'
          : 'Transcript, summary, and extracted tasks are ready. Raw audio storage is not available right now.',
      });
    } catch (processingError) {
      const fallback = await storeRawMeetingAudio({
        supabase,
        file: audioFile,
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
      });

      return json({
        ok: true,
        analysisComplete: false,
        meetingId: fallback.meeting.id,
        meetingTitle: fallback.meeting.title,
        taskCount: 0,
        audioStored: true,
        detail:
          `${fallback.detail} AI processing fallback reason: ${processingError.message || 'unknown error'}`.slice(0, 500),
      });
    }
  } catch (error) {
    return json({ error: error.message || 'Direct meeting upload failed.' }, 500);
  }
}

function parseParticipantNames(formData) {
  const directValues = formData
    .getAll('participantNames')
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  if (directValues.length > 0) {
    return Array.from(new Set(directValues));
  }

  const serialized = String(formData.get('participantNamesJson') || '').trim();
  if (!serialized) {
    return [];
  }

  try {
    const parsed = JSON.parse(serialized);
    return Array.from(
      new Set(
        (Array.isArray(parsed) ? parsed : [])
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      )
    );
  } catch {
    return [];
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
