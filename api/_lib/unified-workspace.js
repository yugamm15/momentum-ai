import {
  normalizeStatus,
  scoreColor,
  transformLegacyMeeting,
} from '../../src/lib/meeting-transforms.js';
import { extractRawMeetingMetadata, isRawUploadStatus } from './meeting-audio.js';
import { getLegacyTableNames } from './legacy-tables.js';
import {
  cleanParticipantDisplayName,
  createPersonDirectory,
  displayNameForProfile,
  matchDirectoryPerson,
  normalizePersonName,
} from './people-directory.js';
import { buildTranscriptSegmentsFromText } from './v2-persistence.js';

let schemaModePromise = null;

export async function getUnifiedWorkspaceSnapshot(supabase, options = {}) {
  try {
    const mode = await detectSchemaMode(supabase);
    const liveSnapshot =
      mode === 'v2'
        ? await loadV2Snapshot(supabase, options)
        : await loadLegacySnapshot(supabase);
    const meetings = liveSnapshot.meetings;
    const tasks = liveSnapshot.tasks;
    const people = liveSnapshot.people || [];

    return {
      meetings,
      tasks,
      people,
      liveMeetings: liveSnapshot.meetings,
      liveTasks: liveSnapshot.tasks,
      analytics: buildAnalytics(meetings, tasks, people),
      source: liveSnapshot.meetings.length > 0 ? 'live' : 'empty',
      mode,
    };
  } catch (error) {
    return {
      meetings: [],
      tasks: [],
      people: [],
      liveMeetings: [],
      liveTasks: [],
      analytics: buildAnalytics([], [], []),
      source: 'error',
      mode: 'fallback',
      error: error.message || 'Momentum could not build the workspace snapshot.',
    };
  }
}

export async function updateTaskRecord(supabase, taskId, updates) {
  const mode = await detectSchemaMode(supabase);

  if (mode === 'v2') {
    const workspaceId = String(updates?.workspaceId || '').trim();
    const editedByProfileId = String(updates?.editedByProfileId || '').trim() || null;
    const currentTask = await findV2TaskRow(supabase, taskId, workspaceId);
    if (!currentTask?.id) {
      throw new Error('Momentum could not find this task in the current workspace.');
    }

    const payload = {};
    const directory = workspaceId ? await loadWorkspaceDirectory(supabase, workspaceId) : [];

    if (Object.prototype.hasOwnProperty.call(updates, 'title')) {
      payload.title = updates.title;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'owner')) {
      const ownerMatch = matchDirectoryPerson(updates.owner, directory);
      payload.owner_name =
        ownerMatch.status === 'matched'
          ? ownerMatch.record.displayName
          : cleanNullable(updates.owner);
      payload.owner_profile_id =
        ownerMatch.status === 'matched' ? ownerMatch.record.id : null;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'dueDate')) {
      const dueDateFields = splitDueDateFields(updates.dueDate);
      payload.due_date = dueDateFields.dueDate;
      payload.due_date_label = dueDateFields.dueDateLabel;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'status')) {
      payload.status = normalizeStatus(updates.status, updates.status === 'needs-review');
      payload.needs_review = payload.status === 'needs-review';
    }

    payload.updated_at = new Date().toISOString();
    payload.edited_by_profile_id = editedByProfileId;

    const { error } = await supabase.from('meeting_tasks').update(payload).eq('id', taskId);
    if (error) {
      throw error;
    }

    return { ok: true, mode };
  }

  const payload = {};
  if (Object.prototype.hasOwnProperty.call(updates, 'title')) {
    payload.title = updates.title;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'owner')) {
    payload.assignee = updates.owner;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'dueDate')) {
    payload.deadline = updates.dueDate;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'status')) {
    payload.status = normalizeLegacyTaskStatus(updates.status);
  }

  const { error } = await supabase.from('tasks').update(payload).eq('id', taskId);
  if (error) {
    throw error;
  }

  return { ok: true, mode };
}

