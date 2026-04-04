import { createSupabaseClient, getEnv } from './_lib/meeting-processing.js';
import { getUnifiedWorkspaceSnapshot } from './_lib/unified-workspace.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
      analytics: snapshot.analytics,
      source: snapshot.source,
      mode: snapshot.mode,
    });
  } catch (error) {
    return json({ error: error.message || 'Momentum could not load analytics.' }, 500);
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
