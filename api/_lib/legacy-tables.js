let legacyTablesPromise = null;

export async function getLegacyTableNames(supabase) {
  if (!legacyTablesPromise) {
    legacyTablesPromise = detectLegacyTableNames(supabase).catch(() => ({
      meetings: 'meetings',
      tasks: 'tasks',
    }));
  }

  return legacyTablesPromise;
}

export function resetLegacyTableNamesCache() {
  legacyTablesPromise = null;
}

async function detectLegacyTableNames(supabase) {
  const [{ error: oldMeetingsError }, { error: oldTasksError }] = await Promise.all([
    supabase.from('old_meetings').select('id').limit(1),
    supabase.from('old_tasks').select('id').limit(1),
  ]);

  if (!oldMeetingsError && !oldTasksError) {
    return {
      meetings: 'old_meetings',
      tasks: 'old_tasks',
    };
  }

  return {
    meetings: 'meetings',
    tasks: 'tasks',
  };
}