export async function createTaskRecord(supabase, task) {
  const mode = await detectSchemaMode(supabase);

  if (mode === 'v2') {
    const workspaceId = String(task?.workspaceId || '').trim();
    const editedByProfileId = String(task?.editedByProfileId || '').trim() || null;
    const meeting = await findScopedMeetingRow(supabase, task.meetingId, workspaceId);
    if (!meeting?.id) {
      throw new Error('Momentum could not find the source meeting in the current workspace.');
    }

    const dueDateFields = splitDueDateFields(task.dueDate);
    const directory = workspaceId ? await loadWorkspaceDirectory(supabase, workspaceId) : [];
    const ownerMatch = matchDirectoryPerson(task.owner, directory);
    const { error } = await supabase.from('meeting_tasks').insert({
      meeting_id: task.meetingId,
      title: task.title,
      owner_name:
        ownerMatch.status === 'matched'
          ? ownerMatch.record.displayName
          : cleanNullable(task.owner),
      owner_profile_id:
        ownerMatch.status === 'matched' ? ownerMatch.record.id : null,
      due_date: dueDateFields.dueDate,
      due_date_label: dueDateFields.dueDateLabel,
      status: normalizeStatus(task.status, !task.owner || !task.dueDate),
      needs_review: !task.owner || !task.dueDate,
      confidence: 0.72,
      source_snippet: 'Manually created in Momentum.',
      edited_by_profile_id: editedByProfileId,
    });

    if (error) {
      throw error;
    }

    return { ok: true, mode };
  }

  const { error } = await supabase.from('tasks').insert({
    meeting_id: task.meetingId,
    title: task.title,
    assignee: task.owner,
    deadline: task.dueDate,
    status: normalizeLegacyTaskStatus(task.status || 'pending'),
  });

  if (error) {
    throw error;
  }

  return { ok: true, mode };
}

export function getMeetingStatusById(snapshot, meetingId) {
  const meeting = snapshot.meetings.find((item) => item.id === meetingId);
  if (!meeting) {
    return null;
  }

  return {
    meetingId: meeting.id,
    processingStatus: meeting.processingStatus,
    summary: meeting.processingSummary,
    score: meeting.score,
    riskCount: meeting.meetingRisks?.length || 0,
    taskCount: meeting.tasks?.length || 0,
  };
}

async function detectSchemaMode(supabase) {
  if (!schemaModePromise) {
    schemaModePromise = probeSchemaMode(supabase).catch(() => 'legacy');
  }

  return schemaModePromise;
}

async function probeSchemaMode(supabase) {
  const { error } = await supabase.from('meeting_tasks').select('id').limit(1);
  return error ? 'legacy' : 'v2';
}

async function loadLegacySnapshot(supabase) {
  const [{ data: liveMeetings, error: meetingsError }, { data: liveTasks, error: tasksError }] = await Promise.all([
    supabase.from('meetings').select('*').order('created_at', { ascending: false }),
    supabase.from('tasks').select('*').order('created_at', { ascending: false }),
  ]);

  if (meetingsError) {
    throw meetingsError;
  }

  if (tasksError) {
    throw tasksError;
  }

  const meetings = (liveMeetings || [])
    .map((meeting) =>
      transformLegacyMeeting(
        meeting,
        (liveTasks || []).filter((task) => task.meeting_id === meeting.id)
      )
    )
    .filter(Boolean);

  return {
    meetings,
    tasks: meetings.flatMap((meeting) => meeting.tasks),
    people: buildPeoplePoolFromMeetings(meetings),
  };
}

