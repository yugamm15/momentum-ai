/* global process */
import { createSupabaseClient, getEnv } from '../api/_lib/meeting-processing.js';
import {
  createMeetingContractFromUnifiedMeeting,
  persistMeetingContract,
} from '../api/_lib/v2-persistence.js';
import { transformLegacyMeeting } from '../src/lib/meeting-transforms.js';

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for backfill-v2.');
  }

  const env = getEnv({ requireGroq: false, requireGemini: false });
  const supabase = createSupabaseClient(env);
  const sources = await detectLegacySources(supabase);
  const [{ data: meetings, error: meetingsError }, { data: tasks, error: tasksError }] = await Promise.all([
    supabase.from(sources.meetingsTable).select('*').order('created_at', { ascending: true }),
    supabase.from(sources.tasksTable).select('*').order('created_at', { ascending: true }),
  ]);

  if (meetingsError) {
    throw new Error(meetingsError.message || 'Could not read legacy meetings.');
  }

  if (tasksError) {
    throw new Error(tasksError.message || 'Could not read legacy tasks.');
  }

  let migrated = 0;
  let skipped = 0;
  for (const meeting of meetings || []) {
    const unifiedMeeting = transformLegacyMeeting(
      meeting,
      (tasks || []).filter((task) => task.meeting_id === meeting.id)
    );

    if (!unifiedMeeting) {
      skipped += 1;
      continue;
    }

    await persistMeetingContract(
      supabase,
      createMeetingContractFromUnifiedMeeting(unifiedMeeting)
    );
    migrated += 1;
  }

  console.log(
    JSON.stringify(
      {
        migratedMeetings: migrated,
        skippedMeetings: skipped,
        sourceTables: sources,
      },
      null,
      2
    )
  );
}

async function detectLegacySources(supabase) {
  const { error: oldMeetingsError } = await supabase.from('old_meetings').select('id').limit(1);
  const { error: oldTasksError } = await supabase.from('old_tasks').select('id').limit(1);

  if (!oldMeetingsError && !oldTasksError) {
    return {
      meetingsTable: 'old_meetings',
      tasksTable: 'old_tasks',
    };
  }

  return {
    meetingsTable: 'meetings',
    tasksTable: 'tasks',
  };
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
