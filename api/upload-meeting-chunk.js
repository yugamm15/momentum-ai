/* global process */
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id, X-Chunk-Index, X-Content-Type',
  'Cache-Control': 'no-store',
};

const CHUNK_BUCKET = process.env.STORAGE_CHUNK_BUCKET || 'meeting-chunks';

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return json({ error: 'Server environment variables are incomplete.' }, 500);
    }

    const url = new URL(request.url);
    const sessionId = sanitizeSessionId(
      request.headers.get('x-session-id') || url.searchParams.get('sessionId') || ''
    );
    const chunkIndex = sanitizeChunkIndex(
      request.headers.get('x-chunk-index') || url.searchParams.get('chunkIndex') || ''
    );
    const contentType =
      request.headers.get('x-content-type') ||
      request.headers.get('content-type') ||
      url.searchParams.get('contentType') ||
      'audio/webm';

    if (!sessionId) {
      return json({ error: 'Missing sessionId.' }, 400);
    }

    if (chunkIndex === null) {
      return json({ error: 'Missing chunkIndex.' }, 400);
    }

    const body = await request.arrayBuffer();
    if (!body.byteLength) {
      return json({ error: 'Missing chunk body.' }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const fileName = `${String(chunkIndex).padStart(6, '0')}.webm`;
    const storagePath = `chunks/${sessionId}/${fileName}`;
    const blob = new Blob([body], { type: contentType });

    const { data, error } = await supabase.storage.from(CHUNK_BUCKET).upload(storagePath, blob, {
      contentType,
      upsert: true,
    });

    if (error) {
      return json(
        {
          error: error.message.includes('Bucket not found')
            ? `Supabase bucket "${CHUNK_BUCKET}" was not found.`
            : error.message,
        },
        500
      );
    }

    return json({ ok: true, path: data?.path || storagePath });
  } catch (error) {
    return json({ error: error.message || 'Chunk upload failed.' }, 500);
  }
}

function sanitizeSessionId(value) {
  const text = String(value || '').trim();
  return /^[a-zA-Z0-9_-]{8,128}$/.test(text) ? text : '';
}

function sanitizeChunkIndex(value) {
  if (value === '') {
    return null;
  }

  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 999999) {
    return null;
  }

  return number;
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
