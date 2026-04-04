/* global process */
import { createSupabaseClient, getEnv } from './_lib/meeting-processing.js';
import { supportsV2WorkspaceSchema } from './_lib/v2-persistence.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  const payload = {
    env: {
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      hasSupabaseKey: Boolean(
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.SUPABASE_ANON_KEY ||
          process.env.VITE_SUPABASE_ANON_KEY
      ),
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      hasGroqKey: Boolean(process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY),
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY),
    },
    schema: {
      mode: 'unavailable',
      demoWorkspaceAvailable: false,
      extensionConnectionsAvailable: false,
      extensionConnectionCount: 0,
    },
    summary: 'Momentum has not checked the server state yet.',
  };

  if (!payload.env.hasSupabaseUrl || !payload.env.hasSupabaseKey) {
    payload.summary = 'Supabase server environment is incomplete.';
    return json(payload);
  }

  try {
    const env = getEnv({ requireGroq: false, requireGemini: false });
    const supabase = createSupabaseClient(env);
    const hasV2Schema = await supportsV2WorkspaceSchema(supabase).catch(() => false);
    payload.schema.mode = hasV2Schema ? 'v2' : 'legacy';

    if (hasV2Schema) {
      const [{ data: demoWorkspace }, connectionProbe] = await Promise.all([
        supabase.from('workspaces').select('id').eq('slug', 'momentum-demo').maybeSingle(),
        supabase.from('extension_connections').select('*', { count: 'exact', head: true }),
      ]);

      payload.schema.demoWorkspaceAvailable = Boolean(demoWorkspace?.id);
      payload.schema.extensionConnectionsAvailable = !connectionProbe.error;
      payload.schema.extensionConnectionCount = Number(connectionProbe.count || 0);
    }

    payload.summary = buildSummary(payload);
    return json(payload);
  } catch (error) {
    payload.summary = error.message || 'Momentum could not inspect the server state.';
    return json(payload, 500);
  }
}

function buildSummary(payload) {
  if (payload.schema.mode === 'v2' && payload.env.hasServiceRoleKey) {
    return 'Server runtime looks ready for the V2 workspace model.';
  }

  if (payload.schema.mode === 'v2') {
    return 'The V2 schema is visible, but the server is still running without a service-role key.';
  }

  if (payload.schema.mode === 'legacy') {
    return 'The product is still serving the legacy schema path on this server.';
  }

  return 'Momentum can read the server environment, but the rollout state is still unclear.';
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
