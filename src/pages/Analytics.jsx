import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, BarChart3, Gauge, Users, FileText, Pencil, Trash2, X, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../components/workspace/useWorkspace';
import { AnimatePresence, motion } from 'framer-motion';
import { updateWorkspaceParticipant } from '../lib/workspace-data';
import { getRiskPlaybook } from '../lib/risk-playbooks';

function barColor(score) {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-slate-500';
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

function meetingHasTranscriptText(meeting) {
  if (String(meeting?.transcriptText || '').trim()) {
    return true;
  }

  return Array.isArray(meeting?.transcript)
    && meeting.transcript.some((segment) => String(segment?.text || '').trim());
}

export default function Analytics() {
  const { snapshot, refresh } = useWorkspace();
  const { analytics, meetings, people } = snapshot;
  const transcriptReadyMeetings = meetings.filter(meetingHasTranscriptText).length;
  const peopleSectionRef = useRef(null);
  const trustSectionRef = useRef(null);
  const [personModal, setPersonModal] = useState({
    open: false,
    personId: '',
    displayName: '',
    draftName: '',
    isWorkspaceMember: false,
  });
  const [savingPerson, setSavingPerson] = useState(false);
  const [deletingPerson, setDeletingPerson] = useState(false);
  const [surfaceError, setSurfaceError] = useState('');
  const [selectedRisk, setSelectedRisk] = useState(null);

  const selectedPerson = useMemo(
    () => (people || []).find((person) => person.id === personModal.personId) || null,
    [people, personModal.personId]
  );

  const summaryCards = [
    {
      label: 'Execution Debt',
      value: analytics.meetingDebt,
      meta: 'Open ambiguity signals',
      icon: Gauge,
      tone: 'text-violet-600',
      chip: 'bg-violet-500/10 border-violet-500/20',
      to: buildDashboardPath('/dashboard/tasks', { filter: 'Needs review', status: 'needs-review' }),
    },
    {
      label: 'Unassigned Tasks',
      value: analytics.unassignedTasks,
      meta: 'Ownership gaps',
      icon: Users,
      tone: 'text-amber-600',
      chip: 'bg-amber-500/10 border-amber-500/20',
      to: buildDashboardPath('/dashboard/tasks', { filter: 'Unassigned' }),
    },
    {
      label: 'People Tracked',
      value: analytics.peopleTracked || people.length,
      meta: 'Workspace + meeting participants',
      icon: BarChart3,
      tone: 'text-violet-600',
      chip: 'bg-violet-500/10 border-violet-500/20',
      onClick: () => peopleSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    },
    {
      label: 'Transcript Ready',
      value: transcriptReadyMeetings,
      meta: 'Meetings with full text',
      icon: FileText,
      tone: 'text-emerald-600',
      chip: 'bg-emerald-500/10 border-emerald-500/20',
      to: buildDashboardPath('/dashboard/meetings', { filter: 'Transcript Ready' }),
    },
  ];

  function normalizePersonKey(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s'.-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function buildMeetingRefsForPerson(personName) {
    const targetKey = normalizePersonKey(personName);
    if (!targetKey) {
      return [];
    }

    const refs = [];

    (meetings || []).forEach((meeting) => {
      const rosterMatch = (meeting?.participantRoster || []).find(
        (participant) => normalizePersonKey(participant?.displayName) === targetKey
      );

      const participantMatch = (meeting?.participants || []).some(
        (name) => normalizePersonKey(name) === targetKey
      );

      const taskOwnerMatch = (meeting?.tasks || []).some(
        (task) => normalizePersonKey(task?.owner) === targetKey
      );

      if (!rosterMatch && !participantMatch && !taskOwnerMatch) {
        return;
      }

      refs.push({
        meetingId: meeting.id,
        participantId: rosterMatch?.id || '',
      });
    });

    return refs;
  }

  function openPersonModal(person) {
    setSurfaceError('');
    setPersonModal({
      open: true,
      personId: person.id,
      displayName: String(person.displayName || '').trim(),
      draftName: String(person.displayName || '').trim(),
      isWorkspaceMember: Boolean(person.isWorkspaceMember),
    });
  }

  function closePersonModal() {
    if (savingPerson || deletingPerson) {
      return;
    }

    setPersonModal({
      open: false,
      personId: '',
      displayName: '',
      draftName: '',
      isWorkspaceMember: false,
    });
  }

  function openRiskModal(risk) {
    setSelectedRisk(risk);
  }

  function closeRiskModal() {
    setSelectedRisk(null);
  }

  async function applyPersonMutation({ removePerson }) {
    const currentName = String(personModal.displayName || '').trim();
    const nextName = String(personModal.draftName || '').trim();

    if (!currentName) {
      setSurfaceError('Person name is required.');
      return;
    }

    if (!removePerson && !nextName) {
      setSurfaceError('New person name cannot be empty.');
      return;
    }

    const refs = buildMeetingRefsForPerson(currentName);
    if (refs.length === 0) {
      setSurfaceError('No meeting references were found for this person.');
      return;
    }

    if (removePerson) {
      setDeletingPerson(true);
    } else {
      setSavingPerson(true);
    }
    setSurfaceError('');

    try {
      const results = await Promise.allSettled(
        refs.map((ref) =>
          updateWorkspaceParticipant({
            meetingId: ref.meetingId,
            participantId: ref.participantId,
            currentName,
            displayName: nextName,
            removeParticipant: removePerson,
          })
        )
      );

      const failure = results.find((result) => result.status === 'rejected');
      if (failure) {
        throw failure.reason || new Error('Momentum could not update this person everywhere.');
      }

      closePersonModal();
      await refresh({ silent: true });
    } catch (error) {
      setSurfaceError(error.message || 'Momentum could not update this person.');
    } finally {
      if (removePerson) {
        setDeletingPerson(false);
      } else {
        setSavingPerson(false);
      }
    }
  }

  async function handleRenamePerson() {
    await applyPersonMutation({ removePerson: false });
  }

  async function handleDeletePerson() {
    const confirmed = window.confirm(
      `Remove ${personModal.displayName || 'this person'} from all meeting rosters and task ownership?`
    );
    if (!confirmed) {
      return;
    }

    await applyPersonMutation({ removePerson: true });
  }

  const selectedRiskPlaybook = selectedRisk
    ? getRiskPlaybook({
        risk: {
          type: selectedRisk.label,
          label: selectedRisk.label,
          message: `${selectedRisk.value} meeting${selectedRisk.value === 1 ? '' : 's'} currently surface this pattern.`,
        },
      })
    : null;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      className="p-6 md:p-8 xl:p-12 max-w-[1600px] mx-auto space-y-8 min-h-screen"
    >
      <AnimatePresence>
        {surfaceError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold shadow-sm"
          >
            {surfaceError}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.section variants={fadeUp} className="vibrant-panel p-8 md:p-10 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
          <BarChart3 className="w-64 h-64 scale-150 rotate-12 text-white" />
        </div>
        <div className="relative z-10 text-white">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-white/20 border border-white/30 text-[10px] uppercase font-bold tracking-widest backdrop-blur-md shadow-sm">
            <BarChart3 className="w-3 h-3" />
            Telemetry
          </div>
          <h1 className="mt-2 text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
            Flow state & accountability
          </h1>
          <p className="mt-2 max-w-3xl text-lg font-medium text-white/80 leading-relaxed">
            This surface is only useful if every metric can take you to the work behind it. The click path should stay
            as grounded as the analysis itself.
          </p>
        </div>
      </motion.section>

      <motion.section variants={fadeUp} className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          const content = (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className={`text-[10px] font-bold uppercase tracking-widest text-foreground/65 ${card.tone} transition-colors`}>
                  {card.label}
                </div>
                <div className={`p-2 border rounded-lg ${card.chip}`}>
                  <Icon className="h-4 w-4 text-foreground" />
                </div>
              </div>
              <div className="text-4xl font-extrabold text-foreground mb-2">{card.value}</div>
              <div className="flex items-center justify-between gap-3 text-xs font-semibold text-foreground/70">
                <span>{card.meta}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </>
          );

          if (card.to) {
            return (
              <Link key={card.label} to={card.to} className="glass-panel p-6 group hover:border-primary/20 transition-all shadow-sm">
                {content}
              </Link>
            );
          }

          return (
            <button
              key={card.label}
              type="button"
              onClick={card.onClick}
              className="glass-panel p-6 group hover:border-primary/20 transition-all shadow-sm text-left"
            >
              {content}
            </button>
          );
        })}
      </motion.section>

      <motion.section variants={fadeUp} className="grid gap-8 xl:grid-cols-[1.5fr_1fr]">
        <div className="glass-panel p-8">
          <div className="text-[10px] font-bold uppercase tracking-widest text-foreground/65 mb-2">
            System Integrity
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground mb-8">
            Execution quality over time
          </h2>

          <div className="rounded-2xl border border-border bg-card/50 p-6">
            <div className="relative flex w-full min-h-[300px] items-end gap-4 overflow-x-auto">
              {analytics.scoreTrend.map((point) => (
                <Link
                  key={point.id}
                  to={`/dashboard/meetings/${point.id}`}
                  className="flex min-w-[88px] flex-1 flex-col items-center gap-3 group relative"
                >
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border px-3 py-1.5 rounded-lg text-xs font-bold text-foreground shadow-lg z-10 whitespace-nowrap">
                    {point.score}% Integrity
                  </div>
                  <div className="relative h-52 w-full rounded-xl bg-secondary/70 border border-border overflow-hidden">
                    <div
                      className={`absolute inset-x-0 bottom-0 rounded-t-lg ${barColor(point.score)} opacity-90 group-hover:opacity-100 transition-opacity`}
                      style={{ height: `${Math.max(Math.min(point.score, 100), 8)}%` }}
                    />
                  </div>
                  <div className="text-center w-full">
                    <div className="text-sm font-extrabold text-foreground">{point.score}</div>
                    <div className="mt-1 text-[10px] font-bold text-foreground/70 uppercase tracking-wider truncate" title={point.label}>
                      {point.label}
                    </div>
                  </div>
                </Link>
              ))}
              {analytics.scoreTrend.length === 0 && (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="text-sm font-medium text-foreground/70 text-center bg-background px-6 py-4 rounded-xl border border-border shadow-sm">
                    Process a few meetings to extract a global integrity trend.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="glass-panel p-8">
            <div className="text-[10px] font-bold uppercase tracking-widest text-violet-600 mb-2">
              Owner Load
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-6">
              Who is carrying the work?
            </h2>
            <div className="space-y-3">
              {analytics.ownerLoad.map((owner) => (
                <Link
                  key={owner.name}
                  to={buildOwnerTaskPath(owner.name)}
                  className="rounded-2xl bg-violet-500/5 border border-violet-500/20 px-5 py-4 flex items-center justify-between hover:bg-card transition-colors"
                >
                  <div className="text-sm font-bold text-foreground">{owner.name}</div>
                  <div className="rounded-lg bg-background border border-border px-3 py-1.5 text-xs font-extrabold text-foreground shadow-sm">
                    {owner.count} Tasks
                  </div>
                </Link>
              ))}
              {analytics.ownerLoad.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-secondary/70 p-6 text-sm text-foreground/70 text-center font-medium">
                  No tasks assigned yet.
                </div>
              )}
            </div>
          </div>

          <div className="glass-panel p-8">
            <div className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-2">
              Frequency Diagnostics
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-6">
              Where meetings lose momentum
            </h2>
            <div className="space-y-3">
              {analytics.topRisks.map((risk) => (
                <button
                  key={risk.label}
                  type="button"
                  onClick={() => openRiskModal(risk)}
                  className="rounded-2xl bg-amber-500/10 border border-amber-500/20 px-5 py-4 flex items-center justify-between shadow-sm transition hover:bg-amber-500/15"
                >
                  <div className="text-sm font-bold text-amber-700 dark:text-amber-400">{risk.label}</div>
                  <div className="rounded-lg bg-background border border-border px-3 py-1.5 text-xs font-extrabold text-amber-700 dark:text-amber-400 shadow-sm">
                    {risk.value} Issues
                  </div>
                </button>
              ))}
              {analytics.topRisks.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-secondary/70 p-6 text-sm text-foreground/70 text-center font-medium">
                  Zero systemic anomalies detected.
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section variants={fadeUp} className="grid gap-6 xl:grid-cols-2">
        <div ref={peopleSectionRef} className="glass-panel p-8">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-violet-600 mb-4">
            <Users className="h-4 w-4 text-violet-500" />
            People Coverage
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground mb-6">
            Recognized People
          </h2>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {(people || []).slice(0, 8).map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => openPersonModal(person)}
                className="w-full text-left rounded-2xl bg-violet-500/5 hover:bg-card border border-violet-500/20 p-4 transition-colors"
              >
                <div className="flex flex-col gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-foreground truncate">{person.displayName}</div>
                    <div className="mt-1 text-[10px] uppercase font-bold tracking-widest text-foreground/65 truncate">
                      {person.isWorkspaceMember ? person.email || 'Native Member' : 'External Request'}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <span className="bg-background border border-border px-2 py-1 rounded-md text-[10px] font-bold text-foreground shadow-sm">
                      {person.ownedTaskCount} Tasks
                    </span>
                    <span className="bg-background border border-border px-2 py-1 rounded-md text-[10px] font-bold text-foreground shadow-sm">
                      {person.meetingCount} Meetings
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div ref={trustSectionRef} className="glass-panel p-8">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-4">
            <AlertTriangle className="h-4 w-4 text-emerald-500" />
            System Verification
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground mb-6">
            Trust Posture
          </h2>
          <div className="space-y-4 text-sm leading-relaxed text-foreground font-medium">
            <Link
              to={buildDashboardPath('/dashboard/tasks', { filter: 'Workspace matched' })}
              className="block rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-5 shadow-sm transition hover:bg-card"
            >
              <span className="font-extrabold text-foreground">{analytics.matchedTaskOwners || 0}</span> / {snapshot.tasks.length}{' '}
              tasks currently map to a workspace person.
            </Link>
            <Link
              to={buildDashboardPath('/dashboard/meetings', { filter: 'Transcript Ready' })}
              className="block rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-5 shadow-sm transition hover:bg-card"
            >
              <span className="font-extrabold text-foreground">{transcriptReadyMeetings}</span> / {meetings.length} meetings
              include transcript text for direct review.
            </Link>
            <button
              type="button"
              onClick={() => peopleSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="w-full rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-left text-emerald-700 dark:text-emerald-400 shadow-sm transition hover:bg-emerald-500/15"
            >
              <span className="font-extrabold">Attribution principle:</span> speaker ownership stays explicit. If the
              system cannot isolate a real participant or owner, it leaves the work unassigned instead of guessing.
            </button>
          </div>
        </div>
      </motion.section>

      <AnimatePresence>
        {selectedRisk && selectedRiskPlaybook && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/65 backdrop-blur-sm p-4"
            onClick={closeRiskModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-1">
                    Risk resolution
                  </div>
                  <h3 className="text-xl font-extrabold tracking-tight text-foreground leading-tight">
                    {selectedRisk.label}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {selectedRisk.value} meeting{selectedRisk.value === 1 ? '' : 's'} currently surface this pattern.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeRiskModal}
                  className="rounded-xl border border-border bg-background p-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-700 dark:text-amber-400">
                  {selectedRiskPlaybook.heading}
                </div>
                <div className="mt-4 space-y-3">
                  {selectedRiskPlaybook.steps.map((step, index) => (
                    <div key={`${selectedRisk.label}-step-${index}`} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-[11px] font-extrabold text-amber-700 dark:text-amber-400">
                        {index + 1}
                      </div>
                      <p className="text-sm leading-6 text-foreground">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {selectedRiskPlaybook.actions.map((action) =>
                  action.to ? (
                    <Link
                      key={`${selectedRisk.label}-${action.label}`}
                      to={action.to}
                      onClick={closeRiskModal}
                      className="button-secondary"
                    >
                      {action.label}
                    </Link>
                  ) : null
                )}
                <Link
                  to={buildDashboardPath('/dashboard/meetings', { filter: 'Risks Found', q: selectedRisk.label })}
                  onClick={closeRiskModal}
                  className="button-primary"
                >
                  Open affected meetings
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
        {personModal.open && selectedPerson && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/65 backdrop-blur-sm p-4"
            onClick={closePersonModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-1">
                    Person Actions
                  </div>
                  <h3 className="text-xl font-extrabold tracking-tight text-foreground leading-tight">
                    {selectedPerson.displayName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closePersonModal}
                  className="rounded-xl border border-border bg-background p-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {personModal.isWorkspaceMember ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm font-medium text-amber-700 dark:text-amber-400">
                  This person is a workspace member. Rename or removal is managed from workspace account settings.
                </div>
              ) : (
                <>
                  <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Rename Person
                  </label>
                  <input
                    value={personModal.draftName}
                    onChange={(event) => setPersonModal((current) => ({ ...current, draftName: event.target.value }))}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Person name"
                  />

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRenamePerson}
                      disabled={savingPerson || deletingPerson}
                      className="button-primary text-xs"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {savingPerson ? 'Saving...' : 'Rename Person'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDeletePerson}
                      disabled={savingPerson || deletingPerson}
                      className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/15 disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {deletingPerson ? 'Deleting...' : 'Delete Person'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

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

function buildOwnerTaskPath(owner) {
  const normalizedOwner = String(owner || '').trim();

  if (!normalizedOwner || normalizedOwner.toLowerCase() === 'unassigned') {
    return buildDashboardPath('/dashboard/tasks', { filter: 'Unassigned' });
  }

  return buildDashboardPath('/dashboard/tasks', { owner: normalizedOwner });
}
