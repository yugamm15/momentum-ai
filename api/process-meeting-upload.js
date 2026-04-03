import {
  createSupabaseClient,
  getEnv,
  processMeetingAudio,
} from './_lib/meeting-processing.js';
import { storeRawMeetingAudio } from './_lib/meeting-audio.js';

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
    const env = getEnv({ requireGroq: false, requireGemini: false });
    const formData = await request.formData();
    const audioFile = formData.get('file');
    const meetingCode = String(formData.get('meetingCode') || '').trim();
    const meetingUrl = String(formData.get('meetingUrl') || '').trim();
    const sessionId = String(formData.get('sessionId') || '').trim();
    const contentType =
      String(formData.get('contentType') || audioFile?.type || 'audio/webm').trim() || 'audio/webm';

    if (!(audioFile instanceof Blob) || audioFile.size === 0) {
      return json({ error: 'Missing meeting audio file.' }, 400);
    }

    const supabase = createSupabaseClient(env);
    try {
      if (!env.groqKey) {
        throw new Error('Transcription environment is incomplete.');
      }

      const result = await processMeetingAudio({
        file: audioFile,
        meetingCode,
        contentType,
        supabase,
        env,
      });

      return json({
        ok: true,
        analysisComplete: true,
        meetingId: result.meeting.id,
        meetingTitle: result.meeting.title,
        taskCount: result.analysis.tasks.length,
        audioStored: Boolean(result.audioUrl),
        detail: result.audioUrl
          ? 'Transcript, summary, and extracted tasks are ready in Momentum.'
          : 'Transcript, summary, and extracted tasks are ready. Raw audio storage is not available right now.',
      });
    } catch (processingError) {
      const fallback = await storeRawMeetingAudio({
        supabase,
        file: audioFile,
        contentType,
        meetingCode,
        meetingUrl,
        sessionId,
      });

      return json({
        ok: true,
        analysisComplete: false,
        meetingId: fallback.meeting.id,
        meetingTitle: fallback.meeting.title,
        taskCount: 0,
        audioStored: true,
        detail:
          `${fallback.detail} AI processing fallback reason: ${processingError.message || 'unknown error'}`.slice(0, 500),
      });
    }
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
