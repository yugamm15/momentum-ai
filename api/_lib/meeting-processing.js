/* global process */
import { createClient } from '@supabase/supabase-js';
import {
  createMeetingContractFromAnalysis,
  persistMeetingContract,
} from './v2-persistence.js';
import { getLegacyTableNames } from './legacy-tables.js';

const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'meetings';

export function getEnv(options = {}) {
  const requireGroq = options.requireGroq !== false;
  const requireGemini = options.requireGemini !== false;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (
    !supabaseUrl ||
    !supabaseKey ||
    (requireGroq && !groqKey) ||
    (requireGemini && !geminiKey)
  ) {
    throw new Error('Server environment variables are incomplete.');
  }

  return {
    supabaseUrl,
    supabaseKey,
    groqKey,
    geminiKey,
    storageBucket: STORAGE_BUCKET,
  };
}

export function createSupabaseClient(env) {
  return createClient(env.supabaseUrl, env.supabaseKey);
}

export async function processMeetingAudio({
  file,
  meetingCode,
  contentType,
  supabase,
  env,
  existingMeetingId = '',
  existingAudioUrl = null,
  sourceMetadata = {},
}) {
  const normalizedSourceMetadata = normalizeSourceMetadata(sourceMetadata, meetingCode);
  const normalizedFile = await normalizeInputFile(file, contentType, normalizedSourceMetadata.meetingCode);
  const transcript = await transcribeRecording(normalizedFile, env.groqKey);
  const analysis = await analyzeTranscriptWithFallback(transcript, env.geminiKey, normalizedSourceMetadata);
  const audioUrl = await tryUploadRecordingToStorage(
    supabase,
    normalizedFile,
    normalizedFile.type || contentType || 'audio/webm',
    sanitizeMeetingCode(normalizedSourceMetadata.meetingCode),
    env.storageBucket
  );

  const meeting = await saveMeetingRecord(
    supabase,
    {
      title: analysis.title,
      summary: analysis.summary_paragraph || analysis.summary,
      transcript,
      clarity: analysis.clarity_score,
      actionability: analysis.execution_score || analysis.actionability_score || analysis.overall_score,
      audioUrl,
    },
    {
      existingMeetingId,
      existingAudioUrl,
    }
  );

  await replaceMeetingTasks(supabase, meeting.id, analysis.tasks);

  await persistMeetingContract(
    supabase,
    createMeetingContractFromAnalysis({
      legacyMeetingId: meeting.id,
      sourceMetadata: normalizedSourceMetadata,
      transcriptText: transcript,
      analysis,
      audioUrl,
    })
  ).catch(() => null);

  return {
    meeting,
    transcript,
    analysis,
    audioUrl,
  };
}

async function normalizeInputFile(file, contentType, meetingCode) {
  if (!file) {
    throw new Error('Missing meeting audio file.');
  }

  if (file instanceof File) {
    return file;
  }

  const safeMeetingCode = sanitizeMeetingCode(meetingCode) || 'meeting';
  const type = String(contentType || file.type || 'audio/webm').trim() || 'audio/webm';
  const extension = getFileExtension(type);
  const name = `momentum_${safeMeetingCode}_${Date.now()}.${extension}`;
  const blob = file instanceof Blob ? file : new Blob([file], { type });
  return new File([blob], name, { type });
}

function getFileExtension(contentType) {
  const normalized = String(contentType || '').toLowerCase();

  if (normalized.includes('wav')) {
    return 'wav';
  }

  if (normalized.includes('mp3') || normalized.includes('mpeg')) {
    return 'mp3';
  }

  if (normalized.includes('m4a') || normalized.includes('mp4')) {
    return 'm4a';
  }

  return 'webm';
}

async function tryUploadRecordingToStorage(supabase, file, contentType, meetingCode, bucketName) {
  if (!bucketName) {
    return null;
  }

  try {
    const safeMeetingCode = meetingCode || 'meeting';
    const storagePath = `raw/${Date.now()}_${sanitizeFileName(file.name || `momentum_${safeMeetingCode}.webm`)}`;

    const uploadResult = await supabase.storage.from(bucketName).upload(storagePath, file, {
      contentType,
      upsert: false,
    });

    if (uploadResult.error) {
      return null;
    }

    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
    return publicUrlData?.publicUrl || null;
  } catch {
    return null;
  }
}

