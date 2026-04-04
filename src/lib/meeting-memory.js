const TITLE_STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'into',
  'that',
  'this',
  'next',
  'task',
  'tasks',
  'action',
  'actions',
  'item',
  'items',
  'follow',
  'followup',
  'review',
  'meeting',
  'meetings',
  'sync',
  'weekly',
  'daily',
  'update',
  'updates',
  'discussion',
  'call',
  'work',
  'plan',
]);

const GENERIC_OWNER_VALUES = new Set([
  '',
  'unassigned',
  'unclear',
  'unknown',
  'someone',
  'somebody',
  'anyone',
  'everyone',
  'team',
  'group',
  'all',
]);

export function buildMeetingMemory(currentMeeting, meetings = []) {
  const briefWithoutHistory = buildMeetingBrief({
    currentMeeting,
    previousMeeting: null,
    comparison: null,
  });
  const previousMeeting = findPreviousRelevantMeeting(currentMeeting, meetings);

  if (!previousMeeting) {
    return {
      previousMeeting: null,
      resurfacedTasks: [],
      ownerChanges: [],
      timelineShifts: [],
      repeatedAmbiguities: [],
      newCommitments: (Array.isArray(currentMeeting?.tasks) ? currentMeeting.tasks : []).slice(0, 4),
      droppedCommitments: [],
      signals: [],
      briefHeadline: briefWithoutHistory.headline,
      briefItems: briefWithoutHistory.items,
      summary: 'No earlier related meeting has been found in this workspace yet.',
    };
  }

  const comparison = compareMeetingTasks(previousMeeting, currentMeeting);
  const signals = buildMemorySignals(previousMeeting, currentMeeting, comparison);
  const brief = buildMeetingBrief({
    currentMeeting,
    previousMeeting,
    comparison,
  });

  return {
    previousMeeting,
    ...comparison,
    signals,
    briefHeadline: brief.headline,
    briefItems: brief.items,
    summary: buildMeetingMemorySummary(previousMeeting, comparison),
  };
}

export function buildWorkspaceMemoryDigest(meetings = []) {
  const orderedMeetings = sortMeetingsByTimestamp(meetings);
  const signals = [];
  const seenSignalIds = new Set();

  orderedMeetings.slice(0, 8).forEach((meeting) => {
    const memory = buildMeetingMemory(meeting, orderedMeetings);
    memory.signals.forEach((signal) => {
      if (!seenSignalIds.has(signal.id)) {
        seenSignalIds.add(signal.id);
        signals.push(signal);
      }
    });
  });

  const resurfacedCount = signals.filter((signal) => signal.type === 'resurfaced').length;
  const ownerShiftCount = signals.filter((signal) => signal.type === 'owner-shift').length;
  const timelineShiftCount = signals.filter((signal) => signal.type === 'timeline-shift').length;
  const repeatedAmbiguityCount = signals.filter((signal) => signal.type === 'repeat-review').length;

  return {
    resurfacedCount,
    ownerShiftCount,
    timelineShiftCount,
    repeatedAmbiguityCount,
    signals: signals.slice(0, 6),
  };
}

function findPreviousRelevantMeeting(currentMeeting, meetings = []) {
  const currentTimestamp = getMeetingTimestamp(currentMeeting);

  return (Array.isArray(meetings) ? meetings : [])
    .filter((candidate) => candidate?.id && candidate.id !== currentMeeting?.id)
    .filter((candidate) => getMeetingTimestamp(candidate) < currentTimestamp)
    .map((candidate) => ({
      candidate,
      score: scoreMeetingRelation(candidate, currentMeeting),
    }))
    .filter((entry) => entry.score >= 1.55)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.candidate)[0] || null;
}