async function loadV2Snapshot(supabase, options = {}) {
  const workspaceId = String(options?.workspaceId || '').trim();
  if (!workspaceId) {
    return {
      meetings: [],
      tasks: [],
      people: [],
    };
  }

  const [
    { data: meetingsRows, error: meetingsError },
    { data: membershipRows, error: membershipError },
    { data: profileRows, error: profilesError },
  ] = await Promise.all([
    supabase
      .from('meetings')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false }),
    supabase
      .from('workspace_members')
      .select('profile_id, role')
      .eq('workspace_id', workspaceId),
    supabase
      .from('profiles')
      .select('id, email, full_name, workspace_id')
      .eq('workspace_id', workspaceId),
  ]);

  const firstWorkspaceError = [meetingsError, membershipError, profilesError].find(Boolean);
  if (firstWorkspaceError) {
    throw firstWorkspaceError;
  }

  const meetingIds = (meetingsRows || []).map((meeting) => meeting.id);
  const childCollections = meetingIds.length
    ? await Promise.all([
        supabase.from('meeting_participants').select('*').in('meeting_id', meetingIds),
        supabase.from('meeting_tasks').select('*').in('meeting_id', meetingIds).order('created_at', { ascending: false }),
        supabase.from('meeting_decisions').select('*').in('meeting_id', meetingIds),
        supabase.from('meeting_checklist_items').select('*').in('meeting_id', meetingIds),
        supabase.from('meeting_risk_flags').select('*').in('meeting_id', meetingIds),
        supabase
          .from('meeting_transcript_segments')
          .select('*')
          .in('meeting_id', meetingIds)
          .order('segment_index', { ascending: true }),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];

  const [
    { data: participantRows, error: participantsError },
    { data: taskRows, error: tasksError },
    { data: decisionRows, error: decisionsError },
    { data: checklistRows, error: checklistError },
    { data: riskRows, error: risksError },
    { data: transcriptRows, error: transcriptError },
  ] = childCollections;

  const firstError = [
    participantsError,
    tasksError,
    decisionsError,
    checklistError,
    risksError,
    transcriptError,
  ].find(Boolean);

  if (firstError) {
    throw firstError;
  }

  const membershipByProfileId = new Map(
    (membershipRows || []).map((member) => [member.profile_id, member])
  );
  const directory = createPersonDirectory(profileRows || [], membershipByProfileId);
  const workspaceProfileIds = new Set((profileRows || []).map((profile) => profile.id).filter(Boolean));
  const participantsByMeeting = groupBy(participantRows || [], 'meeting_id');
  const tasksByMeeting = groupBy(taskRows || [], 'meeting_id');
  const decisionsByMeeting = groupBy(decisionRows || [], 'meeting_id');
  const checklistByMeeting = groupBy(checklistRows || [], 'meeting_id');
  const risksByMeeting = groupBy(riskRows || [], 'meeting_id');
  const transcriptByMeeting = groupBy(transcriptRows || [], 'meeting_id');

  const meetings = (meetingsRows || []).map((meeting) => {
    const rawMetadata = extractRawMeetingMetadata(
      meeting,
      participantsByMeeting.get(meeting.id) || []
    );
    const persistedParticipantRoster = (participantsByMeeting.get(meeting.id) || [])
      .map((item) => buildParticipantRosterEntry(item, directory))
      .filter(Boolean);
    const dedupedPersistedParticipantRoster = Array.from(
      new Map(
        persistedParticipantRoster.map((participant) => [
          normalizePersonName(participant.displayName),
          participant,
        ])
      ).values()
    );
    const fallbackParticipantRoster =
      dedupedPersistedParticipantRoster.length > 0
        ? []
        : (rawMetadata.participantNames || []).map((displayName, index) => ({
            id: `${meeting.id}-participant-fallback-${index + 1}`,
            displayName,
            profileId: null,
            profileName: '',
            email: '',
            role: 'guest',
            matchStatus: 'unmatched',
            confidence: 0.68,
          }));
    const participantRoster = persistedParticipantRoster.length > 0
      ? dedupedPersistedParticipantRoster
      : fallbackParticipantRoster;
    const participantNames = participantRoster.map((item) => item.displayName);
    const rawTranscriptSegments = transcriptByMeeting.get(meeting.id) || [];
    const transcriptSegments = rawTranscriptSegments.length
      ? normalizeTranscriptSegments(rawTranscriptSegments, participantNames)
      : buildTranscriptSegmentsFromText(
          String(meeting.transcript_text || '').trim() || String(meeting.transcript || '').trim()
        ).map((segment, index) => ({
          id: `${meeting.id}-seg-${index + 1}`,
          time: formatTranscriptTime(segment.startedAtSeconds),
          speaker: '',
          speakerLabel: 'Speaker attribution unavailable',
          text: segment.text,
          attribution: 'unattributed',
          startedAtSeconds: segment.startedAtSeconds,
          endedAtSeconds: segment.endedAtSeconds,
        }));
    const syntheticTranscript = isSyntheticTranscript(rawTranscriptSegments, participantNames);
    const tasks = (tasksByMeeting.get(meeting.id) || []).map((task) =>
      buildWorkspaceTask(task, meeting, directory)
    );
    const overall = Number(meeting.overall_score || 0);
    const processingStatus =
      cleanNullable(meeting.processing_status) ||
      (isRawUploadStatus(meeting.status) ? 'pending-analysis' : 'ready');
    const audioUrl = cleanNullable(meeting.audio_storage_path || meeting.audio_url);
    const transcriptText =
      String(meeting.transcript_text || '').trim() ||
      String(meeting.transcript || '').trim() ||
      transcriptSegments.map((segment) => segment.text).join(' ');
    const summaryParagraph =
      meeting.summary_paragraph ||
      extractSummaryParagraph(meeting.summary_markdown) ||
      String(meeting.summary || '').trim() ||
      'Momentum processed this meeting using the V2 pipeline.';

    return {
      id: meeting.id,
      aiTitle:
        meeting.ai_title ||
        meeting.source_meeting_label ||
        meeting.title ||
        rawMetadata.meetingLabel ||
        'Meeting Summary',
      rawTitle:
        meeting.source_meeting_label ||
        meeting.ai_title ||
        meeting.title ||
        rawMetadata.meetingLabel ||
        'Google Meet upload',
      timeLabel: niceTimeFromDate(meeting.created_at),
      createdAt: meeting.created_at,
      source: meeting.source_platform || 'Google Meet',
      participants: participantNames,
      participantRoster,
      processingStatus,
      processingSummary: buildProcessingSummary(meeting),
      summaryParagraph,
      summaryBullets: extractSummaryBullets(meeting.summary_markdown),
      decisions: (decisionsByMeeting.get(meeting.id) || []).map((decision) => ({
        id: decision.id,
        text: decision.text,
        confidence: Number(decision.confidence || 0.7),
        sourceSnippet: decision.source_snippet || '',
      })),
      tasks,
      checklist: (checklistByMeeting.get(meeting.id) || []).map((item) => ({
        id: item.id,
        text: item.text,
        completed: Boolean(item.completed),
      })),
      meetingRisks: (risksByMeeting.get(meeting.id) || []).map((risk) => ({
        id: risk.id,
        type: risk.type,
        severity: risk.severity,
        message: risk.message,
      })),
      transcript: transcriptSegments,
      transcriptText,
      transcriptAttribution: syntheticTranscript ? 'unattributed' : inferTranscriptAttribution(transcriptSegments),
      transcriptNotice: syntheticTranscript
        ? 'Speaker names are not available for this recording yet, so Momentum is showing an unattributed transcript.'
        : '',
      audioUrl,
      score: {
        overall,
        clarity: Number(meeting.clarity_score || 0),
        ownership: Number(meeting.ownership_score || 0),
        execution: Number(meeting.execution_score || 0),
        color: scoreColor(overall),
      },
      rationale:
        meeting.score_rationale ||
        'Momentum analyzed this meeting using the richer V2 execution model.',
      isV2: true,
    };
  });

  const legacyTables = await getLegacyTableNames(supabase);
  const legacyMeetings = await loadLegacyRowsIfAvailable(supabase, legacyTables, meetingsRows || [], {
    workspaceId,
    workspaceProfileIds,
  });
  const allMeetings = [...meetings, ...legacyMeetings];
  const allTasks = allMeetings.flatMap((meeting) => meeting.tasks);

  return {
    meetings: allMeetings,
    tasks: allTasks,
    people: buildPeoplePool({
      meetings: allMeetings,
      tasks: allTasks,
      profiles: profileRows || [],
      membershipRows: membershipRows || [],
    }),
  };
}

