const DEMO_WORKSPACE_SLUG = 'momentum-demo';
const DEMO_WORKSPACE_NAME = 'Momentum Demo Workspace';
const ANALYSIS_VERSION = 'v2-rich-analysis';

let schemaSupportPromise = null;

export async function supportsV2WorkspaceSchema(supabase) {
  if (!schemaSupportPromise) {
    schemaSupportPromise = detectSchemaSupport(supabase).catch(() => false);
  }

  return schemaSupportPromise;
}

export function resetV2SchemaSupportCache() {
  schemaSupportPromise = null;
}

async function detectSchemaSupport(supabase) {
  const checks = await Promise.all([
    supabase.from('meeting_tasks').select('id').limit(1),
    supabase.from('meetings').select('id, ai_title, processing_status').limit(1),
    supabase.from('workspaces').select('id, slug').limit(1),
  ]);

  return checks.every((result) => !result.error);
}

export async function resolveWorkspaceContext(supabase, sourceMetadata = {}) {
  if (!(await supportsV2WorkspaceSchema(supabase))) {
    return null;
  }

  const connectionToken = String(sourceMetadata.connectionToken || '').trim();
  if (connectionToken) {
    const { data: connection } = await supabase
      .from('extension_connections')
      .select('id, workspace_id, created_by_profile_id')
      .eq('token', connectionToken)
      .maybeSingle();

    if (connection?.workspace_id) {
      return {
        workspaceId: connection.workspace_id,
        createdByProfileId: connection.created_by_profile_id || null,
        connectionId: connection.id,
      };
    }
  }

  const explicitWorkspaceId = String(sourceMetadata.workspaceId || '').trim();
  if (explicitWorkspaceId) {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', explicitWorkspaceId)
      .maybeSingle();

    if (workspace?.id) {
      return {
        workspaceId: workspace.id,
        createdByProfileId: null,
        connectionId: null,
      };
    }
  }

  const demoWorkspaceId = await ensureDemoWorkspace(supabase);
  if (!demoWorkspaceId) {
    return null;
  }

  return {
    workspaceId: demoWorkspaceId,
    createdByProfileId: null,
    connectionId: null,
  };
}

async function ensureDemoWorkspace(supabase) {
  const { data: existing } = await supabase
    .from('workspaces')
    .select('id')
    .eq('slug', DEMO_WORKSPACE_SLUG)
    .maybeSingle();

  if (existing?.id) {
    return existing.id;
  }

  const { data: inserted, error } = await supabase
    .from('workspaces')
    .insert({
      name: DEMO_WORKSPACE_NAME,
      slug: DEMO_WORKSPACE_SLUG,
      plan: 'hackathon',
    })
    .select('id')
    .single();

  if (error || !inserted?.id) {
    return null;
  }

  return inserted.id;
}

export function createMeetingContractFromAnalysis({
  legacyMeetingId = null,
  sourceMetadata = {},
  transcriptText,
  analysis,
  audioUrl = null,
}) {
  const summaryParagraph = String(
    analysis?.summary_paragraph || analysis?.summary || ''
  ).trim();
  const summaryBullets = normalizeBulletList(analysis?.summary_bullets);

  return {
    legacyMeetingId,
    sourceMetadata,
    transcriptText: String(transcriptText || '').trim(),
    audioUrl: String(audioUrl || '').trim() || null,
    aiTitle: String(analysis?.title || 'Meeting Summary').trim() || 'Meeting Summary',
    summaryParagraph: summaryParagraph || 'Momentum processed the meeting, but the summary needs review.',
    summaryBullets,
    decisions: normalizeDecisions(analysis?.decisions),
    tasks: normalizeTasks(analysis?.tasks),
    checklist: normalizeChecklist(analysis?.checklist, analysis?.tasks),
    riskFlags: normalizeRiskFlags(analysis?.risk_flags, analysis?.tasks, transcriptText),
    scores: normalizeScores(analysis),
    analysisVersion: String(analysis?.analysis_version || ANALYSIS_VERSION),
  };
}

