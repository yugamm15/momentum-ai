const reviewTokens = ['unclear', 'unknown', 'someone', 'missing', 'tbd'];
const sentenceSplitPattern = /(?<=[.!?])\s+/;
const rawUploadStatusPrefixes = ['raw-uploaded:', 'audio-uploaded:'];
const legacyMetadataMarker = '[MOMENTUM_META]';
const participantNoisePatterns = [
  /\bclose\b/i,
  /\bdevice\b/i,
  /\bdevices\b/i,
  /\bmic\b/i,
  /\bmicrophone\b/i,
  /\bcamera\b/i,
  /\bvideocam\b/i,
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

const participantNoiseWords = new Set([
  'close',
  'device',
  'devices',
  'mic',
  'microphone',
  'camera',
  'videocam',
  'mute',
  'unmute',
  'chat',
  'captions',
  'people',
  'participants',
  'panel',
  'controls',
  'settings',
  'apps',
]);
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
const genericMeetingTitles = new Set([
  'meeting summary',
  'google meet upload',
  'untitled execution review',
  'audio captured',
  'audio captured for meet session',
  'info',
  'infoinfo',
]);

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

  const repeatedLabelMatch = text.match(/^(.+?)\s*\1$/i);
  if (repeatedLabelMatch?.[1]) {
    text = repeatedLabelMatch[1].trim();
  }

  if (participantNoisePatterns.some((pattern) => pattern.test(text))) {
    return '';
  }

  const words = String(text || '')
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];

  if (!words.length) {
    return '';
  }

  if (words.some((word) => participantNoiseWords.has(word))) {
    return '';
  }

  if (words.length > 5) {
    return '';
  }

  return text;
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
        .map((task) => cleanParticipantDisplayName(String(task.owner || '').trim()))
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
  const words = normalizedWordList(normalized);
  const uniqueWords = new Set(words);
  return (
    ['you', 'you you', 'ok', 'okay', 'hello', 'hi', 'thanks', 'thank you'].includes(normalized) ||
    words.length < 10 ||
    uniqueWords.size < 5
  );
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

  return true;
}

