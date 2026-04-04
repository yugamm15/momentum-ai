import { apiFetch } from './api';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import {
  scoreColor,
  transformLegacyMeeting,
} from './meeting-transforms';

const participantNoisePatterns = [
  /\bclose\b/i,
  /\bdevice\b/i,
  /\bdevices\b/i,
  /\bmic\b/i,
  /\bmicrophone\b/i,
  /\bcamera\b/i,
  /\bvideocam\b/i,
  /\bmute\b/i,
  /\bunmute\b/i,
  /\bleft side panel\b/i,
  /\bside panel\b/i,
  /\bmeeting details\b/i,
  /\bmeeting tools\b/i,
  /\bmore actions\b/i,
  /\bhost controls\b/i,
  /\bcaptions\b/i,
  /\bapps\b/i,
  /\bpeople\b/i,
  /\bparticipants\b/i,
  /\bsettings\b/i,
  /\bchat\b/i,
  /\braise hand\b/i,
  /\bleave meeting\b/i,
  /\bend call\b/i,
];
const genericMeetingTitles = new Set([
  'meeting summary',
  'google meet upload',
  'untitled execution review',
  'audio captured',
  'audio captured for meet session',
  'info',
  'infoinfo',
]);
const transcriptSummaryStopWords = new Set([
  'the',
  'and',
  'that',
  'this',
  'with',
  'from',
  'have',
  'were',
  'been',
  'they',
  'them',
  'their',
  'then',
  'when',
  'what',
  'where',
  'which',
  'would',
  'could',
  'should',
  'about',
  'into',
  'just',
  'your',
  'ours',
  'ourselves',
  'our',
  'also',
  'after',
  'before',
  'because',
  'while',
  'there',
  'here',
  'each',
  'only',
  'more',
  'most',
  'very',
  'than',
  'will',
  'shall',
  'might',
  'must',
  'need',
  'needed',
  'needs',
  'some',
  'any',
  'everyone',
  'someone',
  'somebody',
  'anyone',
  'anything',
  'meeting',
  'meetings',
  'google',
  'audio',
  'transcript',
  'momentum',
]);
const transcriptSummaryNoiseWords = new Set([
  'yeah',
  'yep',
  'okay',
  'ok',
  'hello',
  'hi',
  'thanks',
  'thank',
  'please',
  'right',
  'alright',
  'cool',
  'sure',
  'hmm',
  'um',
  'uh',
  'like',
  'really',
  'actually',
  'basically',
  'literally',
  'gonna',
  'wanna',
  'call',
  'session',
  'discussion',
]);

function buildAnalytics(meetings, tasks, people = []) {
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
    peopleTracked: people.length,
    matchedTaskOwners: tasks.filter((task) => task.ownerProfileId).length,
    speakerAttributedMeetings: meetings.filter((meeting) => meeting.transcriptAttribution === 'speaker-attributed').length,
    meetingDebt: meetings.reduce((total, meeting) => total + (meeting.meetingRisks?.length || 0), 0),
    unassignedTasks: tasks.filter((task) => !task.owner).length,
    missingDeadlines: tasks.filter((task) => !task.dueDate).length,
  };
}

