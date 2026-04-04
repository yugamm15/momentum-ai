import {
  normalizeStatus,
  scoreColor,
  transformLegacyMeeting,
} from '../../src/lib/meeting-transforms.js';
import { getLegacyTableNames } from './legacy-tables.js';

let schemaModePromise = null;

export async function getUnifiedWorkspaceSnapshot(supabase) {
  try {
    const mode = await detectSchemaMode(supabase);
    const liveSnapshot = mode === 'v2' ? await loadV2Snapshot(supabase) : await loadLegacySnapshot(supabase);
    const meetings = liveSnapshot.meetings;
    const tasks = liveSnapshot.tasks;

    return {
      meetings,
      tasks,
      liveMeetings: liveSnapshot.meetings,
      liveTasks: liveSnapshot.tasks,
      analytics: buildAnalytics(meetings, tasks),
      source: liveSnapshot.meetings.length > 0 ? 'live' : 'empty',
      mode,
    };
  } catch (error) {
    return {
      meetings: [],
      tasks: [],
      liveMeetings: [],
      liveTasks: [],
      analytics: buildAnalytics([], []),
      source: 'error',
      mode: 'fallback',
      error: error.message || 'Momentum could not build the workspace snapshot.',
    };
  }
}

export async function updateTaskRecord(supabase, taskId, updates) {
  const mode = await detectSchemaMode(supabase);

  if (mode === 'v2') {
    const payload = {};

    if (Object.prototype.hasOwnProperty.call(updates, 'title')) {
      payload.title = updates.title;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'owner')) {
      payload.owner_name = cleanNullable(updates.owner);
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
    const dueDateFields = splitDueDateFields(task.dueDate);
    const { error } = await supabase.from('meeting_tasks').insert({
      meeting_id: task.meetingId,
      title: task.title,
      owner_name: cleanNullable(task.owner),
      due_date: dueDateFields.dueDate,
      due_date_label: dueDateFields.dueDateLabel,
      status: normalizeStatus(task.status, !task.owner || !task.dueDate),
      needs_review: !task.owner || !task.dueDate,
      confidence: 0.72,
      source_snippet: 'Manually created in Momentum.',
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
  };
}

async function loadV2Snapshot(supabase) {
  const [
    { data: meetingsRows, error: meetingsError },
    { data: participantRows, error: participantsError },
    { data: taskRows, error: tasksError },
    { data: decisionRows, error: decisionsError },
    { data: checklistRows, error: checklistError },
    { data: riskRows, error: risksError },
    { data: transcriptRows, error: transcriptError },
  ] = await Promise.all([
    supabase.from('meetings').select('*').order('created_at', { ascending: false }),
    supabase.from('meeting_participants').select('*'),
    supabase.from('meeting_tasks').select('*').order('created_at', { ascending: false }),
    supabase.from('meeting_decisions').select('*'),
    supabase.from('meeting_checklist_items').select('*'),
    supabase.from('meeting_risk_flags').select('*'),
    supabase.from('meeting_transcript_segments').select('*').order('segment_index', { ascending: true }),
  ]);

  const firstError = [
    meetingsError,
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

  const participantsByMeeting = groupBy(participantRows || [], 'meeting_id');
  const tasksByMeeting = groupBy(taskRows || [], 'meeting_id');
  const decisionsByMeeting = groupBy(decisionRows || [], 'meeting_id');
  const checklistByMeeting = groupBy(checklistRows || [], 'meeting_id');
  const risksByMeeting = groupBy(riskRows || [], 'meeting_id');
  const transcriptByMeeting = groupBy(transcriptRows || [], 'meeting_id');

  const meetings = (meetingsRows || []).map((meeting) => {
    const participants = (participantsByMeeting.get(meeting.id) || []).map((item) => item.display_name);
    const transcript = (transcriptByMeeting.get(meeting.id) || []).map((segment) => ({
      id: segment.id,
      time: formatTranscriptTime(segment.started_at_seconds),
      speaker: segment.speaker || 'Speaker',
      text: segment.text,
    }));
    const tasks = (tasksByMeeting.get(meeting.id) || []).map((task) => ({
      id: task.id,
      meetingId: meeting.id,
      sourceMeetingId: meeting.id,
      sourceMeeting: meeting.ai_title || meeting.source_meeting_label || 'Meeting Summary',
      title: task.title,
      owner: task.owner_name || '',
      dueDate: task.due_date_label || task.due_date || '',
      status: normalizeStatus(task.status, task.needs_review),
      confidence: Number(task.confidence || 0.7),
      needsReview: Boolean(task.needs_review),
      sourceSnippet: task.source_snippet || '',
      isEditable: true,
    }));
    const overall = Number(meeting.overall_score || 0);

    return {
      id: meeting.id,
      aiTitle: meeting.ai_title || meeting.source_meeting_label || 'Meeting Summary',
      rawTitle: meeting.source_meeting_label || meeting.ai_title || 'Google Meet upload',
      timeLabel: niceTimeFromDate(meeting.created_at),
      createdAt: meeting.created_at,
      source: meeting.source_platform || 'Google Meet',
      participants,
      processingStatus: meeting.processing_status || 'ready',
      processingSummary: buildProcessingSummary(meeting),
      summaryParagraph:
        meeting.summary_paragraph ||
        extractSummaryParagraph(meeting.summary_markdown) ||
        'Momentum processed this meeting using the V2 pipeline.',
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
      transcript,
      transcriptText: transcript.map((segment) => segment.text).join(' '),
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
  const legacyMeetings = await loadLegacyRowsIfAvailable(supabase, legacyTables, meetingsRows || []);

  return {
    meetings: [...meetings, ...legacyMeetings],
    tasks: [...meetings.flatMap((meeting) => meeting.tasks), ...legacyMeetings.flatMap((meeting) => meeting.tasks)],
  };
}

async function loadLegacyRowsIfAvailable(supabase, legacyTables, v2Meetings) {
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

  return (legacyMeetings || [])
    .filter((meeting) => !representedLegacyIds.has(meeting.id))
    .map((meeting) =>
      transformLegacyMeeting(
        meeting,
        (legacyTasks || []).filter((task) => task.meeting_id === meeting.id)
      )
    )
    .filter(Boolean);
}

function buildAnalytics(meetings, tasks) {
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
    meetingDebt: meetings.reduce((total, meeting) => total + (meeting.meetingRisks?.length || 0), 0),
    unassignedTasks: tasks.filter((task) => !task.owner).length,
    missingDeadlines: tasks.filter((task) => !task.dueDate).length,
  };
}

function buildProcessingSummary(meeting) {
  if (meeting.processing_error) {
    return meeting.processing_error;
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