export function shouldKeepLegacyMeeting(meeting, legacyTasks = []) {
  if (isRawUploadedMeeting(meeting)) {
    return true;
  }

  const transcript = String(meeting?.transcript || '').trim();
  const title = String(meeting?.title || '').trim();
  const audioUrl = String(meeting?.audio_url || meeting?.audio_storage_path || '').trim();
  const usableTasks = legacyTasks.filter((task) => shouldKeepLegacyTask(task, meeting));
  const wordCount = transcriptWordCount(transcript);

  if (!transcript && usableTasks.length === 0 && !audioUrl) {
    return false;
  }

  if (transcriptLooksLowSignal(transcript) && usableTasks.length === 0 && !audioUrl) {
    return false;
  }

  if (looksLikePlaceholderMeetingTitle(title) && wordCount < 8 && usableTasks.length === 0 && !audioUrl) {
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

function buildRationale({ clarityScore, ownershipScore, executionScore, tasks, transcriptText = '' }) {
  const ownedTasks = tasks.filter((task) => task.owner).length;
  const dueDatedTasks = tasks.filter((task) => task.dueDate).length;
  const lowSignal = transcriptLooksLowSignal(transcriptText) || transcriptWordCount(transcriptText) < 12;

  if (lowSignal) {
    return 'Momentum captured only a weak transcript signal here, so the score is intentionally conservative and should be reviewed manually.';
  }

  if (tasks.length === 0) {
    return 'This meeting produced little clearly executable output, so Momentum is keeping ownership and execution confidence conservative.';
  }

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
  return Array.from(
    new Set(
      (Array.isArray(participants) ? participants : [])
        .map((participant) => cleanParticipantDisplayName(String(participant || '').trim()))
        .filter(Boolean)
    )
  );
}

function parseParticipantsFromRawSummary(summary) {
  const match = String(summary || '').match(/Participants:\s([^.\n]*)[.\n]/i);
  if (!match?.[1]) {
    return [];
  }

  return match[1]
    .split(',')
    .map((part) => cleanParticipantDisplayName(part.trim()))
    .filter(Boolean);
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

  return positionalMatches / summaryTokens.length >= 0.72;
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

function resolveLegacyMeetingTitle({ candidates = [], transcriptText, summaryParagraph, tasks = [], meetingCode = '' }) {
  const lowSignal = isLowSignalContext({
    normalizedSummary: normalizeComparableText(summaryParagraph),
    transcriptText,
    tasks,
  });

  if (lowSignal) {
    return buildLowSignalTitle(meetingCode);
  }

  const existing = pickFirstUsableLabel(...candidates);
  if (existing) {
    return existing;
  }

  const taskTitle = toCompactTitle(tasks.map((task) => task.title).find(Boolean));
  if (taskTitle) {
    return taskTitle;
  }

  const summaryTitle = toCompactTitle(summaryParagraph);
  if (summaryTitle) {
    return summaryTitle;
  }

  if (tasks.length > 0) {
    return 'Execution Planning Sync';
  }

  return 'Meeting Summary';
}

function buildDisplaySummaryParagraph({ summaryParagraph, transcriptText, tasks = [], meetingCode = '' }) {
  const normalizedSummary = normalizeComparableText(summaryParagraph);
  const normalizedTranscript = normalizeComparableText(transcriptText);
  const lowSignal = isLowSignalContext({
    normalizedSummary,
    transcriptText,
    tasks,
  });

  if (
    normalizedSummary
    && !looksLikeTranscriptMirror(normalizedSummary, normalizedTranscript)
    && !isBoilerplateSummary(normalizedSummary)
    && !lowSignal
  ) {
    return summaryParagraph;
  }

  if (tasks.length > 0) {
    const taskPreview = tasks
      .map((task) => String(task.title || '').trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(', ');

    return taskPreview
      ? `The team aligned on execution priorities, including ${taskPreview}. ${tasks.length} follow-up action item${tasks.length === 1 ? '' : 's'} were captured.`
      : `The team aligned on execution priorities and captured ${tasks.length} follow-up action item${tasks.length === 1 ? '' : 's'}.`;
  }

  if (lowSignal) {
    const normalizedCode = normalizeMeetingCode(meetingCode);
    return normalizedCode
      ? `Audio was captured for ${normalizedCode}, but speech signal was too limited for a detailed summary.`
      : 'Audio was captured for this meeting, but speech signal was too limited for a detailed summary.';
  }

  return 'Momentum captured this meeting and generated a concise executive summary from the available signal.';
}

function isBoilerplateSummary(normalizedSummary) {
  const templates = [
    'momentum captured this meeting and generated a concise executive summary from the available signal',
    'transcript processed successfully',
  ];

  return templates.some((template) => normalizedSummary === template);
}

function isLowSignalContext({ normalizedSummary, transcriptText, tasks = [] }) {
  if ((Array.isArray(tasks) ? tasks : []).length > 0) {
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

function normalizeMeetingCode(value) {
  const match = String(value || '').toLowerCase().match(/[a-z]{3}-[a-z]{4}-[a-z]{3}/);
  return match ? match[0] : '';
}

function buildLowSignalTitle(meetingCode = '') {
  const normalizedCode = normalizeMeetingCode(meetingCode);
  return normalizedCode ? `Meeting ${normalizedCode}` : 'Meeting';
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

export function transformLegacyMeeting(meeting, legacyTasks = []) {
  if (!shouldKeepLegacyMeeting(meeting, legacyTasks)) {
    return null;
  }

  const summaryPayload = extractLegacySummaryPayload(meeting.summary);
  const summaryText = summaryPayload.summary;
  const metadata = summaryPayload.metadata;
  const rawUploaded = isRawUploadedMeeting(meeting);
  const transcriptText = String(meeting.transcript || '').trim();
  const transcriptSegments = transcriptSegmentsFromText(transcriptText);
  const rawSummaryParagraph =
    String(summaryText || '').trim() ||
    'Momentum stored the transcript, but the meeting summary still needs a quick review.';
  const provisionalTitle =
    String(metadata.meetingLabel || '').trim() ||
    String(meeting.title || '').trim() ||
    'Untitled execution review';
  const tasks = rawUploaded
    ? []
    : legacyTasks
        .filter((task) => shouldKeepLegacyTask(task, meeting))
        .map((task) => normalizeLegacyTask(task, {
          id: meeting.id,
          aiTitle: provisionalTitle,
          summaryParagraph: rawSummaryParagraph,
        }, transcriptSegments));
  const participants = summarizeParticipants(
    Array.from(
      new Set([
        ...((Array.isArray(metadata.participantNames) ? metadata.participantNames : [])),
        ...parseParticipantsFromRawSummary(rawSummaryParagraph),
        ...deriveParticipants(tasks),
      ])
    )
  );
  const aiTitle = resolveLegacyMeetingTitle({
    candidates: [metadata.meetingLabel, meeting.title],
    transcriptText,
    summaryParagraph: rawSummaryParagraph,
    tasks,
    meetingCode: metadata.meetingCode,
  });
  const summaryParagraph = buildDisplaySummaryParagraph({
    summaryParagraph: rawSummaryParagraph,
    transcriptText,
    tasks,
    meetingCode: metadata.meetingCode,
  });
  const scores = deriveLegacyScores({
    meeting,
    tasks,
    transcriptText,
    rawUploaded,
  });
  const decisions = rawUploaded
    ? []
    : buildSummaryBullets(rawSummaryParagraph, tasks).slice(0, 3).map((bullet, index) => ({
        id: `${meeting.id}-decision-${index + 1}`,
        text: bullet,
        confidence: 0.68,
      sourceSnippet: transcriptSegments[index]?.text || rawSummaryParagraph,
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
        clarityScore: scores.clarityScore,
        executionScore: scores.executionScore,
      });

  return {
    id: meeting.id,
    aiTitle,
    rawTitle: pickFirstUsableLabel(metadata.meetingLabel, meeting.title) || aiTitle,
    timeLabel: niceTimeFromDate(firstValidDateValue(metadata.recordingStartedAt, meeting.created_at)),
    createdAt: firstValidDateValue(metadata.recordingStartedAt, meeting.created_at),
    recordingStartedAt: firstValidDateValue(metadata.recordingStartedAt),
    source: String(metadata.sourcePlatform || '').trim() || 'Google Meet',
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
      overall: scores.overall,
      clarity: scores.clarityScore,
      ownership: scores.ownershipScore,
      execution: scores.executionScore,
      color: scoreColor(scores.overall),
    },
    rationale: buildRationale({
      clarityScore: scores.clarityScore,
      ownershipScore: scores.ownershipScore,
      executionScore: scores.executionScore,
      tasks,
      transcriptText,
    }),
    transcriptText,
    transcriptAttribution: 'unattributed',
    transcriptNotice: rawUploaded
      ? 'Transcription is not available yet because this recording is still waiting for analysis.'
      : transcriptLooksLowSignal(transcriptText)
        ? 'Momentum captured only a weak transcript signal here, so the text and scoring should be reviewed manually.'
        : 'Speaker names are not available for this recording yet, so Momentum is showing an unattributed transcript.',
    audioUrl: String(meeting.audio_url || '').trim() || null,
  };
}

function deriveLegacyScores({ meeting, tasks, transcriptText, rawUploaded }) {
  const transcriptWords = transcriptWordCount(transcriptText);
  const lowSignal = transcriptLooksLowSignal(transcriptText) || transcriptWords < 12;
  const explicitOwners = tasks.filter((task) => task.owner).length;
  const explicitDeadlines = tasks.filter((task) => task.dueDate).length;
  const storedClarity = Number(meeting.clarity || 0);
  const storedExecution = Number(meeting.actionability || 0);

  if (rawUploaded) {
    return {
      clarityScore: 0,
      ownershipScore: 0,
      executionScore: 0,
      overall: 0,
    };
  }

  if (lowSignal) {
    const clarityScore = Math.max(5, Math.min(25, storedClarity || 15));
    const ownershipScore = tasks.length > 0
      ? Math.min(35, Math.round(((explicitOwners + explicitDeadlines) / (tasks.length * 2)) * 100))
      : 8;
    const executionScore = tasks.length > 0
      ? Math.min(35, Math.max(10, storedExecution || 20))
      : Math.max(5, Math.min(20, storedExecution || 10));

    return {
      clarityScore,
      ownershipScore,
      executionScore,
      overall: weightedOverall({ clarityScore, ownershipScore, executionScore }),
    };
  }

  const clarityScore = Math.max(35, Math.min(98, storedClarity || 72));
  const ownershipScore =
    tasks.length > 0
      ? Math.round(((explicitOwners + explicitDeadlines) / (tasks.length * 2)) * 100)
      : transcriptWords >= 80
        ? 42
        : 24;
  const executionScore =
    tasks.length > 0
      ? Math.max(35, Math.min(98, storedExecution || 70))
      : Math.min(55, Math.max(24, storedExecution || 40));

  return {
    clarityScore,
    ownershipScore,
    executionScore,
    overall: weightedOverall({ clarityScore, ownershipScore, executionScore }),
  };
}

function extractLegacySummaryPayload(summary) {
  const text = String(summary || '').trim();
  const markerIndex = text.lastIndexOf(legacyMetadataMarker);

  if (markerIndex === -1) {
    return {
      summary: text,
      metadata: {},
    };
  }

  const summaryText = text.slice(0, markerIndex).trim();
  const metadataText = text.slice(markerIndex + legacyMetadataMarker.length).trim();

  try {
    const metadata = JSON.parse(metadataText);
    return {
      summary: summaryText,
      metadata: {
        participantNames: Array.isArray(metadata?.participantNames)
          ? metadata.participantNames.map((value) => String(value || '').trim()).filter(Boolean)
          : [],
        meetingLabel: String(metadata?.meetingLabel || '').trim(),
        meetingUrl: String(metadata?.meetingUrl || '').trim(),
        meetingCode: String(metadata?.meetingCode || '').trim(),
        sourcePlatform: String(metadata?.sourcePlatform || '').trim(),
        audioMode: String(metadata?.audioMode || '').trim(),
        audioError: String(metadata?.audioError || '').trim(),
      },
    };
  } catch {
    return {
      summary: summaryText || text,
      metadata: {},
    };
  }
}