export function createMeetingContractFromUnifiedMeeting(meeting) {
  return {
    legacyMeetingId: meeting?.id || null,
    sourceMetadata: {
      sourcePlatform: meeting?.source || 'google_meet',
      meetingCode: meeting?.sourceMeetingCode || '',
      meetingUrl: meeting?.sourceMeetingUrl || '',
      meetingLabel: meeting?.rawTitle || '',
      participantNames: meeting?.participants || [],
      recordingStartedAt: meeting?.createdAt || null,
      recordingStoppedAt: meeting?.createdAt || null,
    },
    transcriptText: String(meeting?.transcriptText || '').trim() || joinTranscript(meeting?.transcript),
    audioUrl: String(meeting?.audioUrl || '').trim() || null,
    aiTitle: String(meeting?.aiTitle || 'Meeting Summary').trim() || 'Meeting Summary',
    summaryParagraph: String(meeting?.summaryParagraph || '').trim() || 'Momentum backfilled this meeting from the legacy schema.',
    summaryBullets: normalizeBulletList(meeting?.summaryBullets),
    decisions: normalizeDecisions(meeting?.decisions),
    tasks: normalizeTasks(meeting?.tasks),
    checklist: normalizeChecklist(meeting?.checklist, meeting?.tasks),
    riskFlags: normalizeRiskFlags(meeting?.meetingRisks, meeting?.tasks, meeting?.transcriptText),
    scores: {
      overall: clampScore(meeting?.score?.overall),
      clarity: clampScore(meeting?.score?.clarity),
      ownership: clampScore(meeting?.score?.ownership),
      execution: clampScore(meeting?.score?.execution),
      rationale: String(meeting?.rationale || '').trim(),
    },
    analysisVersion: ANALYSIS_VERSION,
  };
}

export async function persistMeetingContract(supabase, contract) {
  const workspaceContext = await resolveWorkspaceContext(supabase, contract.sourceMetadata);
  if (!workspaceContext?.workspaceId) {
    return null;
  }

  const transcriptSegments = buildTranscriptSegmentsFromText(
    contract.transcriptText,
    contract.sourceMetadata?.participantNames || []
  );

  const basePayload = {
    workspace_id: workspaceContext.workspaceId,
    created_by_profile_id: workspaceContext.createdByProfileId,
    legacy_meeting_id: contract.legacyMeetingId,
    source_platform: normalizeSourcePlatform(contract.sourceMetadata?.sourcePlatform),
    source_meeting_url: cleanNullable(contract.sourceMetadata?.meetingUrl),
    source_meeting_code: cleanNullable(contract.sourceMetadata?.meetingCode),
    source_meeting_label: cleanNullable(contract.sourceMetadata?.meetingLabel),
    ai_title: cleanNullable(contract.aiTitle),
    summary_paragraph: cleanNullable(contract.summaryParagraph),
    summary_markdown: buildSummaryMarkdown(contract.summaryParagraph, contract.summaryBullets),
    transcript_text: cleanNullable(contract.transcriptText),
    audio_storage_path: cleanNullable(contract.audioUrl),
    recording_started_at: normalizeTimestamp(contract.sourceMetadata?.recordingStartedAt),
    recording_stopped_at: normalizeTimestamp(contract.sourceMetadata?.recordingStoppedAt),
    transcript_status: 'ready',
    extraction_status: 'ready',
    scoring_status: 'ready',
    processing_status: 'ready',
    processing_error: null,
    overall_score: clampScore(contract.scores?.overall),
    clarity_score: clampScore(contract.scores?.clarity),
    ownership_score: clampScore(contract.scores?.ownership),
    execution_score: clampScore(contract.scores?.execution),
    score_rationale: cleanNullable(contract.scores?.rationale),
    analysis_version: cleanNullable(contract.analysisVersion) || ANALYSIS_VERSION,
    updated_at: new Date().toISOString(),
  };

  const existingMeeting = contract.legacyMeetingId
    ? await findMeetingByLegacyId(supabase, contract.legacyMeetingId)
    : null;

  const meeting = existingMeeting?.id
    ? await updateV2MeetingRow(supabase, existingMeeting.id, basePayload)
    : await insertV2MeetingRow(supabase, basePayload);

  if (!meeting?.id) {
    return null;
  }

  await clearMeetingChildren(supabase, meeting.id);
  await insertMeetingChildren(supabase, meeting.id, {
    participants: contract.sourceMetadata?.participantNames || [],
    transcriptSegments,
    decisions: contract.decisions,
    tasks: contract.tasks,
    checklist: contract.checklist,
    riskFlags: contract.riskFlags,
  });
  await insertProcessingEvents(supabase, meeting.id);

  return meeting;
}