function scoreMeetingRelation(previousMeeting, currentMeeting) {
  const previousParticipants = buildNameSet(previousMeeting?.participants);
  const currentParticipants = buildNameSet(currentMeeting?.participants);
  const participantOverlap = overlapScore(previousParticipants, currentParticipants);

  const titleOverlap = overlapScore(
    buildTextTokenSet(`${previousMeeting?.aiTitle || ''} ${previousMeeting?.rawTitle || ''}`),
    buildTextTokenSet(`${currentMeeting?.aiTitle || ''} ${currentMeeting?.rawTitle || ''}`)
  );

  const decisionOverlap = overlapScore(
    buildTextTokenSet((previousMeeting?.decisions || []).map((decision) => decision?.text).join(' ')),
    buildTextTokenSet((currentMeeting?.decisions || []).map((decision) => decision?.text).join(' '))
  );

  const taskOverlap = scoreTaskSurfaceOverlap(previousMeeting?.tasks, currentMeeting?.tasks);

  return participantOverlap * 3.2 + titleOverlap * 2.4 + taskOverlap * 4.3 + decisionOverlap * 1.6;
}

function compareMeetingTasks(previousMeeting, currentMeeting) {
  const previousTasks = Array.isArray(previousMeeting?.tasks) ? previousMeeting.tasks : [];
  const currentTasks = Array.isArray(currentMeeting?.tasks) ? currentMeeting.tasks : [];
  const pairs = matchTaskPairs(previousTasks, currentTasks);

  const resurfacedTasks = [];
  const ownerChanges = [];
  const timelineShifts = [];
  const repeatedAmbiguities = [];

  pairs.matches.forEach((pair) => {
    const previousTask = pair.previousTask;
    const currentTask = pair.currentTask;
    const previousStatus = normalizeTaskStatus(previousTask?.status);
    const currentStatus = normalizeTaskStatus(currentTask?.status);
    const previousOwner = normalizeOwner(previousTask?.owner);
    const currentOwner = normalizeOwner(currentTask?.owner);
    const previousDueDate = normalizeDueDate(previousTask?.dueDate);
    const currentDueDate = normalizeDueDate(currentTask?.dueDate);

    if (previousStatus !== 'done' && currentStatus !== 'done') {
      resurfacedTasks.push(pair);
    }

    if (previousOwner && currentOwner && previousOwner !== currentOwner) {
      ownerChanges.push(pair);
    }

    if (previousDueDate && currentDueDate && previousDueDate !== currentDueDate) {
      timelineShifts.push(pair);
    }

    if (taskNeedsReview(previousTask) && taskNeedsReview(currentTask)) {
      repeatedAmbiguities.push(pair);
    }
  });

  const newCommitments = pairs.unmatchedCurrentTasks.slice(0, 4);
  const droppedCommitments = pairs.unmatchedPreviousTasks
    .filter((task) => normalizeTaskStatus(task?.status) !== 'done')
    .slice(0, 4);

  return {
    resurfacedTasks,
    ownerChanges,
    timelineShifts,
    repeatedAmbiguities,
    newCommitments,
    droppedCommitments,
  };
}