export async function fetchWorkspaceSnapshot() {
  const apiSnapshot = await fetchWorkspaceSnapshotFromApi();
  if (apiSnapshot) {
    return apiSnapshot;
  }

  if (!isSupabaseConfigured) {
    return {
      meetings: [],
      tasks: [],
      people: [],
      liveMeetings: [],
      liveTasks: [],
      analytics: buildAnalytics([], [], []),
      source: 'empty',
      error: 'Supabase is not configured, so no real workspace data can be loaded yet.',
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

    const transformedLiveMeetings = (liveMeetings || [])
      .map((meeting) =>
        transformLegacyMeeting(
          meeting,
          (liveTasks || []).filter((task) => task.meeting_id === meeting.id)
        )
      )
      .filter(Boolean);

    const transformedLiveTasks = transformedLiveMeetings.flatMap((meeting) => meeting.tasks);
    const meetings = transformedLiveMeetings;
    const tasks = transformedLiveTasks;

    return {
      meetings,
      tasks,
      people: buildFallbackPeople(meetings, tasks),
      liveMeetings: transformedLiveMeetings,
      liveTasks: transformedLiveTasks,
      analytics: buildAnalytics(meetings, tasks, buildFallbackPeople(meetings, tasks)),
      source: transformedLiveMeetings.length > 0 ? 'live' : 'empty',
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
    throw new Error('Supabase is not configured, so tasks cannot be updated yet.');
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
    throw new Error('Supabase is not configured, so tasks cannot be created yet.');
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

export async function updateWorkspaceMeeting(meetingId, title) {
  const normalizedMeetingId = String(meetingId || '').trim();
  const normalizedTitle = String(title || '').trim();

  if (!normalizedMeetingId) {
    throw new Error('meetingId is required to update a meeting title.');
  }

  if (!normalizedTitle) {
    throw new Error('Meeting title cannot be empty.');
  }

  const apiResult = await updateWorkspaceMeetingThroughApi(normalizedMeetingId, normalizedTitle);
  if (apiResult) {
    return apiResult;
  }

  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured, so meetings cannot be updated yet.');
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('meetings')
    .update({
      title: normalizedTitle,
    })
    .eq('id', normalizedMeetingId);

  if (error) {
    throw error;
  }

  return { ok: true, mode: 'live' };
}

export async function deleteWorkspaceMeeting(meetingId) {
  const normalizedMeetingId = String(meetingId || '').trim();
  if (!normalizedMeetingId) {
    throw new Error('meetingId is required to delete a meeting.');
  }

  const apiResult = await deleteWorkspaceMeetingThroughApi(normalizedMeetingId);
  if (apiResult) {
    return apiResult;
  }

  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured, so meetings cannot be deleted yet.');
  }

  const supabase = getSupabaseClient();
  const [{ error: taskError }, { error: meetingError }] = await Promise.all([
    supabase.from('tasks').delete().eq('meeting_id', normalizedMeetingId),
    supabase.from('meetings').delete().eq('id', normalizedMeetingId),
  ]);

  if (taskError) {
    throw taskError;
  }

  if (meetingError) {
    throw meetingError;
  }

  return { ok: true, mode: 'live' };
}

export async function updateWorkspaceParticipant({
  meetingId,
  participantId,
  currentName,
  displayName,
  removeParticipant = false,
}) {
  const normalizedMeetingId = String(meetingId || '').trim();
  if (!normalizedMeetingId) {
    throw new Error('meetingId is required to update a participant.');
  }

  const apiResult = await updateWorkspaceParticipantThroughApi({
    meetingId: normalizedMeetingId,
    participantId,
    currentName,
    displayName,
    removeParticipant,
  });

  if (!apiResult) {
    throw new Error('Participant updates require API support in this environment.');
  }

  return apiResult;
}

export async function askMeetingQuestion(meeting, question) {
  const response = await apiFetch('/api/ask-meeting-question', {
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

  return normalizeMeetingAnswer(payload.answer);
}

export async function processStoredMeeting(meetingId) {
  const response = await apiFetch('/api/process-stored-meeting', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ meetingId }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Momentum could not start analysis for this stored recording.');
  }

  return payload;
}

function normalizeMeetingAnswer(answer) {
  if (typeof answer === 'string') {
    return {
      text: answer,
      support: 'partial',
      note: '',
      evidence: [],
    };
  }

  const normalizedEvidence = (Array.isArray(answer?.evidence) ? answer.evidence : [])
    .map((entry, index) => ({
      id: entry?.id || `evidence-${index + 1}`,
      speaker: String(entry?.speaker || '').trim(),
      time: String(entry?.time || '').trim(),
      text: String(entry?.text || '').trim(),
    }))
    .filter((entry) => entry.text);

  return {
    text: String(answer?.text || '').trim() || 'The transcript does not clearly support an answer to that question.',
    support: String(answer?.support || '').trim() || 'partial',
    note: String(answer?.note || '').trim(),
    evidence: normalizedEvidence,
  };
}

async function fetchWorkspaceSnapshotFromApi() {
  try {
    const response = await apiFetch('/api/workspace-snapshot', {
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

    return normalizeApiSnapshot(payload);
  } catch {
    return null;
  }
}

function normalizeApiSnapshot(payload) {
  const meetings = (Array.isArray(payload.meetings) ? payload.meetings : []).map((meeting) =>
    normalizeApiMeeting(meeting)
  );
  const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  const people = normalizeApiPeople(payload.people);

  return {
    ...payload,
    meetings,
    tasks,
    people,
    liveMeetings: meetings,
    liveTasks: tasks,
    analytics: buildAnalytics(meetings, tasks, people),
  };
}

function normalizeApiMeeting(meeting) {
  const rosterByKey = new Map();

  (Array.isArray(meeting?.participantRoster) ? meeting.participantRoster : []).forEach((participant, index) => {
    const displayName = cleanParticipantDisplayName(participant?.displayName);
    if (!displayName) {
      return;
    }

    const key = normalizeParticipantKey(displayName);
    if (!key) {
      return;
    }

    if (!rosterByKey.has(key)) {
      rosterByKey.set(key, {
        id: participant?.id || `${meeting?.id || 'meeting'}-participant-${index + 1}`,
        displayName,
        profileId: participant?.profileId || null,
        profileName: participant?.profileName || '',
        email: participant?.email || '',
        role: participant?.role || 'guest',
        matchStatus: participant?.matchStatus || 'unmatched',
        confidence: Number(participant?.confidence || 0.68),
      });
    }
  });

  const participants = dedupeParticipantNames([
    ...(Array.isArray(meeting?.participants) ? meeting.participants : []),
    ...Array.from(rosterByKey.values()).map((participant) => participant.displayName),
  ]);

  const participantRoster =
    rosterByKey.size > 0
      ? Array.from(rosterByKey.values())
      : participants.map((displayName, index) => ({
          id: `${meeting?.id || 'meeting'}-participant-fallback-${index + 1}`,
          displayName,
          profileId: null,
          profileName: '',
          email: '',
          role: 'guest',
          matchStatus: 'unmatched',
          confidence: 0.68,
        }));

  const createdAt = firstValidDateValue(
    meeting?.recordingStartedAt,
    meeting?.recording_started_at,
    meeting?.createdAt,
    meeting?.created_at
  );
  const localTimeLabel = formatMeetingTimeLabel(createdAt);
  const transcriptText = String(meeting?.transcriptText || '').trim();
  const summaryParagraph = buildDisplaySummaryParagraph({
    summaryParagraph: meeting?.summaryParagraph,
    transcriptText,
    decisions: meeting?.decisions,
    tasks: meeting?.tasks,
    participants,
    meetingCode: meeting?.sourceMeetingCode || meeting?.source_meeting_code,
    meetingLabel: meeting?.rawTitle,
  });
  const aiTitle = resolveMeetingTitle({
    candidates: [meeting?.aiTitle, meeting?.rawTitle],
    summaryParagraph,
    transcriptText,
    decisions: meeting?.decisions,
    tasks: meeting?.tasks,
    participants,
    meetingCode: meeting?.sourceMeetingCode || meeting?.source_meeting_code,
    meetingLabel: meeting?.rawTitle,
  });
  const rawTitle = pickFirstUsableLabel(meeting?.rawTitle, meeting?.aiTitle) || aiTitle;

  return {
    ...meeting,
    createdAt,
    participants,
    participantRoster,
    aiTitle,
    rawTitle,
    summaryParagraph,
    timeLabel: localTimeLabel || meeting?.timeLabel || 'Recent meeting',
  };
}

function normalizeApiPeople(people) {
  const unique = new Map();

  (Array.isArray(people) ? people : []).forEach((person, index) => {
    const displayName = cleanParticipantDisplayName(person?.displayName);
    if (!displayName) {
      return;
    }

    const key = person?.profileId
      ? `profile:${person.profileId}`
      : `guest:${normalizeParticipantKey(displayName)}`;
    if (!key || unique.has(key)) {
      return;
    }

    unique.set(key, {
      id: person?.id || `${key}-${index + 1}`,
      profileId: person?.profileId || null,
      displayName,
      email: person?.email || '',
      role: person?.role || 'guest',
      source: person?.source || 'meeting',
      isWorkspaceMember: Boolean(person?.isWorkspaceMember),
      meetingCount: Number(person?.meetingCount || 0),
      ownedTaskCount: Number(person?.ownedTaskCount || 0),
      openTaskCount: Number(person?.openTaskCount || 0),
    });
  });

  return Array.from(unique.values());
}

function dedupeParticipantNames(names = []) {
  const unique = new Map();

  (Array.isArray(names) ? names : []).forEach((name) => {
    const displayName = cleanParticipantDisplayName(name);
    if (!displayName) {
      return;
    }

    const key = normalizeParticipantKey(displayName);
    if (!key || unique.has(key)) {
      return;
    }

    unique.set(key, displayName);
  });

  return Array.from(unique.values());
}

function cleanParticipantDisplayName(value) {
  let text = String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[|/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text || text.includes('@') || /\d{4,}/.test(text)) {
    return '';
  }

  if (participantNoisePatterns.some((pattern) => pattern.test(text))) {
    return '';
  }

  const repeated = text.match(/^(.+?)\s*\1$/i);
  if (repeated?.[1]) {
    text = repeated[1].trim();
  }

  if (participantNoisePatterns.some((pattern) => pattern.test(text))) {
    return '';
  }

  return text;
}

function normalizeParticipantKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s'.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeComparableText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeTranscriptMirror(summaryText, transcriptText) {
  if (!summaryText || !transcriptText) {
    return false;
  }

  if (transcriptText.startsWith(summaryText) || summaryText.startsWith(transcriptText.slice(0, Math.min(120, transcriptText.length)))) {
    return true;
  }

  const summaryTokens = summaryText.split(' ').filter(Boolean);
  const transcriptTokens = transcriptText.split(' ').filter(Boolean).slice(0, summaryTokens.length);
  if (!summaryTokens.length || !transcriptTokens.length) {
    return false;
  }

  const positionalMatches = summaryTokens.reduce((count, token, index) => {
    return count + (token === transcriptTokens[index] ? 1 : 0);
  }, 0);

  if (positionalMatches / summaryTokens.length >= 0.72) {
    return true;
  }

  const transcriptTokenSet = new Set(transcriptText.split(' ').filter(Boolean));
  const summaryTokenSet = new Set(summaryTokens);
  const overlap = Array.from(summaryTokenSet).reduce((count, token) => {
    return count + (transcriptTokenSet.has(token) ? 1 : 0);
  }, 0) / summaryTokenSet.size;

  if (summaryTokens.length >= 18 && overlap >= 0.84) {
    return true;
  }

  return false;
}

function buildDisplaySummaryParagraph({
  summaryParagraph,
  transcriptText,
  decisions = [],
  tasks = [],
  participants = [],
  meetingCode = '',
  meetingLabel = '',
}) {
  const normalizedSummary = normalizeComparableText(summaryParagraph);
  const normalizedTranscript = normalizeComparableText(transcriptText);
  const summaryWordCount = normalizedSummary.split(' ').filter(Boolean).length;
  const lowSignal = isLowSignalContext({
    normalizedSummary,
    transcriptText,
    decisions,
    tasks,
  });

  if (
    normalizedSummary
    && !looksLikeTranscriptMirror(normalizedSummary, normalizedTranscript)
    && !isBoilerplateSummary(normalizedSummary)
    && summaryWordCount <= 52
    && !lowSignal
  ) {
    return String(summaryParagraph || '').trim();
  }

  const decisionText = (Array.isArray(decisions) ? decisions : [])
    .map((decision) => String(decision?.text || '').trim())
    .filter(Boolean)
    .slice(0, 2);
  if (decisionText.length > 0) {
    const lead = decisionText.join(' ');
    if ((Array.isArray(tasks) ? tasks : []).length > 0) {
      const taskCount = tasks.length;
      return `${lead} Momentum identified ${taskCount} follow-up action item${taskCount === 1 ? '' : 's'}.`;
    }

    return lead;
  }

  if ((Array.isArray(tasks) ? tasks : []).length > 0) {
    const taskPreview = tasks
      .map((task) => String(task?.title || '').trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(', ');
    return taskPreview
      ? `The team aligned on execution priorities, including ${taskPreview}. ${tasks.length} action item${tasks.length === 1 ? '' : 's'} were captured.`
      : `The team aligned on execution priorities and captured ${tasks.length} follow-up action item${tasks.length === 1 ? '' : 's'}.`;
  }

  if (lowSignal) {
    return buildLowSignalSummary({
      meetingCode,
      meetingLabel,
      participants,
      transcriptText,
    });
  }

  return buildContextualTranscriptSummary({
    transcriptText,
    participants,
    meetingCode,
    meetingLabel,
  });
}

function buildContextualTranscriptSummary({
  transcriptText = '',
  participants = [],
  meetingCode = '',
  meetingLabel = '',
}) {
  const topics = extractSummaryTopics(transcriptText, 3);
  const lead = participants.length > 1
    ? `${participants[0]} and ${participants[1]}`
    : participants[0] || 'The team';

  if (topics.length >= 2) {
    return `${lead} discussed ${joinTopicList(topics.slice(0, 3))} and aligned on immediate next steps.`;
  }

  if (topics.length === 1) {
    return `${lead} focused on ${topics[0]} and aligned on follow-up coordination.`;
  }

  const reference = String(meetingLabel || meetingCode || '').trim();
  if (reference) {
    return `The team reviewed updates around ${reference} and aligned on next steps.`;
  }

  return `${lead} exchanged updates and aligned on next steps during this meeting.`;
}

function extractSummaryTopics(text, maxTopics = 3) {
  const counts = new Map();
  const words = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  words.forEach((rawWord) => {
    const word = rawWord.replace(/^-+|-+$/g, '');
    if (!word || word.length < 4 || /^\d+$/.test(word)) {
      return;
    }

    if (transcriptSummaryStopWords.has(word) || transcriptSummaryNoiseWords.has(word)) {
      return;
    }

    counts.set(word, (counts.get(word) || 0) + 1);
  });

  const ranked = Array.from(counts.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      if (right[0].length !== left[0].length) {
        return right[0].length - left[0].length;
      }

      return left[0].localeCompare(right[0]);
    });

  const strong = ranked.filter(([, count]) => count >= 2);
  const source = strong.length > 0 ? strong : ranked;
  return source.slice(0, maxTopics).map(([topic]) => topic);
}

function joinTopicList(topics = []) {
  if (topics.length === 0) {
    return '';
  }

  if (topics.length === 1) {
    return topics[0];
  }

  if (topics.length === 2) {
    return `${topics[0]} and ${topics[1]}`;
  }

  return `${topics[0]}, ${topics[1]}, and ${topics[2]}`;
}

function isLowSignalContext({ normalizedSummary, transcriptText, decisions = [], tasks = [] }) {
  if ((Array.isArray(decisions) ? decisions : []).length > 0 || (Array.isArray(tasks) ? tasks : []).length > 0) {
    return false;
  }

  if (isLowSignalSummaryText(normalizedSummary)) {
    return true;
  }

  const words = String(transcriptText || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  const uniqueWords = new Set(words);
  return words.length < 14 || uniqueWords.size < 8;
}

function isLowSignalSummaryText(normalizedSummary) {
  const text = String(normalizedSummary || '');
  if (!text) {
    return false;
  }

  return [
    'too little clear speech',
    'weak transcript signal',
    'limited detail',
    'limited context',
    'not enough speech',
    'audio file',
    'high confidence executive summary',
  ].some((token) => text.includes(token));
}

function isBoilerplateSummary(normalizedSummary) {
  const templates = [
    'momentum captured this meeting and generated a concise executive summary from the available signal',
    'momentum processed this meeting using the v2 pipeline',
    'transcript processed successfully',
  ];

  return templates.some((template) => normalizedSummary === template);
}

function normalizeMeetingCode(value) {
  const match = String(value || '').toLowerCase().match(/[a-z]{3}-[a-z]{4}-[a-z]{3}/);
  return match ? match[0] : '';
}

function inferLowSignalNarrative(transcriptText) {
  const normalized = normalizeComparableText(transcriptText);
  if (!normalized) {
    return {
      title: 'Unclear Meeting Snippet',
      summary:
        'The transcript is extremely brief and mostly non-substantive, so clear discussion topics, decisions, or action items could not be confidently extracted.',
    };
  }

  const soundCheckSignals = [
    'sound check',
    'can you hear',
    'hear me',
    'mic check',
    'audio check',
    'testing',
    'test audio',
  ];
  if (soundCheckSignals.some((signal) => normalized.includes(signal))) {
    return {
      title: 'Meeting Start and Sound Check',
      summary:
        'This short meeting segment primarily consisted of a sound check at the beginning. No substantive discussion, decisions, or tasks were captured during this period.',
    };
  }

  return {
    title: 'Unclear Meeting Snippet',
    summary:
      'The transcript is extremely brief and mostly non-substantive, so clear discussion topics, decisions, or action items could not be confidently extracted.',
  };
}

function buildLowSignalTitle(meetingCode, transcriptText = '') {
  const narrative = inferLowSignalNarrative(transcriptText);
  if (narrative?.title) {
    return narrative.title;
  }

  const code = normalizeMeetingCode(meetingCode);
  return code ? `Meeting ${code}` : 'Meeting';
}

function buildLowSignalSummary({ meetingCode = '', meetingLabel = '', participants = [], transcriptText = '' }) {
  const narrative = inferLowSignalNarrative(transcriptText);
  if (narrative?.summary) {
    return narrative.summary;
  }

  const code = normalizeMeetingCode(meetingCode);
  const participantLead = participants.length > 1
    ? `${participants[0]} and ${participants[1]}`
    : participants[0] || '';

  if (participantLead && code) {
    return `${participantLead} joined ${code}. Audio was captured, but speech signal was too limited for a detailed summary.`;
  }

  if (participantLead) {
    return `${participantLead} joined this meeting. Audio was captured, but speech signal was too limited for a detailed summary.`;
  }

  if (code) {
    return `Audio was captured for ${code}, but speech signal was too limited for a detailed summary.`;
  }

  if (meetingLabel) {
    return `Audio was captured for ${String(meetingLabel).trim()}, but speech signal was too limited for a detailed summary.`;
  }

  return 'Audio was captured for this meeting, but speech signal was too limited for a detailed summary.';
}

function isUsableMeetingTitle(value) {
  const title = String(value || '').replace(/\s+/g, ' ').trim();
  if (!title || title.length < 4) {
    return false;
  }

  const normalized = title.toLowerCase();
  if (genericMeetingTitles.has(normalized)) {
    return false;
  }

  if (/^meeting\s+review\s+for\s+/i.test(normalized)) {
    return false;
  }

  if (/^momentum\s+captured\s+the\s+audio\s+file/i.test(normalized)) {
    return false;
  }

  const meetingCodeOnly = normalized.match(/\b[a-z]{3}-[a-z]{4}-[a-z]{3}\b/i);
  if (meetingCodeOnly && normalized.replace(meetingCodeOnly[0].toLowerCase(), '').trim().split(' ').length <= 2) {
    return false;
  }

  const compact = normalized.replace(/[^a-z0-9]/g, '');
  if (!compact) {
    return false;
  }

  for (let size = 1; size <= Math.floor(compact.length / 2); size += 1) {
    if (compact.length % size !== 0) {
      continue;
    }

    const chunk = compact.slice(0, size);
    if (chunk.repeat(compact.length / size) === compact && compact.length >= size * 2) {
      return false;
    }
  }

  return true;
}

function toCompactTitle(text) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return '';
  }

  const words = cleaned
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 7)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

  const candidate = words.join(' ').trim();
  return isUsableMeetingTitle(candidate) ? candidate : '';
}

function pickFirstUsableLabel(...values) {
  for (const value of values) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (isUsableMeetingTitle(normalized)) {
      return normalized;
    }
  }

  return '';
}

function resolveMeetingTitle({
  candidates = [],
  summaryParagraph,
  transcriptText,
  decisions = [],
  tasks = [],
  participants = [],
  meetingCode = '',
  meetingLabel = '',
}) {
  const existingTitle = pickFirstUsableLabel(...candidates);
  if (existingTitle) {
    return existingTitle;
  }

  const lowSignal = isLowSignalContext({
    normalizedSummary: normalizeComparableText(summaryParagraph),
    transcriptText,
    decisions,
    tasks,
  });

  if (lowSignal) {
    return buildLowSignalTitle(meetingCode, transcriptText);
  }

  const decisionTitle = toCompactTitle((Array.isArray(decisions) ? decisions : []).map((decision) => decision?.text).find(Boolean));
  if (decisionTitle) {
    return decisionTitle;
  }

  const taskTitle = toCompactTitle((Array.isArray(tasks) ? tasks : []).map((task) => task?.title).find(Boolean));
  if (taskTitle) {
    return taskTitle;
  }

  const contextualTitle = buildContextualTranscriptTitle({
    transcriptText,
    participants,
    meetingCode,
    meetingLabel,
  });
  if (contextualTitle) {
    return contextualTitle;
  }

  const summaryTitle = toCompactTitle(summaryParagraph);
  if (summaryTitle) {
    return summaryTitle;
  }

  if (participants.length > 1) {
    return `Team Sync: ${participants.slice(0, 2).join(' & ')}`;
  }

  if (participants.length > 0) {
    return `Discussion with ${participants[0]}`;
  }

  if (meetingCode) {
    return `Google Meet Check-in (${String(meetingCode).toUpperCase()})`;
  }

  return 'Meeting Summary';
}

function buildContextualTranscriptTitle({
  transcriptText = '',
  participants = [],
  meetingCode = '',
  meetingLabel = '',
}) {
  const topics = extractSummaryTopics(transcriptText, 2);
  if (topics.length >= 2) {
    return `${formatTopicForTitle(topics[0])} and ${formatTopicForTitle(topics[1])} Review`;
  }

  if (topics.length === 1) {
    return `${formatTopicForTitle(topics[0])} Discussion`;
  }

  const reference = toCompactTitle(meetingLabel);
  if (reference) {
    return reference;
  }

  if (participants.length > 1) {
    return `Team Sync: ${participants.slice(0, 2).join(' & ')}`;
  }

  if (participants.length > 0) {
    return `Discussion with ${participants[0]}`;
  }

  if (meetingCode) {
    return `Google Meet Check-in (${String(meetingCode).toUpperCase()})`;
  }

  return '';
}

function formatTopicForTitle(topic) {
  return String(topic || '')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

function firstValidDateValue(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (!text) {
      continue;
    }

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return null;
}

function formatMeetingTimeLabel(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

async function updateWorkspaceTaskThroughApi(taskId, updates) {
  try {
    const response = await apiFetch('/api/tasks', {
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
    const response = await apiFetch('/api/tasks', {
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

async function updateWorkspaceMeetingThroughApi(meetingId, title) {
  try {
    const response = await apiFetch('/api/meetings', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meetingId,
        title,
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

async function deleteWorkspaceMeetingThroughApi(meetingId) {
  try {
    const encodedMeetingId = encodeURIComponent(meetingId);
    const response = await apiFetch(`/api/meetings?meetingId=${encodedMeetingId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    return { ok: true, mode: 'api' };
  } catch {
    return null;
  }
}

async function updateWorkspaceParticipantThroughApi({
  meetingId,
  participantId,
  currentName,
  displayName,
  removeParticipant,
}) {
  try {
    const response = await apiFetch('/api/meetings', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meetingId,
        participantId,
        currentName,
        displayName,
        removeParticipant,
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

function buildFallbackPeople(meetings, tasks) {
  const people = new Map();

  meetings.forEach((meeting) => {
    (meeting.participants || []).forEach((participant) => {
      if (!participant) {
        return;
      }

      const key = participant.toLowerCase();
      if (!people.has(key)) {
        people.set(key, {
          id: `guest:${key}`,
          profileId: null,
          displayName: participant,
          email: '',
          role: 'guest',
          source: 'meeting',
          isWorkspaceMember: false,
          meetingCount: 0,
          ownedTaskCount: 0,
          openTaskCount: 0,
        });
      }

      people.get(key).meetingCount += 1;
    });
  });

  tasks.forEach((task) => {
    if (!task.owner) {
      return;
    }

    const key = task.owner.toLowerCase();
    if (!people.has(key)) {
      people.set(key, {
        id: `guest:${key}`,
        profileId: null,
        displayName: task.owner,
        email: task.ownerEmail || '',
        role: 'guest',
        source: 'meeting',
        isWorkspaceMember: false,
        meetingCount: 0,
        ownedTaskCount: 0,
        openTaskCount: 0,
      });
    }

    people.get(key).ownedTaskCount += 1;
    if (task.status !== 'done') {
      people.get(key).openTaskCount += 1;
    }
  });

  return Array.from(people.values()).sort((left, right) => right.ownedTaskCount - left.ownedTaskCount);
}
