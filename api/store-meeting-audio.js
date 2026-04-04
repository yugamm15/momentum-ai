/* global process */
import { createClient } from '@supabase/supabase-js';
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
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return json({ error: 'Server environment variables are incomplete.' }, 500);
    }

    const formData = await request.formData();
    const audioFile = formData.get('file');
    const meetingCode = String(formData.get('meetingCode') || '').trim();
    const meetingUrl = String(formData.get('meetingUrl') || '').trim();
    const meetingLabel = String(formData.get('meetingLabel') || '').trim();
    const sessionId = String(formData.get('sessionId') || '').trim();
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

    const supabase = createClient(supabaseUrl, supabaseKey);
    const result = await storeRawMeetingAudio({
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
      meetingId: result.meeting.id,
      meetingTitle: result.meeting.title,
      audioStored: true,
      storageMode: result.storageMode,
      detail: result.detail,
    });
  } catch (error) {
    return json({ error: error.message || 'Meeting audio could not be stored.' }, 500);
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
