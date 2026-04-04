import { createSupabaseClient, getEnv } from './_lib/meeting-processing.js';
import { getUnifiedWorkspaceSnapshot } from './_lib/unified-workspace.js';
import { resolveRequestWorkspaceContext } from './_lib/request-auth.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
    return json(snapshot);
  } catch (error) {
    return json({ error: error.message || 'Momentum could not build the workspace snapshot.' }, 500);
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
