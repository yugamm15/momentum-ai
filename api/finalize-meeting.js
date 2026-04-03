/* global process */
import {
  createSupabaseClient,
  getEnv,
  processMeetingAudio,
} from './_lib/meeting-processing.js';

const CHUNK_BUCKET = process.env.STORAGE_CHUNK_BUCKET || 'meeting-chunks';

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
    const env = getEnv();
    const body = await request.json();
    const sessionId = String(body?.sessionId || '').trim();

    if (!sessionId) {
      return json({ error: 'Missing sessionId.' }, 400);
    }

    const supabase = createSupabaseClient(env);
    const chunkPrefix = `chunks/${sessionId}`;
    const chunkFiles = await listChunkFiles(supabase, chunkPrefix);

    if (chunkFiles.length === 0) {
      return json({ error: 'No uploaded audio chunks were found for this session.' }, 404);
    }

    const chunkBuffers = [];
    for (const path of chunkFiles) {
      chunkBuffers.push(await downloadChunkBuffer(supabase, path));
    }

    const contentType = String(body?.contentType || 'audio/webm').trim() || 'audio/webm';
    const result = await processMeetingAudio({
      file: new Blob(chunkBuffers, { type: contentType }),
      meetingCode: body?.meetingCode,
      contentType,
      supabase,
      env,
    });

    await removeChunks(supabase, chunkFiles);

    return json({
      ok: true,
      meetingId: result.meeting.id,
      meetingTitle: result.meeting.title,
    });
  } catch (error) {
    return json({ error: error.message || 'Meeting finalization failed.' }, 500);
  }
}

async function listChunkFiles(supabase, prefix) {
  const { data, error } = await supabase.storage.from(CHUNK_BUCKET).list(prefix, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  });

  if (error) {
    const message = error.message || 'Could not list uploaded meeting chunks.';
    throw new Error(message.includes('row-level security policy')
      ? 'The dashboard cannot read meeting chunks from Supabase Storage yet. Add SUPABASE_SERVICE_ROLE_KEY to Vercel or relax storage policies for the chunk bucket.'
      : message.includes('Bucket not found')
        ? `Supabase bucket "${CHUNK_BUCKET}" was not found.`
        : message);
  }

  return (data || [])
    .filter((item) => item.name)
    .map((item) => `${prefix}/${item.name}`);
}

async function downloadChunkBuffer(supabase, path) {
  const { data, error } = await supabase.storage.from(CHUNK_BUCKET).download(path);

  if (error || !data) {
    const message = error?.message || `Could not download chunk ${path}.`;
    throw new Error(message.includes('row-level security policy')
      ? 'The dashboard cannot download meeting chunks from Supabase Storage yet. Add SUPABASE_SERVICE_ROLE_KEY to Vercel or relax storage policies for the chunk bucket.'
      : message.includes('Bucket not found')
        ? `Supabase bucket "${CHUNK_BUCKET}" was not found.`
        : message);
  }

  return await data.arrayBuffer();
}

async function removeChunks(supabase, paths) {
  if (!paths.length) {
    return;
  }

  await supabase.storage.from(CHUNK_BUCKET).remove(paths);
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