async function loadLegacyRowsIfAvailable(supabase, legacyTables, v2Meetings, options = {}) {
  if (legacyTables.meetings !== 'old_meetings' || legacyTables.tasks !== 'old_tasks') {
    return [];
  }

  const [{ data: legacyMeetings, error: meetingsError }, { data: legacyTasks, error: tasksError }] = await Promise.all([
    supabase.from('old_meetings').select('*').order('created_at', { ascending: false }),
    supabase.from('old_tasks').select('*').order('created_at', { ascending: false }),
  ]);

  if (meetingsError || tasksError) {
    return [];
  }

  const representedLegacyIds = new Set(
    (Array.isArray(v2Meetings) ? v2Meetings : [])
      .map((meeting) => meeting.legacy_meeting_id)
      .filter(Boolean)
  );
  const workspaceId = String(options?.workspaceId || '').trim();
  const workspaceProfileIds = new Set(
    Array.from(options?.workspaceProfileIds || [])
      .map((profileId) => String(profileId || '').trim())
      .filter(Boolean)
  );

  return (legacyMeetings || [])
    .filter((meeting) => !representedLegacyIds.has(meeting.id))
    .filter((meeting) => {
      if (!workspaceId) {
        return true;
      }

      const status = String(meeting.status || '').trim().toLowerCase();
      if (status.startsWith('raw-uploaded:') || status.startsWith('audio-uploaded:')) {
        return true;
      }

      const summary = String(meeting.summary || '');
      if (summary.includes(`Workspace id: ${workspaceId}.`)) {
        return true;
      }

      const summaryMetadata = extractRawMeetingMetadata(meeting, []);
      const userId = String(meeting.user_id || summaryMetadata.userId || '').trim();
      if (userId && workspaceProfileIds.has(userId)) {
        return true;
      }

      const transcript = String(meeting.transcript || meeting.transcript_text || '').trim();
      const audioUrl = String(meeting.audio_url || meeting.audio_storage_path || '').trim();

      return Boolean(transcript || audioUrl);
    })
    .map((meeting) =>
      transformLegacyMeeting(
        meeting,
        (legacyTasks || []).filter((task) => task.meeting_id === meeting.id)
      )
    )
    .filter(Boolean);
}

