/* global process */
import { randomUUID } from 'node:crypto';
import { createSupabaseClient, getEnv } from '../api/_lib/meeting-processing.js';

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for setup-demo-workspace.');
  }

  const env = getEnv({ requireGroq: false, requireGemini: false });
  const supabase = createSupabaseClient(env);
  const workspace = await ensureDemoWorkspace(supabase);
  const connection = await ensureDemoConnection(supabase, workspace.id);

  console.log(JSON.stringify({
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    connectionToken: connection.token,
    connectionId: connection.id,
    label: connection.label,
  }, null, 2));
}

async function ensureDemoWorkspace(supabase) {
  const { data: existing } = await supabase
    .from('workspaces')
    .select('id, slug')
    .eq('slug', 'momentum-demo')
    .maybeSingle();

  if (existing?.id) {
    return existing;
  }

  const { data, error } = await supabase
    .from('workspaces')
    .insert({
      name: 'Momentum Workspace',
      slug: 'momentum-demo',
      plan: 'hackathon',
    })
    .select('id, slug')
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || 'Could not create the demo workspace.');
  }

  return data;
}

async function ensureDemoConnection(supabase, workspaceId) {
  const { data: existing } = await supabase
    .from('extension_connections')
    .select('id, token, label')
    .eq('workspace_id', workspaceId)
    .eq('label', 'Demo browser')
    .maybeSingle();

  if (existing?.id) {
    return existing;
  }

  const { data, error } = await supabase
    .from('extension_connections')
    .insert({
      workspace_id: workspaceId,
      label: 'Demo browser',
      token: `momentum-demo-${randomUUID()}`,
    })
    .select('id, token, label')
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || 'Could not create the demo extension connection.');
  }

  return data;
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
