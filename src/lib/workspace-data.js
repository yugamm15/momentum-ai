import { apiUrl } from './api';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import {
  createSeededWorkspaceSnapshot,
  findSeededAnswer,
  scoreColor,
  transformLegacyMeeting,
} from './meeting-transforms';

function buildAnalytics(meetings, tasks) {
  const readyMeetings = meetings.filter((meeting) => meeting.processingStatus === 'ready');
  const pendingTasks = tasks.filter((task) => task.status !== 'done');
  const completedTasks = tasks.filter((task) => task.status === 'done');
  const avgScore =
    readyMeetings.length > 0
      ? Math.round(readyMeetings.reduce((total, meeting) => total + Number(meeting.score?.overall || 0), 0) / readyMeetings.length)
      : 0;
  const completionRate =
    tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
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

export async function fetchWorkspaceSnapshot() {
  const seeded = createSeededWorkspaceSnapshot();

  const apiSnapshot = await fetchWorkspaceSnapshotFromApi();
  if (apiSnapshot) {
    return apiSnapshot;
  }

  if (!isSupabaseConfigured) {
    return {
      meetings: seeded.meetings,
      tasks: seeded.tasks,
      liveMeetings: [],
      liveTasks: [],
      analytics: buildAnalytics(seeded.meetings, seeded.tasks),
      source: 'seeded',
    };
  }

  try {
    const supabase = getSupabaseClient();
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

    const transformedLiveMeetings = (liveMeetings || []).map((meeting) =>
      transformLegacyMeeting(
        meeting,
        (liveTasks || []).filter((task) => task.meeting_id === meeting.id)
      )
    );

    const transformedLiveTasks = transformedLiveMeetings.flatMap((meeting) => meeting.tasks);
    const meetings = [...transformedLiveMeetings, ...seeded.meetings];
    const tasks = [...transformedLiveTasks, ...seeded.tasks];

    return {
      meetings,
      tasks,
      liveMeetings: transformedLiveMeetings,
      liveTasks: transformedLiveTasks,
      analytics: buildAnalytics(meetings, tasks),
      source: transformedLiveMeetings.length > 0 ? 'mixed' : 'seeded',
    };
  } catch (error) {
    return {
      meetings: seeded.meetings,
      tasks: seeded.tasks,
      liveMeetings: [],
      liveTasks: [],
      analytics: buildAnalytics(seeded.meetings, seeded.tasks),
      source: 'seeded-fallback',
      error: error.message || 'Momentum could not load the live workspace snapshot.',
    };
  }
}

export async function updateWorkspaceTask(taskId, updates) {
  const apiResult = await updateWorkspaceTaskThroughApi(taskId, updates);
  if (apiResult) {
    return apiResult;
  }

  if (!isSupabaseConfigured) {
    return { ok: true, mode: 'demo' };
  }

  const supabase = getSupabaseClient();
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
    payload.status = updates.status;
  }

  const { error } = await supabase.from('tasks').update(payload).eq('id', taskId);
  if (error) {
    throw error;
  }

  return { ok: true, mode: 'live' };
}

export async function createWorkspaceTask(task) {
  const apiResult = await createWorkspaceTaskThroughApi(task);
  if (apiResult) {
    return apiResult;
  }

  if (!isSupabaseConfigured) {
    return { ok: true, mode: 'demo' };
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from('tasks').insert({
    meeting_id: task.meetingId,
    title: task.title,
    assignee: task.owner,
    deadline: task.dueDate,
    status: task.status || 'pending',
  });

  if (error) {
    throw error;
  }

  return { ok: true, mode: 'live' };
}

export async function askMeetingQuestion(meeting, question) {
  if (meeting?.isSeeded) {
    return findSeededAnswer(meeting, question);
  }

  const response = await fetch(apiUrl('/api/ask-meeting-question'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      meetingId: meeting.id,
      question,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Momentum could not answer that meeting question.');
  }

  return payload.answer;
}

async function fetchWorkspaceSnapshotFromApi() {
  try {
    const response = await fetch(apiUrl('/api/workspace-snapshot'), {
      headers: {
        'Cache-Control': 'no-store',
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null);
    if (!payload?.meetings || !payload?.tasks) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

async function updateWorkspaceTaskThroughApi(taskId, updates) {
  try {
    const response = await fetch(apiUrl('/api/tasks'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        taskId,
        ...updates,
      }),
    });

    if (!response.ok) {
      return null;
    }

    return { ok: true, mode: 'api' };
  } catch {
    return null;
  }
}

async function createWorkspaceTaskThroughApi(task) {
  try {
    const response = await fetch(apiUrl('/api/tasks'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(task),
    });

    if (!response.ok) {
      return null;
    }

    return { ok: true, mode: 'api' };
  } catch {
    return null;
  }
}
