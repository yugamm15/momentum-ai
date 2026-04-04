import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CalendarClock,
  CheckCircle2,
  FileText,
  MessageSquare,
  Pencil,
  Search,
  Users,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useWorkspace } from '../components/workspace/useWorkspace';
import { askMeetingQuestion, updateWorkspaceTask } from '../lib/workspace-data';

const scorePill = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
};

function scoreBarClass(color) {
  if (color === 'emerald') {
    return 'bg-emerald-400';
  }

  if (color === 'amber') {
    return 'bg-amber-400';
  }

  return 'bg-rose-400';
}

export default function MeetingDetail() {
  const { meetingId } = useParams();
  const { snapshot, refresh } = useWorkspace();
  const [editingTaskId, setEditingTaskId] = useState('');
  const [draft, setDraft] = useState(null);
  const [savingTask, setSavingTask] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const [surfaceError, setSurfaceError] = useState('');
  const [transcriptQuery, setTranscriptQuery] = useState('');

  const meeting = useMemo(
    () => snapshot.meetings.find((item) => item.id === meetingId),
    [meetingId, snapshot.meetings]
  );

  const ownerSuggestions = useMemo(() => {
    const liveOwners = (snapshot.analytics.ownerLoad || [])
      .map((entry) => entry.name)
      .filter((name) => name && name !== 'Unassigned');

    return Array.from(new Set([...(meeting?.participants || []), ...liveOwners]));
  }, [meeting?.participants, snapshot.analytics.ownerLoad]);

  const filteredTranscript = useMemo(() => {
    const normalizedQuery = transcriptQuery.trim().toLowerCase();
    if (!meeting) {
      return [];
    }

    if (!normalizedQuery) {
      return meeting.transcript;
    }

    return meeting.transcript.filter((segment) =>
      `${segment.speaker} ${segment.text}`.toLowerCase().includes(normalizedQuery)
    );
  }, [meeting, transcriptQuery]);

  if (!meeting) {
    return (
      <div className="momentum-card p-8">
        <Link to="/dashboard/meetings" className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700">
          <ArrowLeft className="h-4 w-4" />
          Back to meetings
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">Meeting not found</h1>
        <p className="mt-3 text-slate-600">This record is missing from the current workspace snapshot.</p>
      </div>
    );
  }

  function beginEdit(task) {
    setEditingTaskId(task.id);
    setDraft({
      title: task.title,
      owner: task.owner,
      dueDate: task.dueDate,
      status: task.status,
    });
    setSurfaceError('');
  }

  function cancelEdit() {
    setEditingTaskId('');
    setDraft(null);
  }

  async function saveTask(taskId) {
    if (!draft) {
      return;
    }

    setSavingTask(true);
    setSurfaceError('');
    try {
      await updateWorkspaceTask(taskId, draft);
      cancelEdit();
      await refresh({ silent: true });
    } catch (error) {
      setSurfaceError(error.message || 'Momentum could not update this task.');
    } finally {
      setSavingTask(false);
    }
  }

  async function handleAsk(event) {
    event.preventDefault();
    setSurfaceError('');
    setAnswer('');
    setAsking(true);

    try {
      const response = await askMeetingQuestion(meeting, question);
      setAnswer(response);
    } catch (error) {
      setSurfaceError(error.message || 'Momentum could not answer this question.');
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="space-y-6">
      <datalist id="meeting-owner-options">
        {ownerSuggestions.map((owner) => (
          <option key={owner} value={owner} />
        ))}
      </datalist>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="momentum-card momentum-spotlight p-6">
          <Link to="/dashboard/meetings" className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700">
            <ArrowLeft className="h-4 w-4" />
            Back to meeting vault
          </Link>

          <div className="mt-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              {meeting.timeLabel}
            </div>
            <h1 className="mt-2 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
              {meeting.aiTitle}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
              {meeting.summaryParagraph}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="momentum-pill">{meeting.source}</span>
              <span className="momentum-pill">{meeting.rawTitle}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                <Users className="h-3.5 w-3.5" />
                {meeting.participants.join(', ')}
              </span>
            </div>
          </div>
        </div>

        <div className="momentum-dark-panel p-6">
          <div className="relative">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200">
              Overall score
            </div>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div className="momentum-number text-6xl font-semibold text-white">{meeting.score.overall}</div>
              <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${scorePill[meeting.score.color]}`}>
                Momentum ready
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-300">{meeting.rationale}</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Clarity', value: meeting.score.clarity, color: meeting.score.color },
                { label: 'Ownership', value: meeting.score.ownership, color: meeting.score.color },
                { label: 'Execution', value: meeting.score.execution, color: meeting.score.color },
              ].map((score) => (
                <div key={score.label} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {score.label}
                  </div>
                  <div className="momentum-number mt-2 text-3xl font-semibold text-white">
                    {score.value}
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full rounded-full ${scoreBarClass(score.color)}`} style={{ width: `${score.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {surfaceError ? (
        <div className="momentum-card-soft border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {surfaceError}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <div className="space-y-6">
          <div className="momentum-card p-6">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              <FileText className="h-4 w-4" />
              Summary
            </div>
            <div className="mt-5 space-y-3">
              {meeting.summaryBullets.map((bullet) => (
                <div key={bullet} className="momentum-card-soft px-4 py-4 text-sm leading-7 text-slate-700">
                  {bullet}
                </div>
              ))}
            </div>
          </div>

          <div className="momentum-card p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Decisions</div>
            <div className="mt-5 space-y-3">
              {meeting.decisions.map((decision) => (
                <div key={decision.id} className="momentum-card-soft px-4 py-4">
                  <div className="text-sm font-semibold text-slate-900">{decision.text}</div>
                  <div className="mt-2 text-xs text-slate-500">
                    Confidence {(decision.confidence * 100).toFixed(0)}%
                  </div>
                  <div className="mt-3 rounded-[18px] border border-slate-200 bg-white px-3 py-3 text-xs leading-6 text-slate-600">
                    {decision.sourceSnippet}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="momentum-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Tasks with evidence
                </div>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  Action items
                </h2>
              </div>
              <div className="momentum-pill">{meeting.tasks.length} items</div>
            </div>

            <div className="mt-5 space-y-4">
              {meeting.tasks.map((task) => {
                const isEditing = editingTaskId === task.id;
                return (
                  <div key={task.id} className="momentum-card-soft p-4">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="momentum-input-shell">
                          <input
                            value={draft?.title || ''}
                            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                          />
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="momentum-input-shell">
                            <input
                              value={draft?.owner || ''}
                              onChange={(event) => setDraft((current) => ({ ...current, owner: event.target.value }))}
                              placeholder="Owner"
                              list="meeting-owner-options"
                            />
                          </div>
                          <div className="momentum-input-shell">
                            <input
                              value={draft?.dueDate || ''}
                              onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))}
                              placeholder="Due date"
                            />
                          </div>
                          <div className="momentum-input-shell">
                            <select
                              value={draft?.status || 'pending'}
                              onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}
                            >
                              <option value="pending">Pending</option>
                              <option value="in-progress">In progress</option>
                              <option value="needs-review">Needs review</option>
                              <option value="done">Done</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => saveTask(task.id)} disabled={savingTask} className="momentum-button-primary">
                            {savingTask ? 'Saving...' : 'Save task'}
                          </button>
                          <button type="button" onClick={cancelEdit} className="momentum-button-secondary">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="max-w-2xl">
                            <div className="text-base font-semibold text-slate-950">{task.title}</div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                              <span className="rounded-full bg-white px-3 py-1 text-slate-700 shadow-sm">
                                Owner: {task.owner || 'Needs assignment'}
                              </span>
                              <span className="rounded-full bg-white px-3 py-1 text-slate-700 shadow-sm">
                                Due: {task.dueDate || 'Missing'}
                              </span>
                              <span className="rounded-full bg-white px-3 py-1 text-slate-700 shadow-sm">
                                Confidence {(task.confidence * 100).toFixed(0)}%
                              </span>
                              {task.needsReview ? (
                                <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                                  Needs review
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {!task.isSeeded ? (
                            <button
                              type="button"
                              onClick={() => beginEdit(task)}
                              className="inline-flex items-center gap-2 rounded-[18px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </button>
                          ) : (
                            <div className="rounded-[18px] bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-500">
                              Seeded demo record
                            </div>
                          )}
                        </div>

                        <div className="mt-4 rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-600">
                          {task.sourceSnippet}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="momentum-card p-6">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              <CheckCircle2 className="h-4 w-4" />
              Checklist
            </div>
            <div className="mt-5 space-y-3">
              {meeting.checklist.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-[22px] border px-4 py-4 text-sm ${
                    item.completed
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  {item.text}
                </div>
              ))}
            </div>
          </div>

          <div className="momentum-card p-6">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              <AlertTriangle className="h-4 w-4" />
              Risk flags
            </div>
            <div className="mt-5 space-y-3">
              {meeting.meetingRisks.map((risk) => (
                <div key={risk.id} className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-semibold text-slate-900">{risk.type}</div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm">
                      {risk.severity}
                    </div>
                  </div>
                  <div className="mt-3 text-sm leading-7 text-slate-700">{risk.message}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="momentum-card p-6">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              <Bot className="h-4 w-4" />
              Ask Meeting AI
            </div>
            <form onSubmit={handleAsk} className="mt-5 space-y-3">
              <div className="momentum-input-shell">
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  rows={4}
                  placeholder="What slipped through without an owner?"
                />
              </div>
              <button type="submit" disabled={asking || !question.trim()} className="momentum-button-primary">
                <MessageSquare className="h-4 w-4" />
                {asking ? 'Thinking...' : 'Ask Momentum'}
              </button>
            </form>
            {answer ? (
              <div className="momentum-card-soft mt-4 px-4 py-4 text-sm leading-7 text-slate-700">{answer}</div>
            ) : null}
          </div>

          <div className="momentum-card p-6">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              <CalendarClock className="h-4 w-4" />
              Processing and metadata
            </div>
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              {[
                `Source platform: ${meeting.source}`,
                `Raw meeting label: ${meeting.rawTitle}`,
                `Processing state: ${meeting.processingStatus}`,
              ].map((item) => (
                <div key={item} className="momentum-card-soft px-4 py-4">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="momentum-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Transcript explorer
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Evidence trail
            </h2>
          </div>
          <div className="momentum-input-shell w-full max-w-md">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={transcriptQuery}
              onChange={(event) => setTranscriptQuery(event.target.value)}
              placeholder="Search transcript text or speaker"
            />
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {filteredTranscript.map((segment) => (
            <div key={segment.id} className="momentum-card-soft px-4 py-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <span>{segment.time}</span>
                <span>{segment.speaker}</span>
              </div>
              <div className="mt-3 text-sm leading-7 text-slate-700">{segment.text}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