async function loadWorkspaceDirectory(supabase, workspaceId) {
  if (!workspaceId) {
    return [];
  }

  const [{ data: membershipRows, error: membershipError }, { data: profileRows, error: profilesError }] =
    await Promise.all([
      supabase
        .from('workspace_members')
        .select('profile_id, role')
        .eq('workspace_id', workspaceId),
      supabase
        .from('profiles')
        .select('id, email, full_name, workspace_id')
        .eq('workspace_id', workspaceId),
    ]);

  if (membershipError) {
    throw membershipError;
  }

  if (profilesError) {
    throw profilesError;
  }

  const membershipByProfileId = new Map(
    (membershipRows || []).map((member) => [member.profile_id, member])
  );
  return createPersonDirectory(profileRows || [], membershipByProfileId);
}

async function findScopedMeetingRow(supabase, meetingId, workspaceId) {
  if (!meetingId) {
    return null;
  }

  let query = supabase.from('meetings').select('id, workspace_id').eq('id', meetingId);
  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  }

  const { data } = await query.maybeSingle();
  return data || null;
}

async function findV2TaskRow(supabase, taskId, workspaceId) {
  if (!taskId) {
    return null;
  }

  const { data } = await supabase
    .from('meeting_tasks')
    .select('id, meeting_id, meetings!inner(id, workspace_id)')
    .eq('id', taskId)
    .eq('meetings.workspace_id', workspaceId || '')
    .maybeSingle();

  return data || null;
}

function buildParticipantRosterEntry(row, directory) {
  const displayName = cleanParticipantDisplayName(row?.display_name);
  if (!displayName) {
    return null;
  }

  const directMatch =
    row?.matched_profile_id
      ? directory.find((record) => record.id === row.matched_profile_id)
      : null;
  const inferredMatch =
    directMatch || matchDirectoryPerson(displayName, directory);
  const matchedRecord =
    directMatch || (inferredMatch?.status === 'matched' ? inferredMatch.record : null);

  return {
    id: row.id,
    displayName,
    profileId: matchedRecord?.id || null,
    profileName: matchedRecord?.displayName || '',
    email: matchedRecord?.email || '',
    role: matchedRecord?.role || '',
    matchStatus: matchedRecord ? 'matched' : inferredMatch?.status === 'ambiguous' ? 'ambiguous' : 'unmatched',
    confidence:
      matchedRecord
        ? Number((row.confidence || inferredMatch?.confidence || 0.9).toFixed(3))
        : inferredMatch?.confidence || Number(row.confidence || 0),
  };
}

