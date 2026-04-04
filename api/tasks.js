import { createSupabaseClient, getEnv } from './_lib/meeting-processing.js';
import {
  createTaskRecord,
  getUnifiedWorkspaceSnapshot,
  updateTaskRecord,
} from './_lib/unified-workspace.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  try {
    const env = getEnv({ requireGroq: false, requireGemini: false });
    const supabase = createSupabaseClient(env);
    const snapshot = await getUnifiedWorkspaceSnapshot(supabase);
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
