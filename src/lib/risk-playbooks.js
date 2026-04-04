function buildDashboardPath(path, params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    const normalized = String(value || '').trim();
    if (normalized) {
      search.set(key, normalized);
    }
  });

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

function normalizeRiskText(value) {
  return String(value || '').trim().toLowerCase();
}

export function getRiskPlaybook({ risk, meeting } = {}) {
  const type = normalizeRiskText(risk?.type || risk?.label);
  const message = String(risk?.message || '').trim();
  const meetingId = String(meeting?.id || '').trim();
  const meetingTitle = String(meeting?.aiTitle || meeting?.title || meeting?.rawTitle || '').trim();
  const meetingQuery = meetingTitle || String(risk?.label || risk?.type || '').trim();
  const meetingTasksHref = buildDashboardPath('/dashboard/tasks', {
    q: meetingQuery,
    filter: 'Needs review',
  });
  const meetingRisksHref = buildDashboardPath('/dashboard/meetings', {
    filter: 'Risks Found',
    q: meetingQuery,
  });

  if (type.includes('owner unclear') || type.includes('no owner assigned')) {
    return {
      heading: 'Resolve the missing owner',
      steps: [
        'Open the follow-ups tied to this meeting and find the task with no accountable owner.',
        'Name one person who owns the next concrete step instead of leaving the work shared.',
        'Save the task so it moves out of review and the board reflects real accountability.',
      ],
      actions: [
        meetingId ? { label: 'Review meeting tasks', target: 'tasks' } : null,
        { label: 'Open unassigned tasks', to: buildDashboardPath('/dashboard/tasks', { filter: 'Unassigned', q: meetingQuery }) },
        meetingId ? { label: 'Open this meeting', to: `/dashboard/meetings/${meetingId}` } : null,
      ].filter(Boolean),
    };
  }

  if (type.includes('deadline') || message.toLowerCase().includes('due date')) {
    return {
      heading: 'Confirm the deadline',
      steps: [
        'Identify which follow-up still lacks a date or explicit timeframe.',
        'Add the real deadline the team agreed to, or record the nearest concrete checkpoint.',
        'If no date exists yet, assign an owner first and use review status until the date is confirmed.',
      ],
      actions: [
        meetingId ? { label: 'Edit task in this meeting', target: 'tasks' } : null,
        { label: 'Open missing-deadline tasks', to: buildDashboardPath('/dashboard/tasks', { filter: 'Missing deadline', q: meetingQuery }) },
        meetingId ? { label: 'Open this meeting', to: `/dashboard/meetings/${meetingId}` } : null,
      ].filter(Boolean),
    };
  }

  if (type.includes('low transcription confidence')) {
    return {
      heading: 'Validate the source signal',
      steps: [
        'Replay the source audio and compare it against the saved transcript before trusting any extracted task.',
        'Search the transcript around the ambiguous passage and confirm whether the wording supports the follow-up.',
        'If the signal is still weak, reprocess the recording or replace it with a clearer capture.',
      ],
      actions: [
        meetingId ? { label: 'Review transcript', target: 'transcript' } : null,
        meetingId ? { label: 'Play source audio', target: 'audio' } : null,
        { label: 'Open risky meetings', to: meetingRisksHref },
      ].filter(Boolean),
    };
  }

  if (type.includes('decision unclear')) {
    return {
      heading: 'Turn the decision into a concrete call',
      steps: [
        'Find the exact transcript lines where the team discussed the decision.',
        'Rewrite the outcome in plain language so the meeting leaves behind one explicit call, not a vague theme.',
        'Update or create the matching follow-up so ownership and timing are attached to the clarified decision.',
      ],
      actions: [
        meetingId ? { label: 'Inspect transcript evidence', target: 'transcript' } : null,
        meetingId ? { label: 'Review tasks', target: 'tasks' } : null,
        { label: 'Open risky meetings', to: meetingRisksHref },
      ].filter(Boolean),
    };
  }

  if (type.includes('task wording vague')) {
    return {
      heading: 'Rewrite the task for delivery',
      steps: [
        'Open the follow-up and replace abstract language with one concrete output or deliverable.',
        'Attach the owner and deadline while the original discussion is still visible in the transcript.',
        'Save the task only after the wording is specific enough that another teammate could execute it without asking again.',
      ],
      actions: [
        meetingId ? { label: 'Tighten meeting tasks', target: 'tasks' } : null,
        meetingId ? { label: 'Inspect transcript evidence', target: 'transcript' } : null,
        { label: 'Open review queue', to: buildDashboardPath('/dashboard/tasks', { filter: 'Needs review', q: meetingQuery }) },
      ].filter(Boolean),
    };
  }

  return {
    heading: 'Resolve this risk in context',
    steps: [
      'Open the meeting evidence and identify the exact line or task that triggered the warning.',
      'Make the smallest edit that turns the warning into a concrete owner, date, or decision.',
      'Re-check the board so the warning is gone for the right reason, not just hidden.',
    ],
    actions: [
      meetingId ? { label: 'Open this meeting', to: `/dashboard/meetings/${meetingId}` } : null,
      meetingId ? { label: 'Inspect transcript', target: 'transcript' } : null,
      { label: 'Open review queue', to: meetingTasksHref },
    ].filter(Boolean),
  };
}