async function findMeetingByLegacyId(supabase, legacyMeetingId) {
  const { data } = await supabase
    .from('meetings')
    .select('id')
    .eq('legacy_meeting_id', legacyMeetingId)
    .maybeSingle();

  return data || null;
}

async function updateV2MeetingRow(supabase, meetingId, payload) {
  const { data } = await supabase
    .from('meetings')
    .update(payload)
    .eq('id', meetingId)
    .select('id')
    .single();

  return data || null;
}

async function insertV2MeetingRow(supabase, payload) {
  const { data } = await supabase
    .from('meetings')
    .insert(payload)
    .select('id')
    .single();

  return data || null;
}

async function clearMeetingChildren(supabase, meetingId) {
  await Promise.all([
    supabase.from('meeting_participants').delete().eq('meeting_id', meetingId),
    supabase.from('meeting_transcript_segments').delete().eq('meeting_id', meetingId),
    supabase.from('meeting_decisions').delete().eq('meeting_id', meetingId),
    supabase.from('meeting_tasks').delete().eq('meeting_id', meetingId),
    supabase.from('meeting_checklist_items').delete().eq('meeting_id', meetingId),
    supabase.from('meeting_risk_flags').delete().eq('meeting_id', meetingId),
    supabase.from('meeting_processing_events').delete().eq('meeting_id', meetingId),
  ]);
}

async function insertMeetingChildren(supabase, meetingId, payload) {
  const participantRows = Array.from(
    new Set((payload.participants || []).map((name) => cleanNullable(name)).filter(Boolean))
  ).map((displayName) => ({
    meeting_id: meetingId,
    display_name: displayName,
    confidence: 0.9,
  }));

  if (participantRows.length > 0) {
    await supabase.from('meeting_participants').insert(participantRows);
  }

  const segmentRows = (payload.transcriptSegments || []).map((segment, index) => ({
    meeting_id: meetingId,
    speaker: cleanNullable(segment.speaker),
    segment_index: index,
    started_at_seconds: segment.startedAtSeconds,
    ended_at_seconds: segment.endedAtSeconds,
    text: segment.text,
  }));

  if (segmentRows.length > 0) {
    await supabase.from('meeting_transcript_segments').insert(segmentRows);
  }

  const taskRows = (payload.tasks || []).map((task) => {
    const dueDateFields = splitDueDateFields(task.deadline);
    const normalizedTitle = cleanNullable(task.title) || 'Follow up on discussion';

    return {
      meeting_id: meetingId,
      legacy_task_id: task.legacyTaskId || null,
      title: normalizedTitle,
      owner_name: cleanNullable(task.assignee),
      due_date: dueDateFields.dueDate,
      due_date_label: dueDateFields.dueDateLabel,
      status: normalizeTaskStatus(task.status, task.needs_review),
      confidence: clampConfidence(task.confidence),
      needs_review: Boolean(task.needs_review),
      source_snippet: cleanNullable(task.source_snippet),
    };
  });

  if (taskRows.length > 0) {
    await supabase.from('meeting_tasks').insert(taskRows);
  }

  const decisionRows = (payload.decisions || []).map((decision) => ({
    meeting_id: meetingId,
    text: cleanNullable(decision.text) || 'Decision pending review',
    confidence: clampConfidence(decision.confidence),
    source_snippet: cleanNullable(decision.source_snippet),
  }));

  if (decisionRows.length > 0) {
    await supabase.from('meeting_decisions').insert(decisionRows);
  }

  const checklistRows = (payload.checklist || []).map((item) => ({
    meeting_id: meetingId,
    text: cleanNullable(item.text) || 'Checklist item',
    completed: Boolean(item.completed),
  }));

  if (checklistRows.length > 0) {
    await supabase.from('meeting_checklist_items').insert(checklistRows);
  }

  const riskRows = (payload.riskFlags || []).map((risk) => ({
    meeting_id: meetingId,
    type: cleanNullable(risk.type) || 'Review required',
    severity: cleanNullable(risk.severity) || 'Medium',
    message: cleanNullable(risk.message) || 'Momentum flagged this item for review.',
  }));

  if (riskRows.length > 0) {
    await supabase.from('meeting_risk_flags').insert(riskRows);
  }
}