function buildMemorySignals(previousMeeting, currentMeeting, comparison) {
  const signals = [
    ...comparison.ownerChanges.slice(0, 2).map((pair) => ({
      id: `${currentMeeting.id}:${pair.currentTask.id}:owner`,
      type: 'owner-shift',
      label: pair.currentTask.title || 'Owner changed',
      detail: `${pair.previousTask.owner || 'Unassigned'} -> ${pair.currentTask.owner || 'Unassigned'}`,
      meetingId: currentMeeting.id,
      href: `/dashboard/meetings/${currentMeeting.id}`,
      previousMeetingId: previousMeeting.id,
    })),
    ...comparison.timelineShifts.slice(0, 2).map((pair) => ({
      id: `${currentMeeting.id}:${pair.currentTask.id}:deadline`,
      type: 'timeline-shift',
      label: pair.currentTask.title || 'Timeline shifted',
      detail: `${pair.previousTask.dueDate || 'Open'} -> ${pair.currentTask.dueDate || 'Open'}`,
      meetingId: currentMeeting.id,
      href: `/dashboard/meetings/${currentMeeting.id}`,
      previousMeetingId: previousMeeting.id,
    })),
    ...comparison.repeatedAmbiguities.slice(0, 2).map((pair) => ({
      id: `${currentMeeting.id}:${pair.currentTask.id}:review`,
      type: 'repeat-review',
      label: pair.currentTask.title || 'Needs review again',
      detail: 'This follow-up still lacks a clear owner or deadline.',
      meetingId: currentMeeting.id,
      href: `/dashboard/meetings/${currentMeeting.id}`,
      previousMeetingId: previousMeeting.id,
    })),
    ...comparison.resurfacedTasks.slice(0, 2).map((pair) => ({
      id: `${currentMeeting.id}:${pair.currentTask.id}:carry`,
      type: 'resurfaced',
      label: pair.currentTask.title || 'Commitment resurfaced',
      detail: `Still open since ${previousMeeting.aiTitle || previousMeeting.rawTitle || 'the previous meeting'}.`,
      meetingId: currentMeeting.id,
      href: `/dashboard/meetings/${currentMeeting.id}`,
      previousMeetingId: previousMeeting.id,
    })),
  ];

  return signals.slice(0, 4);
}

function buildMeetingMemorySummary(previousMeeting, comparison) {
  const parts = [];

  if (comparison.resurfacedTasks.length > 0) {
    parts.push(`${comparison.resurfacedTasks.length} commitments resurfaced`);
  }

  if (comparison.ownerChanges.length > 0) {
    parts.push(`${comparison.ownerChanges.length} owner changes`);
  }

  if (comparison.timelineShifts.length > 0) {
    parts.push(`${comparison.timelineShifts.length} timeline shifts`);
  }

  if (comparison.repeatedAmbiguities.length > 0) {
    parts.push(`${comparison.repeatedAmbiguities.length} repeated ambiguity flags`);
  }

  if (parts.length === 0) {
    return `Compared with ${previousMeeting.aiTitle || previousMeeting.rawTitle || 'the previous meeting'}, this meeting introduces mostly net-new work.`;
  }

  return `Compared with ${previousMeeting.aiTitle || previousMeeting.rawTitle || 'the previous meeting'}, Momentum found ${parts.join(', ')}.`;
}