async function transcribeRecording(file, groqKey) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'json');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Groq could not transcribe the uploaded meeting.'));
  }

  const data = await response.json();
  const transcript = String(data?.text || '').trim();

  if (!transcript) {
    throw new Error('Groq returned an empty transcript.');
  }

  return transcript;
}

async function analyzeTranscriptWithFallback(transcript, geminiKey, sourceMetadata) {
  try {
    return await analyzeTranscript(transcript, geminiKey, sourceMetadata);
  } catch {
    return buildFallbackAnalysis(transcript, sourceMetadata);
  }
}

async function analyzeTranscript(transcript, geminiKey, sourceMetadata) {
  const prompt = [
    'You are Momentum AI, an execution-intelligence assistant for meetings.',
    'Read the transcript and return only valid JSON with this exact shape:',
    '{',
    '  "title": "Short clear meeting title",',
    '  "summary_paragraph": "A concise executive paragraph",',
    '  "summary_bullets": ["Point one", "Point two"],',
    '  "decisions": [',
    '    { "text": "Decision text", "confidence": 0.92, "source_snippet": "Short supporting quote" }',
    '  ],',
    '  "tasks": [',
    '    {',
    '      "title": "Task description",',
    '      "assignee": "Exact participant name or UNCLEAR",',
    '      "deadline": "Exact date phrase or Missing",',
    '      "status": "Pending",',
    '      "confidence": 0.88,',
    '      "needs_review": false,',
    '      "source_snippet": "Short supporting quote"',
    '    }',
    '  ],',
    '  "checklist": [',
    '    { "text": "Checklist item", "completed": false }',
    '  ],',
    '  "risk_flags": [',
    '    { "type": "No owner assigned", "severity": "Medium", "message": "Why it matters" }',
    '  ],',
    '  "overall_score": 82,',
    '  "clarity_score": 84,',
    '  "ownership_score": 77,',
    '  "execution_score": 83,',
    '  "score_rationale": "One concise rationale sentence"',
    '}',
    'Rules:',
    '- Be conservative. Do not invent owners or deadlines silently.',
    '- Use UNCLEAR when ownership is ambiguous.',
    '- Use Missing when no deadline is stated.',
    '- When one participant asks another named participant to do something, assign the task to the named recipient, not the speaker.',
    '- Prefer assignee names that exactly match the visible participant roster when possible.',
    '- Keep source_snippet short and grounded in the transcript.',
    '- Decisions should be explicit or strongly implied, not guesses.',
    '- If a task has UNCLEAR owner or Missing deadline, set needs_review to true.',
    '',
    `Meeting code: ${sourceMetadata.meetingCode || 'unknown'}`,
    `Visible meeting label: ${sourceMetadata.meetingLabel || 'unknown'}`,
    `Visible participants: ${(sourceMetadata.participantNames || []).join(', ') || 'unknown'}`,
    '',
    'Transcript:',
    transcript,
  ].join('\n');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Gemini could not analyze the meeting transcript.'));
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
  const parsed = JSON.parse(extractJsonObject(rawText));

  return normalizeAnalysis(parsed, transcript, sourceMetadata);
}

