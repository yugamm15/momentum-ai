export function getMeetingState(meeting) {
  const status = String(meeting?.status || '').trim();

  if (status === 'completed' || String(meeting?.transcript || '').trim()) {
    return 'completed';
  }

  if (status === 'processing') {
    return 'processing';
  }

  if (status.startsWith('raw-uploaded:') || status.startsWith('audio-uploaded:')) {
    return 'pending-analysis';
  }

  return 'unknown';
}

export function isMeetingAnalyzed(meeting) {
  return getMeetingState(meeting) === 'completed';
}

export function canAskMeetingQuestion(meeting) {
  return Boolean(String(meeting?.transcript || '').trim());
}

export function getMeetingBadge(meeting) {
  const state = getMeetingState(meeting);

  if (state === 'completed') {
    return {
      label: `Focus: ${Number(meeting?.actionability || 0)}%`,
      className: getFocusBadgeClass(Number(meeting?.actionability || 0)),
    };
  }

  if (state === 'processing') {
    return {
      label: 'Processing',
      className: 'bg-blue-100 text-blue-800 border-blue-200',
    };
  }

  if (state === 'pending-analysis') {
    return {
      label: 'Analysis Pending',
      className: 'bg-amber-100 text-amber-800 border-amber-200',
    };
  }

  return {
    label: 'Needs Review',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  };
}

export function getMeetingSummaryText(meeting) {
  const state = getMeetingState(meeting);

  if (state === 'pending-analysis') {
    return 'Raw meeting audio is synced, but transcript and task extraction have not finished yet.';
  }

  if (state === 'processing') {
    return 'Momentum is still processing this recording.';
  }

  return String(meeting?.summary || '').trim() || 'No summary is available for this meeting yet.';
}

function getFocusBadgeClass(actionability) {
  if (actionability < 60) {
    return 'bg-rose-100 text-rose-800 border-rose-200';
  }

  if (actionability < 80) {
    return 'bg-amber-100 text-amber-800 border-amber-200';
  }

  return 'bg-emerald-100 text-emerald-800 border-emerald-200';
}