function buildWorkspaceTask(task, meeting, directory) {
  const directOwnerMatch =
    task?.owner_profile_id
      ? directory.find((record) => record.id === task.owner_profile_id)
      : null;
  const inferredOwnerMatch =
    directOwnerMatch || matchDirectoryPerson(task?.owner_name, directory);
  const matchedOwner =
    directOwnerMatch || (inferredOwnerMatch?.status === 'matched' ? inferredOwnerMatch.record : null);

  return {
    id: task.id,
    meetingId: meeting.id,
    sourceMeetingId: meeting.id,
    sourceMeeting: meeting.ai_title || meeting.source_meeting_label || 'Meeting Summary',
    title: task.title,
    owner: matchedOwner?.displayName || task.owner_name || '',
    ownerEmail: matchedOwner?.email || '',
    ownerProfileId: matchedOwner?.id || null,
    ownerSource: matchedOwner ? 'workspace' : task.owner_name ? 'meeting-participant' : 'unassigned',
    dueDate: task.due_date_label || task.due_date || '',
    status: normalizeStatus(task.status, task.needs_review),
    confidence: Number(task.confidence || 0.7),
    needsReview: Boolean(task.needs_review),
    sourceSnippet: task.source_snippet || '',
    isEditable: true,
  };
}

function normalizeTranscriptSegments(segments, participantNames = []) {
  const syntheticTranscript = isSyntheticTranscript(segments, participantNames);

  return (Array.isArray(segments) ? segments : []).map((segment, index) => ({
    id: segment.id,
    time: formatTranscriptTime(segment.started_at_seconds),
    speaker: syntheticTranscript ? '' : String(segment.speaker || '').trim(),
    speakerLabel: syntheticTranscript
      ? 'Speaker attribution unavailable'
      : String(segment.speaker || '').trim() || 'Speaker unavailable',
    text: segment.text,
    attribution: syntheticTranscript
      ? 'unattributed'
      : String(segment.speaker || '').trim()
        ? 'speaker-attributed'
        : 'unattributed',
    startedAtSeconds: Number(segment.started_at_seconds || index * 20),
    endedAtSeconds: Number(segment.ended_at_seconds || (index * 20) + 18),
  }));
}

function isSyntheticTranscript(segments, participantNames = []) {
  const rows = Array.isArray(segments) ? segments : [];
  if (!rows.length) {
    return false;
  }

  return rows.every((segment, index) => {
    const expectedStart = Number((index * 22.5).toFixed(2));
    const expectedEnd = Number((((index + 1) * 22.5) - 1).toFixed(2));
    const startedAt = Number(segment.started_at_seconds || 0);
    const endedAt = Number(segment.ended_at_seconds || 0);
    const speaker = String(segment.speaker || '').trim();
    const speakerLooksSynthetic =
      !speaker ||
      speaker.startsWith('Speaker ') ||
      participantNames.includes(speaker);

    return (
      speakerLooksSynthetic &&
      Math.abs(startedAt - expectedStart) < 0.01 &&
      Math.abs(endedAt - expectedEnd) < 0.01
    );
  });
}

function inferTranscriptAttribution(transcriptSegments = []) {
  return transcriptSegments.some((segment) => segment.attribution === 'speaker-attributed')
    ? 'speaker-attributed'
    : 'unattributed';
}

