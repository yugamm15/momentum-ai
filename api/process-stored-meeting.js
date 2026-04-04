import {
  createSupabaseClient,
  getEnv,
  processMeetingAudio,
} from './_lib/meeting-processing.js';
import {
  downloadMeetingAudioFile,
  inferMeetingCode,
  isRawUploadStatus,
} from './_lib/meeting-audio.js';
import { getLegacyTableNames } from './_lib/legacy-tables.js';
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
    const env = getEnv({ requireGemini: false });
    const body = await request.json();
    const meetingId = String(body?.meetingId || '').trim();

    if (!meetingId) {
      return json({ error: 'Missing meetingId.' }, 400);
    }

    const supabase = createSupabaseClient(env);
    const workspaceContext = await resolveRequestWorkspaceContext(request, supabase, {
      allowAnonymous: true,
    }).catch(() => null);
    const legacyTables = await getLegacyTableNames(supabase);
    const { data: meeting, error } = await supabase
      .from(legacyTables.meetings)
      .select('id, title, summary, transcript, audio_url, status')
      .eq('id', meetingId)
      .single();

    if (error || !meeting?.id) {
      return json({ error: error?.message || 'Meeting not found.' }, 404);
    }

    if (
      workspaceContext?.workspaceId &&
      String(meeting.summary || '').includes('Workspace id:') &&
      !String(meeting.summary || '').includes(`Workspace id: ${workspaceContext.workspaceId}.`)
    ) {
      return json({ error: 'Meeting not found.' }, 404);
    }

    if (meeting.status === 'completed' && String(meeting.transcript || '').trim()) {
      return json({
        ok: true,
        meetingId: meeting.id,
        meetingTitle: meeting.title,
        taskCount: 0,
        detail: 'This meeting is already fully analyzed.',
      });
    }

    if (!isRawUploadStatus(meeting.status) && meeting.status !== 'processing') {
      return json({ error: 'This meeting is not in a reprocessable raw-audio state.' }, 400);
    }

    const file = await downloadMeetingAudioFile(meeting);
    const meetingCode = inferMeetingCode(meeting);
    const result = await processMeetingAudio({
      file,
      meetingCode,
      contentType: file.type || 'audio/webm',
      supabase,
      env,
      existingMeetingId: meeting.id,
      existingAudioUrl: meeting.audio_url,
    });

    return json({
      ok: true,
      meetingId: result.meeting.id,
      meetingTitle: result.meeting.title,
      taskCount: result.analysis.tasks.length,
      detail: 'Transcript, summary, and extracted tasks are now ready.',
    });
  } catch (error) {
    return json({ error: error.message || 'Stored meeting processing failed.' }, 500);
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