async function insertProcessingEvents(supabase, meetingId) {
  const events = [
    { stage: 'uploaded', status: 'done', detail: 'Momentum received the meeting audio and metadata.' },
    { stage: 'transcribing', status: 'done', detail: 'The recording was transcribed successfully.' },
    { stage: 'extracting', status: 'done', detail: 'Decisions, tasks, checklist, and risk flags were extracted.' },
    { stage: 'scoring', status: 'done', detail: 'Execution quality scores were calculated.' },
    { stage: 'ready', status: 'done', detail: 'Momentum is ready.' },
  ].map((event) => ({
    meeting_id: meetingId,
    ...event,
  }));

  await supabase.from('meeting_processing_events').insert(events);
}

export function buildTranscriptSegmentsFromText(transcriptText, participantNames = []) {
  const speakers = participantNames.length > 0 ? participantNames : ['Speaker 1', 'Speaker 2', 'Speaker 3'];
  const sentences = String(transcriptText || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 24);

  return sentences.map((text, index) => ({
    speaker: speakers[index % speakers.length],
    text,
    startedAtSeconds: Number((index * 22.5).toFixed(2)),
    endedAtSeconds: Number((((index + 1) * 22.5) - 1).toFixed(2)),
  }));
}

function normalizeDecisions(decisions) {
  return (Array.isArray(decisions) ? decisions : [])
    .map((decision) => ({
      text: cleanNullable(decision?.text),
      confidence: clampConfidence(decision?.confidence),
      source_snippet: cleanNullable(decision?.source_snippet || decision?.sourceSnippet),
    }))
    .filter((decision) => decision.text);
}

function normalizeTasks(tasks) {
  return (Array.isArray(tasks) ? tasks : [])
    .map((task) => ({
      legacyTaskId: task?.legacyTaskId || task?.legacy_task_id || null,
      title: cleanNullable(task?.title),
      assignee: normalizeAmbiguousField(task?.assignee || task?.owner || task?.owner_name),
      deadline: normalizeDeadline(task?.deadline || task?.dueDate || task?.due_date || task?.due_date_label),
      status: cleanNullable(task?.status) || 'pending',
      confidence: clampConfidence(task?.confidence),
      needs_review: Boolean(task?.needs_review ?? task?.needsReview),
      source_snippet: cleanNullable(task?.source_snippet || task?.sourceSnippet),
    }))
    .filter((task) => task.title);
}

function normalizeChecklist(checklist, tasks) {
  const normalized = (Array.isArray(checklist) ? checklist : [])
    .map((item) => ({
      text: cleanNullable(item?.text),
      completed: Boolean(item?.completed),
    }))
    .filter((item) => item.text);

  if (normalized.length > 0) {
    return normalized;
  }

  return normalizeTasks(tasks).map((task) => ({
    text: task.title,
    completed: normalizeTaskStatus(task.status, task.needs_review) === 'done',
  }));
}

function normalizeRiskFlags(riskFlags, tasks, transcriptText) {
  const normalized = (Array.isArray(riskFlags) ? riskFlags : [])
    .map((risk) => ({
      type: cleanNullable(risk?.type),
      severity: cleanNullable(risk?.severity),
      message: cleanNullable(risk?.message),
    }))
    .filter((risk) => risk.type && risk.message);

  if (normalized.length > 0) {
    return normalized;
  }

  const fallback = [];
  normalizeTasks(tasks).forEach((task) => {
    if (!task.assignee) {
      fallback.push({
        type: 'No owner assigned',
        severity: 'High',
        message: `"${task.title}" still needs a clear owner.`,
      });
    }

    if (!task.deadline) {
      fallback.push({
        type: 'No deadline assigned',
        severity: 'Medium',
        message: `"${task.title}" does not have a confirmed deadline yet.`,
      });
    }
  });

  if (String(transcriptText || '').trim().split(/\s+/).filter(Boolean).length < 25) {
    fallback.push({
      type: 'Low transcription confidence',
      severity: 'Medium',
      message: 'The transcript is short, so Momentum recommends a quick review.',
    });
  }

  return fallback.slice(0, 8);
}