function buildMeetingBrief({ currentMeeting, previousMeeting, comparison }) {
  const tasks = Array.isArray(currentMeeting?.tasks) ? currentMeeting.tasks : [];
  const risks = Array.isArray(currentMeeting?.meetingRisks) ? currentMeeting.meetingRisks : [];
  const reviewCount = tasks.filter((task) => taskNeedsReview(task)).length;

  if (!previousMeeting || !comparison) {
    const items = [];

    if (reviewCount > 0) {
      items.push({
        id: 'resolve-review',
        title: 'Resolve the unclear follow-ups',
        detail: `${reviewCount} extracted items still need a clear owner or deadline.`,
        target: 'tasks',
      });
    }

    if (risks.length > 0) {
      items.push({
        id: 'review-risks',
        title: 'Review the weak spots in the record',
        detail: `${risks.length} meeting risks need a quick human check before this record is trusted.`,
        target: 'transcript',
      });
    }

    if (tasks.length > 0) {
      items.push({
        id: 'carry-forward',
        title: 'Decide what should survive into the next meeting',
        detail: `${tasks.length} follow-ups were captured from this session and should be confirmed before they drift.`,
        target: 'tasks',
      });
    }

    if (items.length === 0) {
      items.push({
        id: 'set-baseline',
        title: 'Use this meeting as the baseline record',
        detail: 'Once the next related meeting lands, Momentum will start showing what changed across them.',
        target: 'transcript',
      });
    }

    return {
      headline:
        reviewCount > 0
          ? `Before the next meeting, lock down ${reviewCount} unclear follow-up${reviewCount === 1 ? '' : 's'}.`
          : 'This meeting now acts as the baseline for future continuity and drift checks.',
      items: items.slice(0, 4),
    };
  }

  const items = [];

  if (comparison.resurfacedTasks.length > 0) {
    items.push({
      id: 'resurfaced',
      title: 'Close the work that resurfaced',
      detail: `${comparison.resurfacedTasks.length} commitment${comparison.resurfacedTasks.length === 1 ? '' : 's'} carried over from ${previousMeeting.aiTitle || previousMeeting.rawTitle || 'the last related meeting'}.`,
      target: 'tasks',
    });
  }

  if (comparison.ownerChanges.length > 0) {
    items.push({
      id: 'owner-shift',
      title: 'Confirm the owner changes',
      detail: `${comparison.ownerChanges.length} follow-up${comparison.ownerChanges.length === 1 ? '' : 's'} changed hands and should be reconfirmed out loud.`,
      target: 'tasks',
    });
  }

  if (comparison.timelineShifts.length > 0) {
    items.push({
      id: 'timeline-shift',
      title: 'Reconfirm the moved deadlines',
      detail: `${comparison.timelineShifts.length} date change${comparison.timelineShifts.length === 1 ? '' : 's'} showed up between the two meetings.`,
      target: 'tasks',
    });
  }

  if (comparison.repeatedAmbiguities.length > 0) {
    items.push({
      id: 'repeat-review',
      title: 'Resolve the ambiguity that came back',
      detail: `${comparison.repeatedAmbiguities.length} follow-up${comparison.repeatedAmbiguities.length === 1 ? '' : 's'} stayed unclear across both meetings.`,
      target: 'tasks',
    });
  }

  if (comparison.droppedCommitments.length > 0) {
    items.push({
      id: 'dropped',
      title: 'Check what quietly disappeared',
      detail: `${comparison.droppedCommitments.length} earlier commitment${comparison.droppedCommitments.length === 1 ? '' : 's'} no longer appears in this meeting.`,
      target: 'transcript',
    });
  }

  if (comparison.newCommitments.length > 0) {
    items.push({
      id: 'new',
      title: 'Validate the new commitments',
      detail: `${comparison.newCommitments.length} new follow-up${comparison.newCommitments.length === 1 ? '' : 's'} entered the record in this meeting.`,
      target: 'tasks',
    });
  }

  if (items.length === 0) {
    items.push({
      id: 'stable-record',
      title: 'Use the transcript as the source of truth',
      detail: 'This meeting did not show meaningful drift from the last related one, so the main job is confirming the current record.',
      target: 'transcript',
    });
  }

  const leadItems = items.slice(0, 2).map((item) => item.title.toLowerCase());
  const headline =
    leadItems.length > 1
      ? `Open the next meeting by ${leadItems[0]} and ${leadItems[1]}.`
      : `Open the next meeting by ${leadItems[0]}.`;

  return {
    headline,
    items: items.slice(0, 4),
  };
}

function matchTaskPairs(previousTasks = [], currentTasks = []) {
  const candidates = [];

  previousTasks.forEach((previousTask, previousIndex) => {
    currentTasks.forEach((currentTask, currentIndex) => {
      const similarity = taskSimilarity(previousTask, currentTask);
      if (similarity >= 0.52) {
        candidates.push({ previousIndex, currentIndex, similarity });
      }
    });
  });

  candidates.sort((left, right) => right.similarity - left.similarity);

  const usedPrevious = new Set();
  const usedCurrent = new Set();
  const matches = [];

  candidates.forEach((candidate) => {
    if (usedPrevious.has(candidate.previousIndex) || usedCurrent.has(candidate.currentIndex)) {
      return;
    }

    usedPrevious.add(candidate.previousIndex);
    usedCurrent.add(candidate.currentIndex);
    matches.push({
      previousTask: previousTasks[candidate.previousIndex],
      currentTask: currentTasks[candidate.currentIndex],
      similarity: candidate.similarity,
    });
  });

  return {
    matches,
    unmatchedPreviousTasks: previousTasks.filter((_, index) => !usedPrevious.has(index)),
    unmatchedCurrentTasks: currentTasks.filter((_, index) => !usedCurrent.has(index)),
  };
}