function buildPeoplePool({ meetings, tasks, profiles = [], membershipRows = [] }) {
  const people = new Map();
  const membershipByProfileId = new Map(
    (membershipRows || []).map((membership) => [membership.profile_id, membership])
  );

  (profiles || []).forEach((profile) => {
    const displayName = displayNameForProfile(profile);
    people.set(`profile:${profile.id}`, {
      id: profile.id,
      profileId: profile.id,
      displayName,
      email: String(profile.email || '').trim(),
      role: membershipByProfileId.get(profile.id)?.role || 'member',
      source: 'workspace',
      isWorkspaceMember: true,
      meetingCount: 0,
      ownedTaskCount: 0,
      openTaskCount: 0,
    });
  });

  (meetings || []).forEach((meeting) => {
    (meeting.participantRoster || []).forEach((participant) => {
      const key = participant.profileId
        ? `profile:${participant.profileId}`
        : `guest:${normalizePersonName(participant.displayName)}`;

      if (!people.has(key)) {
        people.set(key, {
          id: key,
          profileId: null,
          displayName: participant.displayName,
          email: participant.email || '',
          role: participant.role || 'guest',
          source: 'meeting',
          isWorkspaceMember: false,
          meetingCount: 0,
          ownedTaskCount: 0,
          openTaskCount: 0,
        });
      }

      const current = people.get(key);
      current.meetingCount += 1;
    });
  });

  (tasks || []).forEach((task) => {
    if (!task.owner) {
      return;
    }

    const key = task.ownerProfileId
      ? `profile:${task.ownerProfileId}`
      : `guest:${normalizePersonName(task.owner)}`;

    if (!people.has(key)) {
      people.set(key, {
        id: key,
        profileId: null,
        displayName: task.owner,
        email: task.ownerEmail || '',
        role: task.ownerSource === 'workspace' ? 'member' : 'guest',
        source: task.ownerSource === 'workspace' ? 'workspace' : 'meeting',
        isWorkspaceMember: task.ownerSource === 'workspace',
        meetingCount: 0,
        ownedTaskCount: 0,
        openTaskCount: 0,
      });
    }

    const current = people.get(key);
    current.ownedTaskCount += 1;
    if (task.status !== 'done') {
      current.openTaskCount += 1;
    }
  });

  return Array.from(people.values()).sort((left, right) => {
    if (right.ownedTaskCount !== left.ownedTaskCount) {
      return right.ownedTaskCount - left.ownedTaskCount;
    }

    if (right.meetingCount !== left.meetingCount) {
      return right.meetingCount - left.meetingCount;
    }

    return left.displayName.localeCompare(right.displayName);
  });
}

function buildPeoplePoolFromMeetings(meetings = []) {
  const people = new Map();

  meetings.forEach((meeting) => {
    (meeting.participants || []).forEach((name) => {
      const normalized = normalizePersonName(name);
      if (!normalized) {
        return;
      }

      if (!people.has(normalized)) {
        people.set(normalized, {
          id: `guest:${normalized}`,
          profileId: null,
          displayName: name,
          email: '',
          role: 'guest',
          source: 'meeting',
          isWorkspaceMember: false,
          meetingCount: 0,
          ownedTaskCount: 0,
          openTaskCount: 0,
        });
      }

      people.get(normalized).meetingCount += 1;
    });

    (meeting.tasks || []).forEach((task) => {
      if (!task.owner) {
        return;
      }

      const normalized = normalizePersonName(task.owner);
      if (!normalized) {
        return;
      }

      if (!people.has(normalized)) {
        people.set(normalized, {
          id: `guest:${normalized}`,
          profileId: null,
          displayName: task.owner,
          email: '',
          role: 'guest',
          source: 'meeting',
          isWorkspaceMember: false,
          meetingCount: 0,
          ownedTaskCount: 0,
          openTaskCount: 0,
        });
      }

      const current = people.get(normalized);
      current.ownedTaskCount += 1;
      if (task.status !== 'done') {
        current.openTaskCount += 1;
      }
    });
  });

  return Array.from(people.values()).sort((left, right) => right.ownedTaskCount - left.ownedTaskCount);
}

