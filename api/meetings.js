import { createSupabaseClient, getEnv } from './_lib/meeting-processing.js';
import {
  deleteMeetingRecord,
  getMeetingStatusById,
  getUnifiedWorkspaceSnapshot,
  updateMeetingParticipantRecord,
  updateMeetingRecord,
} from './_lib/unified-workspace.js';
import { resolveRequestWorkspaceContext } from './_lib/request-auth.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(request) {
  try {
    const env = getEnv({ requireGroq: false, requireGemini: false });
    const supabase = createSupabaseClient(env);
    const workspaceContext = await resolveRequestWorkspaceContext(request, supabase, {
      allowAnonymous: true,
    }).catch(() => null);
    const snapshot = await getUnifiedWorkspaceSnapshot(supabase);
    const scopedSnapshot = workspaceContext?.workspaceId
      ? await getUnifiedWorkspaceSnapshot(supabase, {
          workspaceId: workspaceContext.workspaceId,
          profileId: workspaceContext?.profileId || null,
        })
      : snapshot;
    const url = new URL(request.url);
    const meetingId = String(url.searchParams.get('meetingId') || '').trim();
    const view = String(url.searchParams.get('view') || '').trim();

    if (meetingId && view === 'status') {
      const status = getMeetingStatusById(scopedSnapshot, meetingId);
      if (!status) {
        return json({ error: 'Meeting not found.' }, 404);
      }

      return json(status);
    }

    if (meetingId) {
      const meeting = scopedSnapshot.meetings.find((item) => item.id === meetingId);
      if (!meeting) {
        return json({ error: 'Meeting not found.' }, 404);
      }

      return json(meeting);
    }

    return json({
      meetings: scopedSnapshot.meetings,
      source: scopedSnapshot.source,
      mode: scopedSnapshot.mode,
    });
  } catch (error) {
    return json({ error: error.message || 'Momentum could not load meetings.' }, 500);
  }
}

export async function PATCH(request) {
  try {
    const env = getEnv({ requireGroq: false, requireGemini: false });
    const supabase = createSupabaseClient(env);
    const workspaceContext = await resolveRequestWorkspaceContext(request, supabase, {
      allowAnonymous: true,
    }).catch(() => null);
    const body = await request.json();
    const meetingId = String(body?.meetingId || '').trim();

    if (!meetingId) {
      return json({ error: 'meetingId is required.' }, 400);
    }

    const shouldUpdateParticipant =
      Boolean(body?.participantId)
      || Object.prototype.hasOwnProperty.call(body || {}, 'removeParticipant')
      || Object.prototype.hasOwnProperty.call(body || {}, 'currentName')
      || Object.prototype.hasOwnProperty.call(body || {}, 'displayName');

    if (shouldUpdateParticipant) {
      await updateMeetingParticipantRecord(supabase, meetingId, {
        participantId: body?.participantId,
        currentName: body?.currentName,
        displayName: body?.displayName,
        removeParticipant: Boolean(body?.removeParticipant),
        workspaceId: workspaceContext?.workspaceId || null,
      });

      return json({ ok: true });
    }

    const title = String(body?.title || '').trim();
    if (!title) {
      return json({ error: 'title is required.' }, 400);
    }

    await updateMeetingRecord(supabase, meetingId, {
      title,
      workspaceId: workspaceContext?.workspaceId || null,
    });

    return json({ ok: true });
  } catch (error) {
    return json({ error: error.message || 'Momentum could not update this meeting.' }, 500);
  }
}

export async function DELETE(request) {
  try {
    const env = getEnv({ requireGroq: false, requireGemini: false });
    const supabase = createSupabaseClient(env);
    const workspaceContext = await resolveRequestWorkspaceContext(request, supabase, {
      allowAnonymous: true,
    }).catch(() => null);
    const url = new URL(request.url);
    const urlMeetingId = String(url.searchParams.get('meetingId') || '').trim();
    const body = await request.json().catch(() => ({}));
    const bodyMeetingId = String(body?.meetingId || '').trim();
    const meetingId = urlMeetingId || bodyMeetingId;

    if (!meetingId) {
      return json({ error: 'meetingId is required.' }, 400);
    }

    await deleteMeetingRecord(supabase, meetingId, {
      workspaceId: workspaceContext?.workspaceId || null,
    });

    return json({ ok: true });
  } catch (error) {
    return json({ error: error.message || 'Momentum could not delete this meeting.' }, 500);
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
