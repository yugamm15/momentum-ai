import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  AudioLines,
  Bot,
  Clock3,
  CalendarClock,
  CheckCircle2,
  FileAudio,
  FileText,
  MessageSquare,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  User,
  Users,
  Waves,
  X,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkspace } from '../components/workspace/useWorkspace';
import WaveformScrub from '../components/meetings/WaveformScrub';
import AiInput003 from '../components/ai/AiInput003';
import {
  askMeetingQuestion,
  createWorkspaceTask,
  deleteWorkspaceMeeting,
  processStoredMeeting,
  updateWorkspaceMeeting,
  updateWorkspaceParticipant,
  updateWorkspaceTask,
} from '../lib/workspace-data';
import { getRiskPlaybook } from '../lib/risk-playbooks';

function scoreBarClass(color) {
  if (color === 'emerald') return 'bg-emerald-500';
  if (color === 'amber') return 'bg-amber-500';
  return 'bg-rose-500';
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
};
const LONG_PRESS_MS = 450;

export default function MeetingDetail() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { snapshot, refresh } = useWorkspace();
  const [editingTaskId, setEditingTaskId] = useState('');
  const [draft, setDraft] = useState(null);
  const [savingTask, setSavingTask] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [newTaskDraft, setNewTaskDraft] = useState({
    title: '',
    owner: '',
    dueDate: '',
    status: 'pending',
  });
  const [editingMeetingTitle, setEditingMeetingTitle] = useState(false);
  const [meetingTitleDraft, setMeetingTitleDraft] = useState('');
  const [savingMeetingTitle, setSavingMeetingTitle] = useState(false);
  const [deletingMeeting, setDeletingMeeting] = useState(false);
  const [showMeetingActions, setShowMeetingActions] = useState(false);
  const [participantModal, setParticipantModal] = useState({
    open: false,
    participantId: '',
    currentName: '',
    displayName: '',
  });
  const [savingParticipant, setSavingParticipant] = useState(false);
  const [removingParticipant, setRemovingParticipant] = useState(false);
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const [processingStored, setProcessingStored] = useState(false);
  const [surfaceError, setSurfaceError] = useState('');
  const [transcriptQuery, setTranscriptQuery] = useState('');
  const [selectedRiskDetail, setSelectedRiskDetail] = useState(null);
  const meetingCardPressTimerRef = useRef(null);
  const meetingActionMenuRef = useRef(null);
  const audioSectionRef = useRef(null);
  const tasksSectionRef = useRef(null);
  const transcriptSectionRef = useRef(null);

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

  const fullTranscriptText = useMemo(() => {
    const directText = String(meeting?.transcriptText || '').trim();
    if (directText) {
      return directText;
    }

    return (meeting?.transcript || [])
      .map((segment) => String(segment.text || '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
  }, [meeting]);

  useEffect(() => {
    setMeetingTitleDraft(String(meeting?.aiTitle || '').trim());
    setEditingMeetingTitle(false);
    setShowMeetingActions(false);
    setSelectedRiskDetail(null);
    setParticipantModal({
      open: false,
      participantId: '',
      currentName: '',
      displayName: '',
    });
  }, [meeting?.aiTitle, meeting?.id]);

  useEffect(() => {
    return () => {
      if (meetingCardPressTimerRef.current !== null) {
        window.clearTimeout(meetingCardPressTimerRef.current);
        meetingCardPressTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!showMeetingActions) {
      return undefined;
    }

    function handleDocumentPointerDown(event) {
      const menuNode = meetingActionMenuRef.current;
      if (!menuNode) {
        setShowMeetingActions(false);
        return;
      }

      if (event.target instanceof Node && menuNode.contains(event.target)) {
        return;
      }

      setShowMeetingActions(false);
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown);
    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown);
    };
  }, [showMeetingActions]);

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

  async function handleAskMessage(text, mention) {
    setSurfaceError('');
    setAnswer('');
    setAsking(true);
    try {
      const enrichedQuestion = mention ? `${text}\n\nContext hint: prioritize ${mention}.` : text;
      const response = await askMeetingQuestion(meeting, enrichedQuestion);
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

  async function handleSaveMeetingTitle() {
    const normalizedTitle = String(meetingTitleDraft || '').trim();
    if (!normalizedTitle) {
      setSurfaceError('Meeting title cannot be empty.');
      return;
    }

    setSavingMeetingTitle(true);
    setSurfaceError('');
    try {
      await updateWorkspaceMeeting(meeting.id, normalizedTitle);
      setEditingMeetingTitle(false);
      await refresh({ silent: true });
    } catch (error) {
      setSurfaceError(error.message || 'Momentum could not update this meeting title.');
    } finally {
      setSavingMeetingTitle(false);
    }
  }

  async function handleDeleteMeeting() {
    const confirmed = window.confirm('Delete this meeting and all related tasks? This action cannot be undone.');
    if (!confirmed) {
      return;
    }

    setDeletingMeeting(true);
    setSurfaceError('');
    try {
      await deleteWorkspaceMeeting(meeting.id);
      await refresh({ silent: true });
      navigate('/dashboard/meetings');
    } catch (error) {
      setSurfaceError(error.message || 'Momentum could not delete this meeting.');
    } finally {
      setDeletingMeeting(false);
    }
  }

  function openParticipantModal(participant) {
    setParticipantModal({
      open: true,
      participantId: String(participant?.id || '').trim(),
      currentName: String(participant?.displayName || '').trim(),
      displayName: String(participant?.displayName || '').trim(),
    });
    setSurfaceError('');
  }

  function closeParticipantModal() {
    if (savingParticipant || removingParticipant) {
      return;
    }

    setParticipantModal({
      open: false,
      participantId: '',
      currentName: '',
      displayName: '',
    });
  }

  async function handleSaveParticipant() {
    const normalizedName = String(participantModal.displayName || '').trim();
    if (!normalizedName) {
      setSurfaceError('Participant name cannot be empty.');
      return;
    }

    setSavingParticipant(true);
    setSurfaceError('');
    try {
      await updateWorkspaceParticipant({
        meetingId: meeting.id,
        participantId: participantModal.participantId,
        currentName: participantModal.currentName,
        displayName: normalizedName,
        removeParticipant: false,
      });
      closeParticipantModal();
      await refresh({ silent: true });
    } catch (error) {
      setSurfaceError(error.message || 'Momentum could not rename this participant.');
    } finally {
      setSavingParticipant(false);
    }
  }

  async function handleRemoveParticipant() {
    const confirmed = window.confirm(`Remove ${participantModal.currentName || 'this participant'} from the roster?`);
    if (!confirmed) {
      return;
    }

    setRemovingParticipant(true);
    setSurfaceError('');
    try {
      await updateWorkspaceParticipant({
        meetingId: meeting.id,
        participantId: participantModal.participantId,
        currentName: participantModal.currentName,
        displayName: participantModal.displayName,
        removeParticipant: true,
      });
      closeParticipantModal();
      await refresh({ silent: true });
    } catch (error) {
      setSurfaceError(error.message || 'Momentum could not remove this participant.');
    } finally {
      setRemovingParticipant(false);
    }
  }

  async function handleCreateTask(event) {
    event.preventDefault();
    const title = String(newTaskDraft.title || '').trim();
    if (!title) {
      setSurfaceError('Task title is required.');
      return;
    }

    setCreatingTask(true);
    setSurfaceError('');
    try {
      await createWorkspaceTask({
        meetingId: meeting.id,
        title,
        owner: String(newTaskDraft.owner || '').trim(),
        dueDate: String(newTaskDraft.dueDate || '').trim(),
        status: String(newTaskDraft.status || 'pending').trim() || 'pending',
      });
      setShowCreateTask(false);
      setNewTaskDraft({
        title: '',
        owner: '',
        dueDate: '',
        status: 'pending',
      });
      await refresh({ silent: true });
    } catch (error) {
      setSurfaceError(error.message || 'Momentum could not create this task.');
    } finally {
      setCreatingTask(false);
    }
  }

  function clearMeetingCardPressTimer() {
    if (meetingCardPressTimerRef.current !== null) {
      window.clearTimeout(meetingCardPressTimerRef.current);
      meetingCardPressTimerRef.current = null;
    }
  }

  function handleMeetingCardPressStart(event) {
    if (editingMeetingTitle || showMeetingActions) {
      return;
    }

    if (meetingCardPressTimerRef.current !== null) {
      return;
    }

    const nativeEvent = event?.nativeEvent || event;
    const eventType = String(event?.type || '').toLowerCase();
    const pointerType =
      nativeEvent?.pointerType ||
      (eventType.startsWith('touch') ? 'touch' : 'mouse');
    const button = Number.isFinite(nativeEvent?.button) ? nativeEvent.button : 0;

    if (pointerType === 'mouse' && button !== 0) {
      return;
    }

    const eventTarget = nativeEvent?.target || event?.target;
    if (eventTarget instanceof Element && eventTarget.closest('a,button,input,select,textarea')) {
      return;
    }

    meetingCardPressTimerRef.current = window.setTimeout(() => {
      setShowMeetingActions(true);
      clearMeetingCardPressTimer();
    }, LONG_PRESS_MS);
  }

  function handleMeetingCardPressEnd() {
    clearMeetingCardPressTimer();
  }

  function handleMeetingCardContextMenu(event) {
    const eventTarget = event?.target;
    if (eventTarget instanceof Element && eventTarget.closest('a,button,input,select,textarea')) {
      return;
    }

    event.preventDefault();
    setShowMeetingActions(true);
    clearMeetingCardPressTimer();
  }

  function handleRiskTarget(target) {
    const refMap = {
      audio: audioSectionRef,
      tasks: tasksSectionRef,
      transcript: transcriptSectionRef,
    };

    const targetRef = refMap[target];
    if (targetRef?.current) {
      targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function openRiskDetail(risk) {
    setSelectedRiskDetail({
      risk,
      playbook: getRiskPlaybook({ risk, meeting }),
    });
  }

  function closeRiskDetail() {
    setSelectedRiskDetail(null);
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
        <div
          className="glass-panel p-8 md:p-10 relative overflow-hidden group"
          onPointerDown={handleMeetingCardPressStart}
          onPointerUp={handleMeetingCardPressEnd}
          onPointerCancel={handleMeetingCardPressEnd}
          onMouseDown={handleMeetingCardPressStart}
          onMouseUp={handleMeetingCardPressEnd}
          onMouseLeave={handleMeetingCardPressEnd}
          onTouchStart={handleMeetingCardPressStart}
          onTouchEnd={handleMeetingCardPressEnd}
          onTouchCancel={handleMeetingCardPressEnd}
          onContextMenu={handleMeetingCardContextMenu}
        >
          <div className="absolute top-0 right-0 p-12 opacity-0 group-hover:opacity-[0.03] dark:group-hover:opacity-5 transition-opacity duration-1000 pointer-events-none text-foreground">
            <AudioLines className="w-64 h-64 scale-150 -rotate-12" />
          </div>
          <AnimatePresence>
            {showMeetingActions && (
              <motion.div
                ref={meetingActionMenuRef}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                className="absolute bottom-5 right-5 z-20 w-[min(18rem,90%)] rounded-2xl border border-border bg-card p-3 shadow-2xl"
              >
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMeetingActions(false);
                      setEditingMeetingTitle(true);
                      setMeetingTitleDraft(String(meeting.aiTitle || '').trim());
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Rename Meeting
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMeetingActions(false);
                      handleDeleteMeeting();
                    }}
                    disabled={deletingMeeting}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/15 disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deletingMeeting ? 'Deleting...' : 'Delete Meeting'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="relative z-10 flex flex-col items-start h-full justify-between">
            <div>
              <Link to="/dashboard/meetings" className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors mb-6 bg-primary/10 px-3 py-1.5 rounded-full">
                <ArrowLeft className="h-3 w-3" />
                Return to Meeting Library
              </Link>
              
              <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground bg-muted inline-block px-2 py-1 rounded mb-3">
                {meeting.timeLabel}
              </div>
              {editingMeetingTitle ? (
                <div className="mb-4 space-y-3 max-w-4xl">
                  <input
                    value={meetingTitleDraft}
                    onChange={(event) => setMeetingTitleDraft(event.target.value)}
                    placeholder="Meeting title"
                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-2xl sm:text-3xl font-bold tracking-tight text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleSaveMeetingTitle}
                      disabled={savingMeetingTitle}
                      className="button-primary text-xs"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {savingMeetingTitle ? 'Saving...' : 'Save Title'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingMeetingTitle(false);
                        setMeetingTitleDraft(String(meeting.aiTitle || '').trim());
                      }}
                      className="button-secondary text-xs"
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <h1 className="max-w-4xl text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground mb-4 leading-tight">
                  {meeting.aiTitle}
                </h1>
              )}
              <p className="max-w-3xl text-lg leading-relaxed text-muted-foreground font-medium mb-8">
                {meeting.summaryParagraph}
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2 items-center">
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
          <div ref={audioSectionRef} className="glass-panel p-8">
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
                <div className="space-y-3">
                  <WaveformScrub
                    audioUrl={meeting.audioUrl}
                    fileName={`${meeting.aiTitle || meeting.rawTitle || 'Meeting audio'}.mp3`}
                  />
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

          <div ref={tasksSectionRef} className="glass-panel p-8">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground mb-4">
              <Users className="h-4 w-4 text-blue-500" />
              People in the room
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-6">
              Participant Roster
            </h2>

            <div className="space-y-3">
              {(meeting.participantRoster || []).map((participant) => (
                <button
                  key={participant.id}
                  type="button"
                  onClick={() => openParticipantModal(participant)}
                  className="w-full text-left rounded-2xl bg-secondary/50 p-4 border border-border flex items-center justify-between gap-4 hover:bg-card transition-colors"
                >
                  <div>
                    <div className="text-sm font-bold text-foreground">{participant.displayName}</div>
                    <div className="mt-1 text-xs text-muted-foreground font-medium uppercase tracking-widest">
                      {participant.profileId ? participant.email || 'Native Match' : 'External'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateTask((current) => !current);
                    setNewTaskDraft((current) => ({
                      ...current,
                      owner: current.owner || ownerSuggestions[0] || '',
                    }));
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/15"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Action Item
                </button>
                <div className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-lg text-xs font-bold shadow-sm">
                  {meeting.tasks.length}
                </div>
              </div>
            </div>

            <AnimatePresence>
              {showCreateTask && (
                <motion.form
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  onSubmit={handleCreateTask}
                  className="overflow-hidden mb-4 rounded-2xl border border-border bg-card p-4"
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      value={newTaskDraft.title}
                      onChange={(event) => setNewTaskDraft((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Activity title"
                      className="bg-background border border-border rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-primary/50 text-foreground"
                    />
                    <select
                      value={newTaskDraft.owner}
                      onChange={(event) => setNewTaskDraft((current) => ({ ...current, owner: event.target.value }))}
                      className="bg-background border border-border rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-primary/50 text-foreground"
                    >
                      <option value="">Unassigned</option>
                      {ownerSuggestions.map((owner) => (
                        <option key={owner} value={owner}>{owner}</option>
                      ))}
                    </select>
                    <input
                      value={newTaskDraft.dueDate}
                      onChange={(event) => setNewTaskDraft((current) => ({ ...current, dueDate: event.target.value }))}
                      placeholder="Due date"
                      className="bg-background border border-border rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-primary/50 text-foreground"
                    />
                    <select
                      value={newTaskDraft.status}
                      onChange={(event) => setNewTaskDraft((current) => ({ ...current, status: event.target.value }))}
                      className="bg-background border border-border rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-primary/50 text-foreground"
                    >
                      <option value="pending">Pending</option>
                      <option value="in-progress">In progress</option>
                      <option value="needs-review">Needs review</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={creatingTask || !String(newTaskDraft.title || '').trim()}
                      className="button-primary text-xs"
                    >
                      {creatingTask ? 'Adding...' : 'Add Task'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateTask(false);
                        setNewTaskDraft({
                          title: '',
                          owner: '',
                          dueDate: '',
                          status: 'pending',
                        });
                      }}
                      className="button-secondary text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

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
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-background px-2.5 py-1 text-foreground shadow-sm border border-border">
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                {task.owner || 'Unassigned'}
                              </span>
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-background px-2.5 py-1 text-foreground shadow-sm border border-border">
                                <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                                {task.dueDate || 'Open'}
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
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Risk Signals
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-6">
              Meeting Risks
            </h2>

            <div className="space-y-3">
              {(meeting.meetingRisks || []).map((risk, index) => {
                return (
                  <button
                    key={risk.id || `${risk.type}-${index}`}
                    type="button"
                    onClick={() => openRiskDetail(risk)}
                    className="w-full rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-left transition hover:bg-amber-500/15"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="text-sm font-extrabold text-amber-700 dark:text-amber-400">
                        {risk.type}
                      </div>
                      <div className="rounded-lg border border-amber-500/25 bg-background px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
                        {risk.severity || 'Medium'}
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground font-medium">
                      {risk.message}
                    </p>
                  </button>
                );
              })}

              {(meeting.meetingRisks || []).length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-secondary/50 p-6 text-sm text-muted-foreground text-center font-medium">
                  No risks were detected for this meeting.
                </div>
              )}
            </div>
          </div>
          
          <div className="glass-panel p-8">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground mb-4">
              <Bot className="h-4 w-4 text-blue-500" />
              Ask Moméntum AI
            </div>
            <AiInput003 onSendMessage={handleAskMessage} loading={asking} placeholder="Ask about the meeting..." />
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
      <motion.section ref={transcriptSectionRef} variants={fadeUp} className="glass-panel p-8 md:p-10">
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

        <div className="mb-6 rounded-2xl border border-border bg-secondary/40 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground mb-3">
            <FileText className="h-4 w-4 text-primary" />
            Full Transcript Text
          </div>
          {fullTranscriptText ? (
            <div className="max-h-[28rem] overflow-y-auto rounded-xl border border-border bg-card p-4 text-sm leading-7 text-foreground whitespace-pre-wrap break-words">
              {fullTranscriptText}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-background/60 p-4 text-sm font-medium text-muted-foreground">
              No transcript text has been captured for this meeting yet.
            </div>
          )}
        </div>

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

      <AnimatePresence>
        {selectedRiskDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-4"
            onClick={closeRiskDetail}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="w-full max-w-2xl rounded-3xl border border-amber-500/20 bg-card p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-1">
                    Risk resolution
                  </div>
                  <h3 className="text-xl font-extrabold tracking-tight text-amber-700 dark:text-amber-400 leading-tight">
                    {selectedRiskDetail.risk.type}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    {selectedRiskDetail.risk.message}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="rounded-lg border border-amber-500/25 bg-background px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
                    {selectedRiskDetail.risk.severity || 'Medium'}
                  </div>
                  <button
                    type="button"
                    onClick={closeRiskDetail}
                    className="rounded-lg border border-border bg-background p-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-700 dark:text-amber-400">
                  {selectedRiskDetail.playbook.heading}
                </div>
                <div className="mt-4 space-y-3">
                  {selectedRiskDetail.playbook.steps.map((step, stepIndex) => (
                    <div key={`${selectedRiskDetail.risk.id || selectedRiskDetail.risk.type}-step-${stepIndex}`} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-[11px] font-extrabold text-amber-700 dark:text-amber-400">
                        {stepIndex + 1}
                      </div>
                      <p className="text-sm leading-6 text-foreground">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {selectedRiskDetail.playbook.actions.map((action) =>
                  action.to ? (
                    <Link
                      key={`${selectedRiskDetail.risk.id || selectedRiskDetail.risk.type}-${action.label}`}
                      to={action.to}
                      onClick={closeRiskDetail}
                      className="button-secondary text-xs"
                    >
                      {action.label}
                    </Link>
                  ) : (
                    <button
                      key={`${selectedRiskDetail.risk.id || selectedRiskDetail.risk.type}-${action.label}`}
                      type="button"
                      onClick={() => {
                        closeRiskDetail();
                        handleRiskTarget(action.target);
                      }}
                      className="button-secondary text-xs"
                    >
                      {action.label}
                    </button>
                  )
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
        {participantModal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-4"
            onClick={closeParticipantModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground mb-1">
                    Participant Controls
                  </div>
                  <h3 className="text-xl font-extrabold tracking-tight text-foreground">Edit Participant</h3>
                </div>
                <button
                  type="button"
                  onClick={closeParticipantModal}
                  className="rounded-lg border border-border bg-background p-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Display Name
              </label>
              <input
                value={participantModal.displayName}
                onChange={(event) => setParticipantModal((current) => ({ ...current, displayName: event.target.value }))}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Participant name"
              />

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveParticipant}
                  disabled={savingParticipant || removingParticipant}
                  className="button-primary text-xs"
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingParticipant ? 'Saving...' : 'Save Name'}
                </button>
                <button
                  type="button"
                  onClick={handleRemoveParticipant}
                  disabled={savingParticipant || removingParticipant}
                  className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/15 disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {removingParticipant ? 'Removing...' : 'Remove Participant'}
                </button>
                <button
                  type="button"
                  onClick={closeParticipantModal}
                  disabled={savingParticipant || removingParticipant}
                  className="button-secondary text-xs"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