function buildAnalytics(meetings, tasks, people = []) {
  const readyMeetings = meetings.filter((meeting) => meeting.processingStatus === 'ready');
  const pendingTasks = tasks.filter((task) => task.status !== 'done');
  const completedTasks = tasks.filter((task) => task.status === 'done');
  const avgScore =
    readyMeetings.length > 0
      ? Math.round(
          readyMeetings.reduce((total, meeting) => total + Number(meeting.score?.overall || 0), 0) /
            readyMeetings.length
        )
      : 0;
  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
  const riskTally = new Map();
  const ownerTally = new Map();

  meetings.forEach((meeting) => {
    (meeting.meetingRisks || []).forEach((risk) => {
      riskTally.set(risk.type, (riskTally.get(risk.type) || 0) + 1);
    });
  });

  tasks.forEach((task) => {
    const owner = task.owner || 'Unassigned';
    ownerTally.set(owner, (ownerTally.get(owner) || 0) + 1);
  });

  const scoreTrend = readyMeetings
    .slice()
    .sort((left, right) => new Date(left.createdAt || 0) - new Date(right.createdAt || 0))
    .slice(-8)
    .map((meeting) => ({
      id: meeting.id,
      label: meeting.aiTitle,
      score: Number(meeting.score?.overall || 0),
      color: scoreColor(Number(meeting.score?.overall || 0)),
    }));

  return {
    metrics: [
      { label: 'Meetings processed', value: String(readyMeetings.length), meta: `${meetings.length} total in workspace` },
      { label: 'Average meeting score', value: String(avgScore), meta: avgScore >= 80 ? 'Healthy execution quality' : 'Room to tighten ownership' },
      { label: 'Pending tasks', value: String(pendingTasks.length), meta: `${tasks.filter((task) => task.needsReview).length} need review` },
      { label: 'Completion rate', value: `${completionRate}%`, meta: `${completedTasks.length} tasks closed` },
    ],
    scoreTrend,
    topRisks: Array.from(riskTally.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 5),
    ownerLoad: Array.from(ownerTally.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 6),
    peopleTracked: people.length,
    matchedTaskOwners: tasks.filter((task) => task.ownerProfileId).length,
    speakerAttributedMeetings: meetings.filter((meeting) => meeting.transcriptAttribution === 'speaker-attributed').length,
    meetingDebt: meetings.reduce((total, meeting) => total + (meeting.meetingRisks?.length || 0), 0),
    unassignedTasks: tasks.filter((task) => !task.owner).length,
    missingDeadlines: tasks.filter((task) => !task.dueDate).length,
  };
}

function buildProcessingSummary(meeting) {
  if (isRawUploadStatus(meeting?.status)) {
    return 'Recording is stored, but transcription and extraction have not completed yet.';
  }

  if (meeting.processing_error) {
    return meeting.processing_error;
  }

  if (meeting.processing_status === 'uploaded' || meeting.processing_status === 'pending-analysis') {
    return 'Recording is stored, but transcription and extraction have not completed yet.';
  }

  if (meeting.processing_status === 'failed') {
    return 'Momentum hit a processing problem and this meeting should be retried.';
  }

  return 'Momentum is ready.';
}

function formatTranscriptTime(seconds) {
  const numeric = Number(seconds || 0);
  const minutes = Math.floor(numeric / 60);
  const remainder = Math.floor(numeric % 60);
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function extractSummaryParagraph(markdown) {
  return String(markdown || '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('- ')) || '';
}

function extractSummaryBullets(markdown) {
  return String(markdown || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
    .slice(0, 5);
}

function niceTimeFromDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return 'Recent meeting';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function groupBy(items, key) {
  const map = new Map();
  items.forEach((item) => {
    const value = item[key];
    const current = map.get(value) || [];
    current.push(item);
    map.set(value, current);
  });
  return map;
}

function splitDueDateFields(value) {
  const dueDateLabel = cleanNullable(value);
  if (!dueDateLabel) {
    return { dueDate: null, dueDateLabel: null };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dueDateLabel)) {
    return { dueDate: dueDateLabel, dueDateLabel };
  }

  const withYear = /\b\d{4}\b/.test(dueDateLabel) ? dueDateLabel : `${dueDateLabel}, ${new Date().getUTCFullYear()}`;
  const parsed = Date.parse(withYear);

  return {
    dueDate: Number.isNaN(parsed) ? null : new Date(parsed).toISOString().slice(0, 10),
    dueDateLabel,
  };
}

function normalizeLegacyTaskStatus(status) {
  if (status === 'done') {
    return 'done';
  }

  if (status === 'in-progress') {
    return 'in-progress';
  }

  if (status === 'needs-review') {
    return 'needs-review';
  }

  return 'todo';
}

function cleanNullable(value) {
  const text = String(value || '').trim();
  return text || null;
}