function normalizeScores(analysis) {
  const clarity = clampScore(analysis?.clarity_score ?? analysis?.clarity);
  const ownership = clampScore(analysis?.ownership_score ?? analysis?.ownership ?? analysis?.actionability_score);
  const execution = clampScore(analysis?.execution_score ?? analysis?.execution ?? analysis?.actionability_score);
  const overall =
    clampScore(analysis?.overall_score) ||
    Math.round(clarity * 0.35 + ownership * 0.35 + execution * 0.3);

  return {
    overall,
    clarity,
    ownership,
    execution,
    rationale:
      cleanNullable(analysis?.score_rationale || analysis?.rationale) ||
      'Momentum found useful action items and scored the meeting based on clarity, ownership, and execution readiness.',
  };
}

function normalizeBulletList(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => cleanNullable(item))
    .filter(Boolean)
    .slice(0, 5);
}

function joinTranscript(segments) {
  return (Array.isArray(segments) ? segments : [])
    .map((segment) => cleanNullable(segment?.text))
    .filter(Boolean)
    .join(' ');
}

function buildSummaryMarkdown(summaryParagraph, summaryBullets) {
  const bullets = normalizeBulletList(summaryBullets);
  return [cleanNullable(summaryParagraph), ...bullets.map((bullet) => `- ${bullet}`)]
    .filter(Boolean)
    .join('\n');
}

function splitDueDateFields(value) {
  const dueDateLabel = cleanNullable(value);
  if (!dueDateLabel) {
    return { dueDate: null, dueDateLabel: null };
  }

  return {
    dueDate: parseCalendarDate(dueDateLabel),
    dueDateLabel,
  };
}

function parseCalendarDate(value) {
  const text = cleanNullable(value);
  if (!text) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const dateWithYear = /\b\d{4}\b/.test(text) ? text : `${text}, ${new Date().getUTCFullYear()}`;
  const parsed = Date.parse(dateWithYear);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

function normalizeTaskStatus(status, needsReview) {
  if (needsReview) {
    return 'needs-review';
  }

  const normalized = String(status || '').trim().toLowerCase();
  if (['done', 'completed'].includes(normalized)) {
    return 'done';
  }

  if (['in progress', 'in-progress', 'in_progress', 'doing'].includes(normalized)) {
    return 'in-progress';
  }

  if (['needs-review', 'needs review', 'review'].includes(normalized)) {
    return 'needs-review';
  }

  return 'pending';
}

function normalizeDeadline(value) {
  const normalized = cleanNullable(value);
  if (!normalized || ['missing', 'none', 'unknown'].includes(normalized.toLowerCase())) {
    return '';
  }

  return normalized;
}

function normalizeAmbiguousField(value) {
  const normalized = cleanNullable(value);
  if (
    !normalized ||
    ['unclear', 'unknown', 'missing', 'tbd', 'someone', 'somebody', 'anyone', 'everyone', 'team'].includes(
      normalized.toLowerCase()
    )
  ) {
    return '';
  }

  return normalized;
}

function normalizeTimestamp(value) {
  const text = cleanNullable(value);
  if (!text) {
    return null;
  }

  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString();
}

function normalizeSourcePlatform(value) {
  const text = cleanNullable(value);
  return text || 'google_meet';
}

function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(number)));
}

function clampConfidence(value) {
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number) || number <= 0) {
    return 0.65;
  }

  return Math.max(0.4, Math.min(0.99, Number(number.toFixed(3))));
}

function cleanNullable(value) {
  const text = String(value || '').trim();
  return text || null;
}