export function buildFallbackAnalysis(transcript, sourceMetadata = {}) {
  const sentences = splitTranscriptIntoSentences(transcript);
  const transcriptLooksLowSignal = isLowSignalTranscript(transcript, sentences);
  const fallbackTasks = extractFallbackTasks(sentences);
  const summarySentences = transcriptLooksLowSignal
    ? []
    : sentences.slice(0, Math.min(4, Math.max(2, sentences.length)));
  const summaryParagraph = buildFallbackSummary(summarySentences, fallbackTasks.length, transcriptLooksLowSignal);
  const summaryBullets = summarySentences.slice(0, 4);
  const tasks = fallbackTasks.map((task) => ({
    ...task,
    status: task.assignee && task.deadline ? 'pending' : 'needs-review',
    confidence: task.assignee && task.deadline ? 0.82 : task.assignee || task.deadline ? 0.71 : 0.61,
    needs_review: !task.assignee || !task.deadline,
    source_snippet: task.source_snippet,
  }));
  const clarityScore = clampScore(transcriptLooksLowSignal ? 15 : 70 + Math.min(20, summarySentences.length * 5));
  const ownershipScore = calculateOwnershipScore(tasks);
  const executionScore = clampScore(
    transcriptLooksLowSignal
      ? 5
      : tasks.length === 0
        ? 45
        : 65 + Math.min(25, tasks.length * 7) - Math.min(20, tasks.filter((task) => task.needs_review).length * 5)
  );
  const overallScore = clampScore(
    Math.round(clarityScore * 0.35 + ownershipScore * 0.35 + executionScore * 0.3)
  );

  return normalizeAnalysis(
    {
      title: buildFallbackTitle(sentences, sourceMetadata.meetingCode),
      summary_paragraph: summaryParagraph,
      summary_bullets: summaryBullets,
      decisions: buildFallbackDecisions(summarySentences),
      tasks,
      checklist: tasks.map((task) => ({ text: task.title, completed: false })),
      risk_flags: buildFallbackRiskFlags(tasks, transcriptLooksLowSignal),
      overall_score: overallScore,
      clarity_score: clarityScore,
      ownership_score: ownershipScore,
      execution_score: executionScore,
      score_rationale: buildScoreRationale({
        clarityScore,
        ownershipScore,
        executionScore,
        tasks,
      }),
    },
    transcript,
    sourceMetadata
  );
}

async function saveMeetingRecord(supabase, meeting, options = {}) {
  const existingMeetingId = String(options?.existingMeetingId || '').trim();
  const legacyTables = await getLegacyTableNames(supabase);

  if (existingMeetingId) {
    const { data: existingMeeting, error: existingError } = await supabase
      .from(legacyTables.meetings)
      .select('id, audio_url')
      .eq('id', existingMeetingId)
      .single();

    if (existingError || !existingMeeting?.id) {
      throw new Error(existingError?.message || 'Momentum could not find the stored meeting row to update.');
    }

    const { data, error } = await supabase
      .from(legacyTables.meetings)
      .update({
        title: meeting.title,
        summary: meeting.summary,
        transcript: meeting.transcript,
        clarity: meeting.clarity,
        actionability: meeting.actionability,
        audio_url: meeting.audioUrl || existingMeeting.audio_url || options?.existingAudioUrl || null,
        status: 'completed',
      })
      .eq('id', existingMeetingId)
      .select()
      .single();

    if (error || !data?.id) {
      throw new Error(error?.message || 'Supabase could not update the existing meeting record.');
    }

    return data;
  }

  const placeholder = await findPlaceholderMeeting(supabase);

  if (placeholder?.id) {
    const { data, error } = await supabase
      .from(legacyTables.meetings)
      .update({
        title: meeting.title,
        summary: meeting.summary,
        transcript: meeting.transcript,
        clarity: meeting.clarity,
        actionability: meeting.actionability,
        audio_url: meeting.audioUrl,
        status: 'completed',
      })
      .eq('id', placeholder.id)
      .select()
      .single();

    if (error || !data?.id) {
      throw new Error(error?.message || 'Supabase could not update the processing meeting row.');
    }

    await cleanupBlankProcessingRows(supabase, data.id);
    return data;
  }

  const { data, error } = await supabase
    .from(legacyTables.meetings)
    .insert({
      title: meeting.title,
      summary: meeting.summary,
      transcript: meeting.transcript,
      clarity: meeting.clarity,
      actionability: meeting.actionability,
      audio_url: meeting.audioUrl,
      status: 'completed',
    })
    .select()
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || 'Supabase rejected the meeting record.');
  }

  await cleanupBlankProcessingRows(supabase, data.id);
  return data;
}

