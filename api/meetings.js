import { createSupabaseClient, getEnv } from './_lib/meeting-processing.js';
import {
  getMeetingStatusById,
  getUnifiedWorkspaceSnapshot,
} from './_lib/unified-workspace.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(request) {
  try {
    const env = getEnv({ requireGroq: false, requireGemini: false });
    const supabase = createSupabaseClient(env);
    const snapshot = await getUnifiedWorkspaceSnapshot(supabase);
    const url = new URL(request.url);
    const meetingId = String(url.searchParams.get('meetingId') || '').trim();
    const view = String(url.searchParams.get('view') || '').trim();

    if (meetingId && view === 'status') {
      const status = getMeetingStatusById(snapshot, meetingId);
      if (!status) {
        return json({ error: 'Meeting not found.' }, 404);
      }

      return json(status);
    }

    if (meetingId) {
      const meeting = snapshot.meetings.find((item) => item.id === meetingId);
      if (!meeting) {
        return json({ error: 'Meeting not found.' }, 404);
      }

      return json(meeting);
    }

    return json({
      meetings: snapshot.meetings,
      source: snapshot.source,
      mode: snapshot.mode,
    });
  } catch (error) {
    return json({ error: error.message || 'Momentum could not load meetings.' }, 500);
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
