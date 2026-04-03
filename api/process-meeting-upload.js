import {
  createSupabaseClient,
  getEnv,
  processMeetingAudio,
} from './_lib/meeting-processing.js';

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
    const formData = await request.formData();
    const audioFile = formData.get('file');
    const meetingCode = String(formData.get('meetingCode') || '').trim();
    const contentType =
      String(formData.get('contentType') || audioFile?.type || 'audio/webm').trim() || 'audio/webm';

    if (!(audioFile instanceof Blob) || audioFile.size === 0) {
      return json({ error: 'Missing meeting audio file.' }, 400);
    }

    const supabase = createSupabaseClient(env);
    const result = await processMeetingAudio({
      file: audioFile,
      meetingCode,
      contentType,
      supabase,
      env,
    });

    return json({
      ok: true,
      meetingId: result.meeting.id,
      meetingTitle: result.meeting.title,
      taskCount: result.analysis.tasks.length,
      audioStored: Boolean(result.audioUrl),
    });
  } catch (error) {
    return json({ error: error.message || 'Direct meeting upload failed.' }, 500);
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