async function replaceMeetingTasks(supabase, meetingId, tasks) {
  const legacyTables = await getLegacyTableNames(supabase);
  const { error: deleteError } = await supabase.from(legacyTables.tasks).delete().eq('meeting_id', meetingId);

  if (deleteError) {
    throw new Error(deleteError.message || 'Supabase could not replace the extracted tasks.');
  }

  if (!tasks.length) {
    return;
  }

  const rows = tasks.map((task) => {
    const assignee = sanitizeField(task.assignee, 'UNCLEAR');
    const deadline = sanitizeField(task.deadline, 'Missing');
    const hasAmbiguity = !task.assignee || !task.deadline || task.needs_review;

    return {
      meeting_id: meetingId,
      title: sanitizeField(task.title, 'Follow up on discussion'),
      assignee,
      deadline,
      status: hasAmbiguity ? 'needs-review' : normalizeLegacyTaskStatus(task.status),
    };
  });

  const { error } = await supabase.from(legacyTables.tasks).insert(rows);

  if (error) {
    throw new Error(error.message || 'Supabase rejected the extracted tasks.');
  }
}

async function findPlaceholderMeeting(supabase) {
  const threshold = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const legacyTables = await getLegacyTableNames(supabase);
  const { data, error } = await supabase
    .from(legacyTables.meetings)
    .select('id, created_at')
    .eq('status', 'processing')
    .is('title', null)
    .is('summary', null)
    .is('transcript', null)
    .is('audio_url', null)
    .gte('created_at', threshold)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    return null;
  }

  return data?.[0] || null;
}

async function cleanupBlankProcessingRows(supabase, keepId) {
  const threshold = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const legacyTables = await getLegacyTableNames(supabase);
  const { data, error } = await supabase
    .from(legacyTables.meetings)
    .select('id')
    .eq('status', 'processing')
    .is('title', null)
    .is('summary', null)
    .is('transcript', null)
    .is('audio_url', null)
    .gte('created_at', threshold);

  if (error || !data?.length) {
    return;
  }

  const idsToDelete = data.map((row) => row.id).filter((id) => id !== keepId);
  if (!idsToDelete.length) {
    return;
  }

  await supabase.from(legacyTables.meetings).delete().in('id', idsToDelete);
}

function normalizeAnalysis(analysis, transcript = '', sourceMetadata = {}) {
  const rawTasks = Array.isArray(analysis?.tasks) ? analysis.tasks : [];
  const normalizedTasks = rawTasks
    .map((task) => normalizeTask(task))
    .filter((task) => task.title);
  const ownerResolution = resolveTaskOwners(
    normalizedTasks,
    sourceMetadata?.participantNames || []
  );
  const tasks = ownerResolution.tasks;

  const summaryParagraph = sanitizeField(
    analysis?.summary_paragraph ?? analysis?.summary,
    'Transcript processed successfully.'
  );
  const summaryBullets = normalizeSummaryBullets(analysis?.summary_bullets, summaryParagraph);
  const clarityScore = clampScore(analysis?.clarity_score ?? analysis?.clarity);
  const ownershipScore = clampScore(
    analysis?.ownership_score ?? analysis?.ownership ?? calculateOwnershipScore(tasks)
  );
  const executionScore = clampScore(
    analysis?.execution_score ?? analysis?.execution ?? analysis?.actionability_score ?? analysis?.actionability
  );
  const overallScore =
    clampScore(analysis?.overall_score) ||
    clampScore(Math.round(clarityScore * 0.35 + ownershipScore * 0.35 + executionScore * 0.3));

  return {
    title: sanitizeField(analysis?.title, 'Meeting Summary'),
    summary: summaryParagraph,
    summary_paragraph: summaryParagraph,
    summary_bullets: summaryBullets,
    clarity_score: clarityScore,
    ownership_score: ownershipScore,
    execution_score: executionScore,
    actionability_score: executionScore,
    overall_score: overallScore,
    score_rationale:
      sanitizeField(
        analysis?.score_rationale,
        buildScoreRationale({
          clarityScore,
          ownershipScore,
          executionScore,
          tasks,
        })
      ),
    decisions: normalizeDecisions(analysis?.decisions, summaryBullets, transcript),
    tasks,
    checklist: normalizeChecklist(analysis?.checklist, tasks),
    risk_flags: normalizeRiskFlags(
      analysis?.risk_flags,
      tasks,
      transcript,
      ownerResolution.ownerResolutionRisks
    ),
  };
}