function taskSimilarity(previousTask, currentTask) {
  const previousTitle = normalizeComparableText(previousTask?.title);
  const currentTitle = normalizeComparableText(currentTask?.title);

  if (!previousTitle || !currentTitle) {
    return 0;
  }

  if (previousTitle === currentTitle) {
    return 1;
  }

  if (previousTitle.includes(currentTitle) || currentTitle.includes(previousTitle)) {
    return 0.9;
  }

  const previousTokens = buildTextTokenSet(previousTask?.title);
  const currentTokens = buildTextTokenSet(currentTask?.title);
  const titleOverlap = overlapScore(previousTokens, currentTokens);

  if (titleOverlap <= 0) {
    return 0;
  }

  const previousOwner = normalizeOwner(previousTask?.owner);
  const currentOwner = normalizeOwner(currentTask?.owner);
  const ownerBonus = previousOwner && currentOwner && previousOwner === currentOwner ? 0.1 : 0;

  return Math.min(1, titleOverlap + ownerBonus);
}

function scoreTaskSurfaceOverlap(previousTasks = [], currentTasks = []) {
  if (!previousTasks.length || !currentTasks.length) {
    return 0;
  }

  const pairs = matchTaskPairs(previousTasks, currentTasks);
  if (!pairs.matches.length) {
    return 0;
  }

  const total = pairs.matches.reduce((sum, pair) => sum + pair.similarity, 0);
  return total / Math.max(previousTasks.length, currentTasks.length);
}

function sortMeetingsByTimestamp(meetings = []) {
  return (Array.isArray(meetings) ? meetings : [])
    .slice()
    .sort((left, right) => getMeetingTimestamp(right) - getMeetingTimestamp(left));
}

function buildNameSet(values = []) {
  return new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => normalizeComparableText(value))
      .filter(Boolean)
  );
}

function buildTextTokenSet(value) {
  const tokens = normalizeComparableText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .filter((token) => !TITLE_STOP_WORDS.has(token));

  return new Set(tokens);
}

function overlapScore(leftSet, rightSet) {
  if (!leftSet.size || !rightSet.size) {
    return 0;
  }

  let overlapCount = 0;
  leftSet.forEach((value) => {
    if (rightSet.has(value)) {
      overlapCount += 1;
    }
  });

  if (!overlapCount) {
    return 0;
  }

  return overlapCount / Math.max(leftSet.size, rightSet.size);
}

function normalizeComparableText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeOwner(value) {
  const normalized = normalizeComparableText(value);
  return GENERIC_OWNER_VALUES.has(normalized) ? '' : normalized;
}

function normalizeDueDate(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeTaskStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'todo') {
    return 'pending';
  }

  if (normalized === 'in-progress' || normalized === 'needs-review' || normalized === 'done' || normalized === 'pending') {
    return normalized;
  }

  return 'pending';
}

function taskNeedsReview(task) {
  if (!task) {
    return false;
  }

  if (normalizeTaskStatus(task.status) === 'needs-review') {
    return true;
  }

  if (task.needsReview) {
    return true;
  }

  if (!normalizeOwner(task.owner)) {
    return true;
  }

  if (!normalizeDueDate(task.dueDate)) {
    return true;
  }

  return false;
}

function getMeetingTimestamp(meeting) {
  const parsed = Date.parse(
    meeting?.recordingStartedAt ||
      meeting?.createdAt ||
      meeting?.created_at ||
      ''
  );

  return Number.isFinite(parsed) ? parsed : 0;
}
