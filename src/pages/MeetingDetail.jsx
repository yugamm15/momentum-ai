import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  AudioLines,
  Bot,
  CalendarClock,
  CheckCircle2,
  FileAudio,
  FileText,
  MessageSquare,
  Pencil,
  Search,
  Users,
  Waves,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkspace } from '../components/workspace/useWorkspace';
import {
  askMeetingQuestion,
  processStoredMeeting,
  updateWorkspaceTask,
} from '../lib/workspace-data';

function scoreBarClass(color) {
  if (color === 'emerald') return 'bg-emerald-500';
  if (color === 'amber') return 'bg-amber-500';
  return 'bg-rose-500';
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
};

export default function MeetingDetail() {
  const { meetingId } = useParams();
  const { snapshot, refresh } = useWorkspace();
  const [editingTaskId, setEditingTaskId] = useState('');
  const [draft, setDraft] = useState(null);
  const [savingTask, setSavingTask] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const [processingStored, setProcessingStored] = useState(false);
  const [surfaceError, setSurfaceError] = useState('');
  const [transcriptQuery, setTranscriptQuery] = useState('');

  const meeting = useMemo(
    () => snapshot.meetings.find((item) => item.id === meetingId),
    [meetingId, snapshot.meetings]
  );

  const ownerSuggestions = useMemo(() => {
    const livePeople = (snapshot.people || []).map((person) => person.displayName).filter(Boolean);
    const rosterPeople = (meeting?.participantRoster || []).map((person) => person.displayName);

    return Array.from(new Set([...livePeople, ...rosterPeople]));
  }, [meeting?.participantRoster, snapshot.people]);

  const filteredTranscript = useMemo(() => {
    const normalizedQuery = transcriptQuery.trim().toLowerCase();
    if (!meeting) return [];
    if (!normalizedQuery) return meeting.transcript;

    return meeting.transcript.filter((segment) =>
      `${segment.speakerLabel || segment.speaker} ${segment.text}`.toLowerCase().includes(normalizedQuery)
    );
  }, [meeting, transcriptQuery]);

  if (!meeting) {
    return (
      <div className="glass-panel p-8 max-w-3xl mx-auto mt-12 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-4">Meeting not found</h1>
        <p className="text-muted-foreground font-medium mb-6">This record is missing from the current workspace snapshot.</p>
        <Link to="/dashboard/meetings" className="button-primary inline-flex">
          <ArrowLeft className="h-4 w-4" />
          Return to Vault
        </Link>
      </div>
    );
  }

  function beginEdit(task) {
    setEditingTaskId(task.id);
    setDraft({ title: task.title, owner: task.owner, dueDate: task.dueDate, status: task.status });
    setSurfaceError('');
  }

  function cancelEdit() {
    setEditingTaskId('');
    setDraft(null);
  }

  async function saveTask(taskId) {
    if (!draft) return;
    setSavingTask(true);
    setSurfaceError('');
    try {
      await updateWorkspaceTask(taskId, draft);
      cancelEdit();
      await refresh({ silent: true });
    } catch (error) {
      setSurfaceError(error.message || 'Moméntum could not update this task.');
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
      setSurfaceError(error.message || 'Moméntum could not answer this question.');
    } finally {
      setAsking(false);
    }
  }

  async function handleStoredProcessing() {
    setProcessingStored(true);
    setSurfaceError('');
    try {
      await processStoredMeeting(meeting.id);
      await refresh({ silent: true });
    } catch (error) {
      setSurfaceError(error.message || 'Moméntum could not start analysis for this recording.');
    } finally {
      setProcessingStored(false);
    }
  }

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      className="p-6 md:p-8 xl:p-12 max-w-[1600px] mx-auto space-y-8 min-h-screen"
    >
      <datalist id="meeting-owner-options">
        {ownerSuggestions.map((owner) => (
          <option key={owner} value={owner} />
        ))}
      </datalist>

      {/* Hero Section */}
      <motion.section variants={fadeUp} className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="glass-panel p-8 md:p-10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-12 opacity-0 group-hover:opacity-[0.03] dark:group-hover:opacity-5 transition-opacity duration-1000 pointer-events-none text-foreground">
            <AudioLines className="w-64 h-64 scale-150 -rotate-12" />
          </div>
          <div className="relative z-10 flex flex-col items-start h-full justify-between">
            <div>
              <Link to="/dashboard/meetings" className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors mb-6 bg-primary/10 px-3 py-1.5 rounded-full">
                <ArrowLeft className="h-3 w-3" />
                Return to Meeting Library
              </Link>
              
              <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground bg-muted inline-block px-2 py-1 rounded mb-3">
                {meeting.timeLabel}
              </div>
              <h1 className="max-w-4xl text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground mb-4 leading-tight">
                {meeting.aiTitle}
              </h1>
              <p className="max-w-3xl text-lg leading-relaxed text-muted-foreground font-medium mb-8">
                {meeting.summaryParagraph}
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <span className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-bold text-foreground shadow-sm">{meeting.source}</span>
              <span className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-bold text-foreground shadow-sm">{meeting.rawTitle}</span>
              <span className="rounded-lg bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 text-xs font-bold shadow-sm">{meeting.participants.length || 0} People</span>
              <span className="rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-3 py-1.5 text-xs font-bold shadow-sm">{meeting.tasks.length} Tasks</span>
              <span className="rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-3 py-1.5 text-xs font-bold shadow-sm">
                {meeting.audioUrl ? 'Audio Recording Attached' : 'Text Transcript Only'}
              </span>
            </div>
          </div>
        </div>

        {/* Scoring Panel */}
        <div className="vibrant-panel p-8 md:p-10 flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/50 mb-4">
              Meeting Score
            </div>
            <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-6 mb-6">
              <div className="text-6xl sm:text-7xl font-extrabold text-white tracking-tighter leading-none">{meeting.score.overall}</div>
              <div className={`rounded-xl border px-4 py-1.5 text-xs font-bold uppercase tracking-widest bg-white/10 border-white/20 text-white backdrop-blur-sm shadow-sm`}>
                {meeting.processingStatus === 'ready' ? 'Decoded' : meeting.processingStatus}
              </div>
            </div>
            <p className="text-sm leading-relaxed text-white/80 font-medium">{meeting.rationale}</p>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-8">
            {[
              { label: 'Clarity', value: meeting.score.clarity, color: meeting.score.color },
              { label: 'Ownership', value: meeting.score.ownership, color: meeting.score.color },
              { label: 'Execution', value: meeting.score.execution, color: meeting.score.color },
            ].map((score) => (
              <div key={score.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm backdrop-blur-sm">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50 mb-1">
                  {score.label}
                </div>
                <div className="text-2xl font-extrabold text-white mb-3">
                  {score.value}
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full rounded-full ${scoreBarClass(score.color)}`} style={{ width: `${score.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      <AnimatePresence>
        {surfaceError && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold shadow-sm">
            {surfaceError}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.section variants={fadeUp} className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        
        {/* Playback & Roster Side */}
        <div className="space-y-6">
          <div className="glass-panel p-8">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground mb-4">
              <FileAudio className="h-4 w-4 text-primary" />
              Audio Recording
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-6">
              Hear the source audio.
            </h2>

            <div className="space-y-4">
              {meeting.processingStatus === 'pending-analysis' && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                  <div className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-2">Signal captured. Neural analysis pending.</div>
                  <p className="text-sm leading-relaxed text-muted-foreground font-medium mb-4">
                    Initiate extraction sequence to align this raw data into executable tasks and searchable transcripts.
                  </p>
                  <button onClick={handleStoredProcessing} disabled={processingStored} className="button-secondary">
                    {processingStored ? 'Analyzing Meeting...' : 'Initiate Extraction'}
                  </button>
                </div>
              )}

              {meeting.audioUrl ? (
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <audio controls preload="metadata" className="w-full h-10 shadow-sm rounded-lg opacity-80 hover:opacity-100 transition-opacity">
                    <source src={meeting.audioUrl} />
                  </audio>
                  <div className="mt-4 text-xs font-medium text-muted-foreground italic">
                    Listen to the immutable recording alongside extracted insights.
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-secondary/50 p-6 text-sm text-muted-foreground font-medium text-center">
                  No audio recording is attached to this meeting.
                </div>
              )}
            </div>
          </div>

          <div className="glass-panel p-8">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground mb-4">
              <Users className="h-4 w-4 text-blue-500" />
              People in the room
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-6">
              Participant Roster
            </h2>

            <div className="space-y-3">
              {(meeting.participantRoster || []).map((participant) => (
                <div key={participant.id} className="rounded-2xl bg-secondary/50 p-4 border border-border flex items-center justify-between gap-4 hover:bg-card transition-colors">
                  <div>
                    <div className="text-sm font-bold text-foreground">{participant.displayName}</div>
                    <div className="mt-1 text-xs text-muted-foreground font-medium uppercase tracking-widest">
                      {participant.profileId ? participant.email || 'Native Match' : 'External'}
                    </div>
                  </div>
                  <div
                    className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${
                      participant.profileId
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : participant.matchStatus === 'ambiguous'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : 'bg-background text-muted-foreground border border-border shadow-sm'
                    }`}
                  >
                    {participant.profileId ? 'Verified' : participant.matchStatus === 'ambiguous' ? 'Review' : 'Guest'}
                  </div>
                </div>
              ))}

              {(meeting.participantRoster || []).length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-secondary/50 p-6 text-sm text-muted-foreground font-medium text-center">
                  No active signatures logged.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tasks & Action Column */}
        <div className="space-y-6">
          <div className="glass-panel p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground mb-1">
                  Tasks with Evidence
                </div>
                <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
                  Action Items
                </h2>
              </div>
              <div className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-lg text-xs font-bold shadow-sm">
                {meeting.tasks.length}
              </div>
            </div>

            <div className="space-y-4">
              {meeting.tasks.map((task) => {
                const isEditing = editingTaskId === task.id;
                return (
                  <div key={task.id} className="rounded-2xl border border-border bg-secondary/50 p-5 hover:bg-card transition-colors">
                    {isEditing ? (
                      <div className="space-y-4">
                        <input
                          value={draft?.title || ''}
                          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                          className="w-full bg-background border border-border rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-primary/50 text-foreground"
                          placeholder="Task Title"
                        />
                        <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
                          <input
                            value={draft?.owner || ''}
                            onChange={(event) => setDraft((current) => ({ ...current, owner: event.target.value }))}
                            placeholder="Owner"
                            list="meeting-owner-options"
                            className="bg-background border border-border rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-primary/50 text-foreground"
                          />
                          <input
                            value={draft?.dueDate || ''}
                            onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))}
                            placeholder="Due date"
                            className="bg-background border border-border rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-primary/50 text-foreground"
                          />
                          <select
                            value={draft?.status || 'pending'}
                            onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}
                            className="bg-background border border-border rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-primary/50 text-foreground appearance-none"
                          >
                            <option value="pending">Pending</option>
                            <option value="in-progress">In progress</option>
                            <option value="needs-review">Needs review</option>
                            <option value="done">Done</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => saveTask(task.id)} disabled={savingTask} className="button-primary px-4 py-2 text-xs">
                            {savingTask ? 'Saving...' : 'Commit Change'}
                          </button>
                          <button onClick={cancelEdit} className="button-secondary px-4 py-2 text-xs">
                            Abort
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-4">
                          <div className="min-w-0 pr-4">
                            <div className="text-base font-extrabold text-foreground leading-snug">{task.title}</div>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                              <span className="rounded-lg bg-background px-2.5 py-1 text-foreground shadow-sm border border-border">
                                👤 {task.owner || 'Unassigned'}
                              </span>
                              <span className="rounded-lg bg-background px-2.5 py-1 text-foreground shadow-sm border border-border">
                                ⏳ {task.dueDate || 'Open'}
                              </span>
                              {task.needsReview && (
                                <span className="rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-1 shadow-sm border border-amber-500/20">
                                  Validate
                                </span>
                              )}
                            </div>
                          </div>
                          <button onClick={() => beginEdit(task)} className="shrink-0 rounded-xl bg-background border border-border p-2 text-muted-foreground hover:text-foreground shadow-sm hover:scale-105 transition-all">
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="rounded-xl border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground font-medium italic">
                          "{task.sourceSnippet}"
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {meeting.tasks.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-secondary/50 p-8 text-center text-sm font-medium text-muted-foreground">
                  No execution vectors identified.
                </div>
              )}
            </div>
          </div>
          
          <div className="glass-panel p-8">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground mb-4">
              <Bot className="h-4 w-4 text-blue-500" />
              Ask Moméntum AI
            </div>
            <form onSubmit={handleAsk} className="mt-2 space-y-3">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={3}
                placeholder="Ask about the meeting..."
                className="w-full bg-card border border-border rounded-xl p-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm font-medium resize-none"
              />
              <button type="submit" disabled={asking || !question.trim()} className="button-primary w-full text-sm">
                {asking ? 'Processing Query...' : 'Ask Moméntum'}
              </button>
            </form>
            <AnimatePresence>
              {answer && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/20 text-sm font-medium leading-relaxed text-foreground shadow-inner">
                  {answer}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.section>

      {/* Transcript Log Below */}
      <motion.section variants={fadeUp} className="glass-panel p-8 md:p-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8 border-b border-border pb-6">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground mb-2">
              Lexical Search
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
              Transcript Evidence
            </h2>
          </div>
          <div className="relative w-full max-w-sm group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              value={transcriptQuery}
              onChange={(event) => setTranscriptQuery(event.target.value)}
              placeholder="Search statements..."
              className="w-full bg-card border border-border rounded-full py-3 pl-12 pr-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm font-medium"
            />
          </div>
        </div>

        {(meeting.processingSummary || meeting.transcriptNotice) && (
          <div className="mb-6 space-y-3">
            {meeting.processingSummary && meeting.processingStatus !== 'ready' && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm font-medium text-muted-foreground">
                {meeting.processingSummary}
              </div>
            )}
            {meeting.transcriptNotice && (
              <div className="rounded-2xl border border-border bg-secondary/50 p-4 text-sm font-medium text-muted-foreground">
                {meeting.transcriptNotice}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          {filteredTranscript.map((segment) => (
            <div key={segment.id} className="rounded-2xl hover:bg-secondary/50 p-4 transition-colors flex gap-6 group">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground pt-1 w-16 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                {segment.time}
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">
                  {segment.speaker || 'Transcript'}
                </div>
                <div className="text-sm font-medium leading-loose text-foreground max-w-4xl">
                  {segment.text}
                </div>
              </div>
            </div>
          ))}

          {filteredTranscript.length === 0 && (
            <div className="py-16 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
              <div className="text-muted-foreground font-medium text-sm">
                {meeting.transcriptText
                  ? 'Nothing matches this search.'
                  : meeting.processingStatus === 'pending-analysis'
                    ? 'Transcript is not available yet. Start extraction first.'
                    : 'No transcript is available for this meeting yet.'}
              </div>
            </div>
          )}
        </div>
      </motion.section>
    </motion.div>
  );
}
