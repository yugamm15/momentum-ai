const reviewTokens = ['unclear', 'unknown', 'someone', 'missing', 'tbd'];
const sentenceSplitPattern = /(?<=[.!?])\s+/;
const rawUploadStatusPrefixes = ['raw-uploaded:', 'audio-uploaded:'];
const placeholderMeetingTitles = [
  'brief interaction',
  'brief exchange',
  'transcript analysis',
  'meeting analysis: no content',
  'meeting notes (no content)',
  'empty transcript meeting',
  'empty meeting transcript analysis',
  'unclear meeting transcript',
  'unclear meeting content',
  'brief uninformative transcript',
  'no clear meeting title',
];
const placeholderTaskTitles = [
  'complete an unspecified task',
  'untitled follow-up',
  'make it',
  'do it',
  'do this',
  'follow up',
  'action item',
];
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

function normalizedWordList(text) {
  return String(text || '')
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
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

function transcriptSegmentsFromText(text) {
  const fallbackSentences = splitSentences(text);
  const chunks = [];

  for (let index = 0; index < fallbackSentences.length; index += 2) {
    chunks.push(fallbackSentences.slice(index, index + 2).join(' '));
  }

  return chunks.slice(0, 10).map((sentence, index) => ({
    id: `seg-${index + 1}`,
    time: `${String(Math.floor((index * 18) / 60)).padStart(2, '0')}:${String((index * 18) % 60).padStart(2, '0')}`,
    speaker: '',
    speakerLabel: 'Speaker attribution unavailable',
    attribution: 'unattributed',
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

function looksLikePlaceholderMeetingTitle(title) {
  const normalized = String(title || '').trim().toLowerCase();
  return (
    placeholderMeetingTitles.includes(normalized) ||
    normalized.startsWith('meeting review for ')
  );
}

function looksLikePlaceholderTaskTitle(title) {
  const normalized = String(title || '').trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  if (placeholderTaskTitles.includes(normalized)) {
    return true;
  }

  const words = normalizedWordList(normalized);
  const genericWords = ['make', 'do', 'task', 'it', 'this'];
  return words.length <= 2 && words.every((word) => genericWords.includes(word));
}

function transcriptWordCount(text) {
  return normalizedWordList(text).length;
}

function isRawUploadedMeeting(meeting) {
  const status = String(meeting?.status || '').trim().toLowerCase();
  return rawUploadStatusPrefixes.some((prefix) => status.startsWith(prefix));
}

function transcriptLooksLowSignal(text) {
  const normalized = String(text || '').trim().toLowerCase();
  const words = transcriptWordCount(normalized);
  return ['you', 'you you', 'ok', 'okay', 'hello', 'hi'].includes(normalized) || words <= 2;
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
    createdAt: task.created_at,
  };
}

function shouldKeepLegacyTask(task, meeting) {
  const title = normalizeTaskTitle(task.title);
  const titlePlaceholder = looksLikePlaceholderTaskTitle(title);
  const owner = String(task.assignee || '').trim();
  const dueDate = String(task.deadline || '').trim();
  const transcriptWords = transcriptWordCount(meeting.transcript);

  if (!titlePlaceholder) {
    return true;
  }

  if (!owner || needsReviewForOwner(owner)) {
    return false;
  }

  if (!dueDate) {
    return false;
  }

  if (transcriptWords < 12) {
    return false;
  }

  return false;
}

export function shouldKeepLegacyMeeting(meeting, legacyTasks = []) {
  if (isRawUploadedMeeting(meeting)) {
    return true;
  }

  const transcript = String(meeting?.transcript || '').trim();
  const title = String(meeting?.title || '').trim();
  const usableTasks = legacyTasks.filter((task) => shouldKeepLegacyTask(task, meeting));
  const wordCount = transcriptWordCount(transcript);

  if (!transcript && usableTasks.length === 0) {
    return false;
  }

  if (transcriptLooksLowSignal(transcript) && usableTasks.length === 0) {
    return false;
  }

  if (looksLikePlaceholderMeetingTitle(title) && wordCount < 8 && usableTasks.length === 0) {
    return false;
  }

  return true;
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
  return participants;
}

function parseParticipantsFromRawSummary(summary) {
  const match = String(summary || '').match(/Participants:\s([^.]*)\./i);
  if (!match?.[1]) {
    return [];
  }

  return match[1]
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function transformLegacyMeeting(meeting, legacyTasks = []) {
  if (!shouldKeepLegacyMeeting(meeting, legacyTasks)) {
    return null;
  }

  const rawUploaded = isRawUploadedMeeting(meeting);
  const transcriptSegments = transcriptSegmentsFromText(meeting.transcript);
  const aiTitle = String(meeting.title || '').trim() || 'Untitled execution review';
  const summaryParagraph =
    String(meeting.summary || '').trim() || 'Momentum stored the transcript, but the meeting summary still needs a quick review.';
  const tasks = rawUploaded
    ? []
    : legacyTasks
        .filter((task) => shouldKeepLegacyTask(task, meeting))
        .map((task) => normalizeLegacyTask(task, { id: meeting.id, aiTitle, summaryParagraph }, transcriptSegments));
  const participants = summarizeParticipants(
    Array.from(
      new Set([
        ...parseParticipantsFromRawSummary(summaryParagraph),
        ...deriveParticipants(tasks),
      ])
    )
  );
  const explicitOwners = tasks.filter((task) => task.owner).length;
  const explicitDeadlines = tasks.filter((task) => task.dueDate).length;
  const clarityScore = Math.max(45, Math.min(98, Number(meeting.clarity || 72)));
  const executionScore = Math.max(45, Math.min(98, Number(meeting.actionability || 70)));
  const ownershipScore =
    tasks.length > 0
      ? Math.round(((explicitOwners + explicitDeadlines) / (tasks.length * 2)) * 100)
      : 68;
  const overall = weightedOverall({ clarityScore, ownershipScore, executionScore });
  const decisions = rawUploaded
    ? []
    : buildSummaryBullets(summaryParagraph, tasks).slice(0, 3).map((bullet, index) => ({
        id: `${meeting.id}-decision-${index + 1}`,
        text: bullet,
        confidence: 0.68,
        sourceSnippet: transcriptSegments[index]?.text || summaryParagraph,
      }));
  const checklist = rawUploaded
    ? []
    : tasks.map((task) => ({
        id: `${task.id}-check`,
        text: task.title,
        linkedTaskId: task.id,
        completed: task.status === 'done',
      }));
  const meetingRisks = rawUploaded
    ? [
        {
          id: `${meeting.id}-pending-analysis`,
          type: 'Analysis pending',
          severity: 'Medium',
          message: 'Audio is stored, but transcription and extraction have not run yet.',
        },
      ]
    : buildMeetingRisks({
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
    participantRoster: participants.map((participant, index) => ({
      id: `${meeting.id}-participant-${index + 1}`,
      displayName: participant,
      profileId: null,
      profileName: '',
      email: '',
      role: 'guest',
      matchStatus: 'unmatched',
      confidence: 0.68,
    })),
    processingStatus: rawUploaded ? 'pending-analysis' : 'ready',
    processingSummary: rawUploaded
      ? 'Audio is stored safely. Start transcription and extraction from the meeting workspace when ready.'
      : 'Momentum processed this legacy recording using the original pipeline.',
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
    transcriptAttribution: 'unattributed',
    transcriptNotice: rawUploaded
      ? 'Transcription is not available yet because this recording is still waiting for analysis.'
      : 'Speaker names are not available for this recording yet, so Momentum is showing an unattributed transcript.',
    audioUrl: String(meeting.audio_url || '').trim() || null,
  };
}