function normalizeTask(task) {
  const assignee = normalizeAmbiguousValue(task?.assignee || task?.owner || task?.owner_name);
  const deadline = normalizeDeadlineValue(task?.deadline || task?.dueDate || task?.due_date);
  const needsReview = Boolean(task?.needs_review ?? task?.needsReview) || !assignee || !deadline;

  return {
    title: sanitizeField(task?.title, ''),
    assignee,
    deadline,
    status: normalizeTaskStatus(task?.status, needsReview),
    confidence: clampConfidence(task?.confidence),
    needs_review: needsReview,
    source_snippet: sanitizeField(task?.source_snippet || task?.sourceSnippet, ''),
  };
}

function normalizeDecisions(decisions, summaryBullets, transcript) {
  const normalized = (Array.isArray(decisions) ? decisions : [])
    .map((decision) => ({
      text: sanitizeField(decision?.text, ''),
      confidence: clampConfidence(decision?.confidence),
      source_snippet: sanitizeField(decision?.source_snippet || decision?.sourceSnippet, ''),
    }))
    .filter((decision) => decision.text);

  if (normalized.length > 0) {
    return normalized;
  }

  const transcriptSentences = splitTranscriptIntoSentences(transcript);
  return (summaryBullets || []).slice(0, 3).map((bullet, index) => ({
    text: bullet,
    confidence: 0.68,
    source_snippet: transcriptSentences[index] || bullet,
  }));
}

function normalizeChecklist(checklist, tasks) {
  const normalized = (Array.isArray(checklist) ? checklist : [])
    .map((item) => ({
      text: sanitizeField(item?.text, ''),
      completed: Boolean(item?.completed),
    }))
    .filter((item) => item.text);

  if (normalized.length > 0) {
    return normalized;
  }

  return tasks.map((task) => ({
    text: task.title,
    completed: task.status === 'done',
  }));
}

function normalizeRiskFlags(riskFlags, tasks, transcript, ownerResolutionRisks = []) {
  const normalized = (Array.isArray(riskFlags) ? riskFlags : [])
    .map((risk) => ({
      type: sanitizeField(risk?.type, ''),
      severity: sanitizeField(risk?.severity, 'Medium'),
      message: sanitizeField(risk?.message, ''),
    }))
    .filter((risk) => risk.type && risk.message);

  return dedupeRiskFlags([
    ...normalized,
    ...ownerResolutionRisks,
    ...buildFallbackRiskFlags(
      tasks,
      isLowSignalTranscript(transcript, splitTranscriptIntoSentences(transcript))
    ),
  ]).slice(0, 10);
}

function buildFallbackTitle(sentences, meetingCode) {
  const sanitizedCode = sanitizeMeetingCode(meetingCode);
  if (sanitizedCode) {
    return `Meeting review for ${sanitizedCode}`;
  }

  const firstSentence = sentences[0] || 'Meeting Summary';
  const title = firstSentence
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 6)
    .join(' ');

  return title || 'Meeting Summary';
}

function buildFallbackSummary(summarySentences, taskCount, transcriptLooksLowSignal) {
  if (transcriptLooksLowSignal) {
    return 'Momentum captured the audio file, but the transcript contained too little clear speech for a reliable summary.';
  }

  const summary = summarySentences.join(' ').trim();
  if (summary) {
    return taskCount > 0
      ? `${summary} Momentum also identified ${taskCount} follow-up item${taskCount === 1 ? '' : 's'}.`
      : summary;
  }

  return 'Transcript processed successfully, but the AI fallback summary had limited detail to work with.';
}

