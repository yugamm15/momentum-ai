import { createSupabaseClient, getEnv } from './_lib/meeting-processing.js';
import {
  createTaskRecord,
  getUnifiedWorkspaceSnapshot,
  updateTaskRecord,
} from './_lib/unified-workspace.js';
import { resolveRequestWorkspaceContext } from './_lib/request-auth.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
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
    const snapshot = await getUnifiedWorkspaceSnapshot(supabase, {
      workspaceId: workspaceContext?.workspaceId || null,
      profileId: workspaceContext?.profileId || null,
    });
    return json({
      tasks: snapshot.tasks,
      source: snapshot.source,
      mode: snapshot.mode,
    });
  } catch (error) {
    return json({ error: error.message || 'Momentum could not load tasks.' }, 500);
  }
}

export async function POST(request) {
  try {
    const env = getEnv({ requireGroq: false, requireGemini: false });
    const supabase = createSupabaseClient(env);
    const workspaceContext = await resolveRequestWorkspaceContext(request, supabase, {
      allowAnonymous: true,
    }).catch(() => null);
    const body = await request.json();
    const meetingId = String(body?.meetingId || '').trim();
    const title = String(body?.title || '').trim();

    if (!meetingId || !title) {
      return json({ error: 'meetingId and title are required.' }, 400);
    }

    await createTaskRecord(supabase, {
      meetingId,
      title,
      owner: String(body?.owner || '').trim(),
      dueDate: String(body?.dueDate || '').trim(),
      status: String(body?.status || 'pending').trim(),
      workspaceId: workspaceContext?.workspaceId || null,
      editedByProfileId: workspaceContext?.profileId || null,
    });

    return json({ ok: true });
  } catch (error) {
    return json({ error: error.message || 'Momentum could not create the task.' }, 500);
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
    const taskId = String(body?.taskId || '').trim();

    if (!taskId) {
      return json({ error: 'taskId is required.' }, 400);
    }

    await updateTaskRecord(supabase, taskId, {
      title: body?.title,
      owner: body?.owner,
      dueDate: body?.dueDate,
      status: body?.status,
      workspaceId: workspaceContext?.workspaceId || null,
      editedByProfileId: workspaceContext?.profileId || null,
    });

    return json({ ok: true });
  } catch (error) {
    return json({ error: error.message || 'Momentum could not update the task.' }, 500);
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
