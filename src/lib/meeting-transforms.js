import { baseTasks, liveTasks, meetings as seededMeetings } from '../data/demoData.js';

const reviewTokens = ['unclear', 'unknown', 'someone', 'missing', 'tbd'];
const sentenceSplitPattern = /(?<=[.!?])\s+/;
const statusMap = {
  todo: 'pending',
  pending: 'pending',
  review: 'needs-review',
  'needs review': 'needs-review',
  'needs-review': 'needs-review',
  'in progress': 'in-progress',
  in_progress: 'in-progress',
  'in-progress': 'in-progress',
  doing: 'in-progress',
  done: 'done',
  completed: 'done',
};

export function scoreColor(score) {
  if (score >= 80) {
    return 'emerald';
  }

  if (score >= 60) {
    return 'amber';
  }

  return 'rose';
}

export function normalizeStatus(status, needsReview = false) {
  if (needsReview) {
    return 'needs-review';
  }

  const normalized = String(status || '')
    .trim()
    .toLowerCase();

  return statusMap[normalized] || 'pending';
}

function splitSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(sentenceSplitPattern)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function toConfidence(value, fallback = 0.78) {
  const numeric = Number.parseFloat(value);
  if (!Number.isNaN(numeric) && numeric > 0) {
    return Math.max(0.45, Math.min(0.99, numeric));
  }

  return fallback;
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

function transcriptSegmentsFromText(text, participants = []) {
  const speakers = participants.length > 0 ? participants : ['Speaker 1', 'Speaker 2', 'Speaker 3'];
  const fallbackSentences = splitSentences(text);

  return fallbackSentences.slice(0, 10).map((sentence, index) => ({
    id: `seg-${index + 1}`,
    time: `0${Math.floor(index / 2)}:${String((index % 2) * 30).padStart(2, '0')}`,
    speaker: speakers[index % speakers.length],
    text: sentence,
  }));
}

function buildSummaryBullets(summary, tasks) {
  const sentences = splitSentences(summary);
  const bullets = sentences.slice(0, 4);

  if (bullets.length >= 2) {
    return bullets;
  }

  const taskBullets = tasks
    .slice(0, 3)
    .map((task) => `${task.title}${task.owner ? ` with ${task.owner}` : ''}`.trim());

  return [...bullets, ...taskBullets].filter(Boolean).slice(0, 4);
}

function deriveParticipants(tasks) {
  return Array.from(
    new Set(
      tasks
        .map((task) => String(task.owner || '').trim())
        .filter((owner) => owner && !needsReviewForOwner(owner))
    )
  );
}

function needsReviewForOwner(owner) {
  const normalized = String(owner || '').trim().toLowerCase();
  return !normalized || reviewTokens.some((token) => normalized.includes(token));
}

function normalizeTaskTitle(title) {
  const normalized = String(title || '').trim();
  return normalized || 'Untitled follow-up';
}

function bestSourceSnippet(taskTitle, transcriptSegments, summary) {
  const titleWords = String(taskTitle || '')
    .toLowerCase()
    .match(/[a-z0-9]{4,}/g) || [];

  const segmentMatch = transcriptSegments.find((segment) =>
    titleWords.some((word) => segment.text.toLowerCase().includes(word))
  );

  if (segmentMatch) {
    return segmentMatch.text;
  }

  const summarySentence = splitSentences(summary)[0];
  return summarySentence || 'Derived from the meeting summary.';
}

function normalizeLegacyTask(task, meeting, transcriptSegments) {
  const owner = String(task.assignee || '').trim();
  const dueDate = String(task.deadline || '').trim();
  const needsReview = needsReviewForOwner(owner) || !dueDate;
  const status = normalizeStatus(task.status, needsReview);

  return {
    id: task.id,
    meetingId: meeting.id,
    sourceMeetingId: meeting.id,
    sourceMeeting: meeting.aiTitle,
    title: normalizeTaskTitle(task.title),
    owner,
    dueDate,
    status,
    confidence: owner && dueDate ? 0.87 : owner ? 0.75 : 0.64,
    needsReview,
    sourceSnippet: bestSourceSnippet(task.title, transcriptSegments, meeting.summaryParagraph),
    isEditable: true,
    isSeeded: false,
    createdAt: task.created_at,
  };
}

function buildMeetingRisks({ tasks, transcriptSegments, clarityScore, executionScore }) {
  const risks = [];

  tasks.forEach((task) => {
    if (!task.owner) {
      risks.push({
        id: `${task.id}-owner`,
        type: 'No owner assigned',
        severity: 'High',
        message: `"${task.title}" still needs a clear owner.`,
      });
    }

    if (!task.dueDate) {
      risks.push({
        id: `${task.id}-deadline`,
        type: 'No deadline assigned',
        severity: 'Medium',
        message: `"${task.title}" does not have a due date yet.`,
      });
    }
  });

  if (transcriptSegments.length < 3) {
    risks.push({
      id: 'transcript-signal',
      type: 'Low transcription confidence',
      severity: 'Medium',
      message: 'The transcript is short, so extracted tasks may need a quick human review.',
    });
  }

  if (clarityScore < 70) {
    risks.push({
      id: 'clarity',
      type: 'Decision unclear',
      severity: 'Medium',
      message: 'The meeting language stayed fairly abstract and could benefit from stronger decisions.',
    });
  }

  if (executionScore < 70) {
    risks.push({
      id: 'execution',
      type: 'Task wording vague',
      severity: 'Medium',
      message: 'Several follow-ups were captured without enough delivery detail.',
    });
  }

  return risks.slice(0, 6);
}

function buildRationale({ clarityScore, ownershipScore, executionScore, tasks }) {
  const ownedTasks = tasks.filter((task) => task.owner).length;
  const dueDatedTasks = tasks.filter((task) => task.dueDate).length;

  if (ownedTasks === tasks.length && dueDatedTasks === tasks.length && clarityScore >= 80) {
    return 'Strong action language, explicit ownership, and clear deadlines make this meeting highly executable.';
  }

  if (ownershipScore < 70) {
    return 'Momentum found useful follow-ups, but ownership is still ambiguous on a few action items.';
  }

  if (executionScore < 70) {
    return 'The team aligned well, but several tasks still need sharper deadlines or more concrete wording.';
  }

  return 'The meeting produced meaningful action items, with a few open edges that should be reviewed before execution.';
}

function weightedOverall({ clarityScore, ownershipScore, executionScore }) {
  return Math.round(clarityScore * 0.35 + ownershipScore * 0.35 + executionScore * 0.3);
}

function summarizeParticipants(participants) {
  if (participants.length === 0) {
    return ['Participant roster pending'];
  }

  return participants;
}

export function transformSeededMeeting(seed, seededTaskList) {
  const tasks = seededTaskList
    .filter((task) => task.meetingId === seed.id)
    .map((task) => ({
      ...task,
      sourceMeetingId: seed.id,
      sourceMeeting: seed.aiTitle,
      owner: task.owner,
      isEditable: false,
      isSeeded: true,
      status: normalizeStatus(task.status, task.needsReview),
      confidence: toConfidence(task.confidence, 0.82),
    }));

  const score = {
    overall: Number(seed.score?.overall || 80),
    clarity: Number(seed.score?.clarity || 80),
    ownership: Number(seed.score?.ownership || 80),
    execution: Number(seed.score?.execution || 80),
  };

  return {
    id: seed.id,
    aiTitle: seed.aiTitle,
    rawTitle: seed.rawTitle,
    timeLabel: seed.time,
    createdAt: seed.time,
    source: seed.source || 'Google Meet',
    participants: seed.participants,
    processingStatus: 'ready',
    processingSummary: seed.processingSummary || 'Momentum is ready.',
    summaryParagraph: seed.summary,
    summaryBullets: seed.bullets || [],
    decisions: (seed.decisions || []).map((decision, index) => ({
      id: `${seed.id}-decision-${index + 1}`,
      text: decision.text,
      confidence: toConfidence(decision.confidence, 0.91),
      sourceSnippet: seed.transcript?.[index]?.text || seed.summary,
    })),
    tasks,
    checklist: (seed.checklist || []).map((item) => ({
      ...item,
      linkedTaskId: tasks.find((task) => item.text.toLowerCase().includes(task.title.toLowerCase().slice(0, 10)))?.id || null,
    })),
    meetingRisks: (seed.meetingRisks || []).map((risk, index) => ({
      id: `${seed.id}-risk-${index + 1}`,
      ...risk,
    })),
    transcript: (seed.transcript || []).map((segment, index) => ({
      id: `${seed.id}-segment-${index + 1}`,
      ...segment,
    })),
    score: {
      ...score,
      color: scoreColor(score.overall),
    },
    rationale: seed.rationale,
    isSeeded: true,
  };
}

export function createSeededWorkspaceSnapshot() {
  const seededTaskList = [...baseTasks, ...liveTasks];
  const meetings = seededMeetings.map((meeting) => transformSeededMeeting(meeting, seededTaskList));
  const tasks = meetings.flatMap((meeting) => meeting.tasks);
  return { meetings, tasks };
}

export function transformLegacyMeeting(meeting, legacyTasks = []) {
  const transcriptSegments = transcriptSegmentsFromText(meeting.transcript);
  const aiTitle = String(meeting.title || '').trim() || 'Untitled execution review';
  const summaryParagraph =
    String(meeting.summary || '').trim() || 'Momentum stored the transcript, but the meeting summary still needs a quick review.';
  const tasks = legacyTasks.map((task) => normalizeLegacyTask(task, { id: meeting.id, aiTitle, summaryParagraph }, transcriptSegments));
  const participants = summarizeParticipants(deriveParticipants(tasks));
  const explicitOwners = tasks.filter((task) => task.owner).length;
  const explicitDeadlines = tasks.filter((task) => task.dueDate).length;
  const clarityScore = Math.max(45, Math.min(98, Number(meeting.clarity || 72)));
  const executionScore = Math.max(45, Math.min(98, Number(meeting.actionability || 70)));
  const ownershipScore =
    tasks.length > 0
      ? Math.round(((explicitOwners + explicitDeadlines) / (tasks.length * 2)) * 100)
      : 68;
  const overall = weightedOverall({ clarityScore, ownershipScore, executionScore });
  const decisions = buildSummaryBullets(summaryParagraph, tasks).slice(0, 3).map((bullet, index) => ({
    id: `${meeting.id}-decision-${index + 1}`,
    text: bullet,
    confidence: 0.68,
    sourceSnippet: transcriptSegments[index]?.text || summaryParagraph,
  }));
  const checklist = tasks.map((task) => ({
    id: `${task.id}-check`,
    text: task.title,
    linkedTaskId: task.id,
    completed: task.status === 'done',
  }));
  const meetingRisks = buildMeetingRisks({
    tasks,
    transcriptSegments,
    clarityScore,
    executionScore,
  });

  return {
    id: meeting.id,
    aiTitle,
    rawTitle: String(meeting.title || '').trim() || 'Google Meet upload',
    timeLabel: niceTimeFromDate(meeting.created_at),
    createdAt: meeting.created_at,
    source: 'Google Meet',
    participants,
    processingStatus: String(meeting.status || '').toLowerCase().includes('complete') ? 'ready' : 'ready',
    processingSummary: 'Momentum processed this legacy recording using the original pipeline.',
    summaryParagraph,
    summaryBullets: buildSummaryBullets(summaryParagraph, tasks),
    decisions,
    tasks,
    checklist,
    meetingRisks,
    transcript: transcriptSegments,
    score: {
      overall,
      clarity: clarityScore,
      ownership: ownershipScore,
      execution: executionScore,
      color: scoreColor(overall),
    },
    rationale: buildRationale({ clarityScore, ownershipScore, executionScore, tasks }),
    transcriptText: meeting.transcript,
    isSeeded: false,
  };
}

export function findSeededAnswer(meeting, question) {
  const query = String(question || '').trim().toLowerCase();
  if (!query) {
    return 'Ask about decisions, owners, deadlines, or the transcript and Momentum will ground the answer in this meeting.';
  }

  const sources = [
    meeting.summaryParagraph,
    ...(meeting.decisions || []).map((item) => item.text),
    ...(meeting.tasks || []).map((task) => `${task.title}. Owner: ${task.owner || 'Unknown'}. Due: ${task.dueDate || 'Missing'}.`),
    ...(meeting.transcript || []).map((segment) => segment.text),
  ];

  const keywords = query.match(/[a-z0-9]{3,}/g) || [];
  const ranked = sources
    .map((text) => ({
      text,
      score: keywords.reduce((total, keyword) => total + (String(text).toLowerCase().includes(keyword) ? 1 : 0), 0),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  if (ranked.length > 0) {
    return ranked.slice(0, 2).map((item) => item.text).join(' ');
  }

  return 'This seeded meeting does not directly support that answer, so Momentum would flag it for manual review instead of guessing.';
}