function buildFallbackDecisions(summarySentences) {
  return summarySentences.slice(0, 3).map((sentence) => ({
    text: sentence,
    confidence: 0.63,
    source_snippet: sentence,
  }));
}

function splitTranscriptIntoSentences(transcript) {
  return String(transcript || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function isLowSignalTranscript(transcript, sentences) {
  const words = String(transcript || '')
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
  const uniqueWords = new Set(words);

  return words.length < 6 || uniqueWords.size < 3 || sentences.length === 0;
}

function extractFallbackTasks(sentences) {
  const taskKeywords = [
    'will',
    'should',
    'need to',
    'needs to',
    'follow up',
    'send',
    'share',
    'update',
    'confirm',
    'review',
    'create',
    'prepare',
    'deploy',
    'fix',
    'finish',
  ];

  return sentences
    .filter((sentence) =>
      taskKeywords.some((keyword) => sentence.toLowerCase().includes(keyword))
    )
    .slice(0, 8)
    .map((sentence) => ({
      title: sentence.replace(/^[-*]\s*/, '').trim(),
      assignee: normalizeAmbiguousValue(inferFallbackAssignee(sentence)),
      deadline: normalizeDeadlineValue(inferFallbackDeadline(sentence)),
      source_snippet: sentence,
    }));
}

function inferFallbackAssignee(sentence) {
  const explicitOwner = String(sentence || '').match(/\b([A-Z][a-z]+)\s+(?:will|should|needs?\s+to)\b/);
  if (explicitOwner) {
    return explicitOwner[1];
  }

  return '';
}

function inferFallbackDeadline(sentence) {
  const match = String(sentence || '').match(
    /\b(today|tomorrow|tonight|next week|next month|monday|tuesday|wednesday|thursday|friday|saturday|sunday|by [^.,;]+|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/i
  );

  return match ? match[0] : '';
}

function extractJsonObject(text) {
  const cleaned = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Gemini returned invalid JSON.');
  }

  return cleaned.slice(start, end + 1);
}

function normalizeSourceMetadata(sourceMetadata, meetingCode) {
  return {
    sourcePlatform: sanitizeField(sourceMetadata?.sourcePlatform, 'google_meet'),
    meetingCode: sanitizeMeetingCode(sourceMetadata?.meetingCode || meetingCode),
    meetingUrl: sanitizeOptionalField(sourceMetadata?.meetingUrl),
    meetingLabel: sanitizeOptionalField(sourceMetadata?.meetingLabel),
    participantNames: dedupeNames(sourceMetadata?.participantNames),
    transcriptSegments: normalizeSourceTranscriptSegments(sourceMetadata?.transcriptSegments),
    recordingStartedAt: sanitizeOptionalField(sourceMetadata?.recordingStartedAt),
    recordingStoppedAt: sanitizeOptionalField(sourceMetadata?.recordingStoppedAt),
    connectionToken: sanitizeOptionalField(sourceMetadata?.connectionToken),
    workspaceId: sanitizeOptionalField(sourceMetadata?.workspaceId),
    userId: sanitizeOptionalField(sourceMetadata?.userId),
    extensionVersion: sanitizeOptionalField(sourceMetadata?.extensionVersion),
  };
}

function resolveTaskOwners(tasks, participantNames = []) {
  const roster = dedupeNames(participantNames)
    .map((displayName) => buildParticipantRecord(displayName))
    .filter(Boolean);

  if (!roster.length) {
    return {
      tasks,
      ownerResolutionRisks: [],
    };
  }

  const ownerResolutionRisks = [];
  const resolvedTasks = tasks.map((task) => {
    if (!task.assignee) {
      return {
        ...task,
        status: normalizeTaskStatus(task.status, task.needs_review),
      };
    }

    const match = matchOwnerToParticipant(task.assignee, roster);
    if (match.status === 'matched') {
      return {
        ...task,
        assignee: match.displayName,
        status: normalizeTaskStatus(task.status, task.needs_review),
      };
    }

    ownerResolutionRisks.push({
      type: match.status === 'ambiguous' ? 'Conflicting ownership' : 'Missing participant match',
      severity: 'Medium',
      message:
        match.status === 'ambiguous'
          ? `"${task.title}" mentioned "${task.assignee}", but multiple visible participants match that owner.`
          : `"${task.title}" mentioned "${task.assignee}", but that owner was not visible in the meeting roster.`,
    });

    return {
      ...task,
      assignee: '',
      needs_review: true,
      confidence: Math.min(task.confidence, 0.74),
      status: normalizeTaskStatus(task.status, true),
    };
  });

  return {
    tasks: resolvedTasks,
    ownerResolutionRisks,
  };
}

function buildParticipantRecord(displayName) {
  const normalized = normalizePersonName(displayName);
  if (!normalized) {
    return null;
  }

  const tokens = normalized.split(' ').filter(Boolean);
  return {
    displayName,
    normalized,
    tokens,
    firstToken: tokens[0] || '',
  };
}

function matchOwnerToParticipant(owner, roster) {
  const normalizedOwner = normalizePersonName(owner);
  if (!normalizedOwner || isCollectiveOwner(normalizedOwner)) {
    return { status: 'unmatched' };
  }

  const exactMatches = roster.filter((participant) => participant.normalized === normalizedOwner);
  if (exactMatches.length === 1) {
    return {
      status: 'matched',
      displayName: exactMatches[0].displayName,
      score: 1,
    };
  }

  if (exactMatches.length > 1) {
    return { status: 'ambiguous', score: 1 };
  }

  const ownerTokens = normalizedOwner.split(' ').filter(Boolean);
  const scored = roster
    .map((participant) => ({
      ...participant,
      score: scoreOwnerCandidate(ownerTokens, participant),
    }))
    .filter((participant) => participant.score > 0)
    .sort((left, right) => right.score - left.score);

  if (!scored.length || scored[0].score < 0.76) {
    return { status: 'unmatched' };
  }

  const [best, second] = scored;
  if (second && best.score - second.score < 0.08) {
    return { status: 'ambiguous', score: best.score };
  }

  return {
    status: 'matched',
    displayName: best.displayName,
    score: best.score,
  };
}

function scoreOwnerCandidate(ownerTokens, participant) {
  if (!ownerTokens.length) {
    return 0;
  }

  if (ownerTokens.join(' ') === participant.normalized) {
    return 1;
  }

  if (ownerTokens.length === 1 && ownerTokens[0] === participant.firstToken) {
    return 0.94;
  }

  if (ownerTokens.every((token) => participant.tokens.includes(token))) {
    return Math.min(0.99, 0.86 + ownerTokens.length * 0.05);
  }

  if (participant.tokens.every((token) => ownerTokens.includes(token))) {
    return 0.82;
  }

  if (ownerTokens.length === 1 && participant.tokens.includes(ownerTokens[0])) {
    return 0.78;
  }

  return 0;
}

function normalizePersonName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s'.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isCollectiveOwner(value) {
  return ['team', 'everyone', 'anyone', 'someone', 'somebody', 'all', 'group', 'we', 'us'].includes(
    String(value || '').trim().toLowerCase()
  );
}

function normalizeSummaryBullets(summaryBullets, summaryParagraph) {
  const normalized = (Array.isArray(summaryBullets) ? summaryBullets : [])
    .map((item) => sanitizeOptionalField(item))
    .filter(Boolean)
    .slice(0, 5);

  if (normalized.length > 0) {
    return normalized;
  }

  return splitTranscriptIntoSentences(summaryParagraph).slice(0, 4);
}

function buildFallbackRiskFlags(tasks, transcriptLooksLowSignal) {
  const risks = [];

  tasks.forEach((task) => {
    if (!task.assignee) {
      risks.push({
        type: 'No owner assigned',
        severity: 'High',
        message: `"${task.title}" still needs a clear owner.`,
      });
    }

    if (!task.deadline) {
      risks.push({
        type: 'No deadline assigned',
        severity: 'Medium',
        message: `"${task.title}" does not have a confirmed deadline yet.`,
      });
    }
  });

  if (transcriptLooksLowSignal) {
    risks.push({
      type: 'Low transcription confidence',
      severity: 'Medium',
      message: 'The transcript signal is weak, so Momentum recommends a quick review.',
    });
  }

  return risks.slice(0, 8);
}

function dedupeRiskFlags(risks) {
  const seen = new Set();

  return risks.filter((risk) => {
    const type = sanitizeOptionalField(risk?.type).toLowerCase();
    const message = sanitizeOptionalField(risk?.message).toLowerCase();
    const key = `${type}::${message}`;

    if (!type || !message || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function calculateOwnershipScore(tasks) {
  if (!tasks.length) {
    return 68;
  }

  const explicitOwners = tasks.filter((task) => task.assignee).length;
  const explicitDeadlines = tasks.filter((task) => task.deadline).length;

  return clampScore(Math.round(((explicitOwners + explicitDeadlines) / (tasks.length * 2)) * 100));
}

function buildScoreRationale({ clarityScore, ownershipScore, executionScore, tasks }) {
  const fullyOwnedTasks = tasks.filter((task) => task.assignee && task.deadline).length;

  if (tasks.length > 0 && fullyOwnedTasks === tasks.length && clarityScore >= 80) {
    return 'Strong decisions, explicit ownership, and clear deadlines make this meeting highly executable.';
  }

  if (ownershipScore < 70) {
    return 'Momentum found useful follow-ups, but ownership is still ambiguous on a few action items.';
  }

  if (executionScore < 70) {
    return 'The team aligned well, but several follow-ups still need sharper deadlines or more concrete wording.';
  }

  return 'The meeting produced meaningful action items, with a few open edges that should be reviewed before execution.';
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

  return 'pending';
}

function normalizeLegacyTaskStatus(status) {
  if (status === 'done') {
    return 'done';
  }

  if (status === 'in-progress') {
    return 'in-progress';
  }

  return 'todo';
}

function normalizeAmbiguousValue(value) {
  const text = sanitizeOptionalField(value);
  if (!text) {
    return '';
  }

  const normalized = text.toLowerCase();
  if (
    ['unclear', 'unknown', 'missing', 'tbd', 'someone', 'somebody', 'anyone', 'everyone', 'team'].includes(
      normalized
    )
  ) {
    return '';
  }

  return text;
}

function normalizeDeadlineValue(value) {
  const text = sanitizeOptionalField(value);
  if (!text) {
    return '';
  }

  const normalized = text.toLowerCase();
  if (['missing', 'unknown', 'none'].includes(normalized)) {
    return '';
  }

  return text;
}

function dedupeNames(names) {
  return Array.from(
    new Set(
      (Array.isArray(names) ? names : [])
        .map((name) => sanitizeOptionalField(name))
        .filter(Boolean)
    )
  );
}

function normalizeSourceTranscriptSegments(segments) {
  return (Array.isArray(segments) ? segments : [])
    .map((segment) => ({
      speaker: sanitizeOptionalField(segment?.speaker || segment?.speakerLabel),
      text: sanitizeOptionalField(segment?.text),
      startedAtSeconds: Number(segment?.startedAtSeconds ?? segment?.started_at_seconds ?? 0),
      endedAtSeconds: Number(segment?.endedAtSeconds ?? segment?.ended_at_seconds ?? 0),
    }))
    .filter((segment) => segment.text);
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

function sanitizeField(value, fallback) {
  const text = String(value || '').trim();
  return text || fallback;
}

function sanitizeOptionalField(value) {
  const text = String(value || '').trim();
  return text || '';
}

function sanitizeMeetingCode(value) {
  return String(value || '').trim().replace(/[^a-z0-9-]/gi, '').slice(0, 32);
}

function sanitizeFileName(fileName) {
  return String(fileName || 'meeting.webm').replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function readErrorMessage(response, fallback) {
  const text = await response.text().catch(() => '');

  if (!text) {
    return fallback;
  }

  try {
    const data = JSON.parse(text);
    return data?.error?.message || data?.message || data?.error_description || fallback;
  } catch {
    return text.slice(0, 200);
  }
}
