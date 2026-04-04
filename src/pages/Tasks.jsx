import { useDeferredValue, useMemo, useState } from 'react';
import { Clock3, FileText, GripVertical, LayoutList, Plus, Search, User, Users, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkspace } from '../components/workspace/useWorkspace';
import { createWorkspaceTask, updateWorkspaceTask } from '../lib/workspace-data';

const columns = [
  { id: 'pending', label: 'Pending' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'needs-review', label: 'Needs Review' },
  { id: 'done', label: 'Done' },
];

const filterOptions = ['All', 'Active', 'Needs review', 'Unassigned', 'Missing deadline', 'Workspace matched'];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

export default function Tasks() {
  const { snapshot, refresh } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => String(searchParams.get('q') || '').trim());
  const [activeFilter, setActiveFilter] = useState(() => sanitizeTaskFilter(searchParams.get('filter')));
  const [statusFocus, setStatusFocus] = useState(() => sanitizeTaskStatus(searchParams.get('status')));
  const [ownerFocus, setOwnerFocus] = useState(() => String(searchParams.get('owner') || '').trim());
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState(() => String(searchParams.get('task') || '').trim());
  const [draggingTaskId, setDraggingTaskId] = useState('');
  const [dragTargetStatus, setDragTargetStatus] = useState('');
  const [error, setError] = useState('');
  const [newTask, setNewTask] = useState({
    meetingId: '',
    title: '',
    owner: '',
    dueDate: '',
    status: 'pending',
  });
  const deferredQuery = useDeferredValue(query);

  const filteredTasks = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    const normalizedOwnerFocus = normalizeOwnerKey(ownerFocus);

    return snapshot.tasks.filter((task) => {
      const searchable = [
        task.title,
        getTaskOwner(task),
        getTaskSourceMeeting(task),
        task.sourceSnippet,
        task.sourceMeeting,
      ]
        .join(' ')
        .toLowerCase();

      if (normalizedQuery && !searchable.includes(normalizedQuery)) {
        return false;
      }

      if (normalizedOwnerFocus) {
        const taskOwnerKey = normalizeOwnerKey(getTaskOwner(task));
        const matchesUnassigned = normalizedOwnerFocus === 'unassigned' && !taskOwnerKey;

        if (!matchesUnassigned && taskOwnerKey !== normalizedOwnerFocus) {
          return false;
        }
      }

      if (statusFocus && normalizeTaskStatus(task.status) !== statusFocus) {
        return false;
      }

      if (activeFilter === 'Active') return normalizeTaskStatus(task.status) !== 'done';
      if (activeFilter === 'Needs review') return task.needsReview;
      if (activeFilter === 'Unassigned') return !getTaskOwner(task);
      if (activeFilter === 'Missing deadline') return !task.dueDate;
      if (activeFilter === 'Workspace matched') return Boolean(task.ownerProfileId);
      return true;
    });
  }, [activeFilter, deferredQuery, ownerFocus, snapshot.tasks, statusFocus]);

  const summary = useMemo(() => {
    const total = snapshot.tasks.length;
    const active = snapshot.tasks.filter((task) => normalizeTaskStatus(task.status) !== 'done').length;
    const pending = snapshot.tasks.filter((task) => normalizeTaskStatus(task.status) === 'pending').length;
    const review = snapshot.tasks.filter((task) => task.needsReview).length;
    const done = snapshot.tasks.filter((task) => normalizeTaskStatus(task.status) === 'done').length;

    return { total, active, pending, review, done };
  }, [snapshot.tasks]);

  const liveMeetings = snapshot.liveMeetings;
  const ownerSuggestions = Array.from(
    new Set((snapshot.people || []).map((person) => person.displayName).filter(Boolean))
  );

  const selectedTask = useMemo(
    () => snapshot.tasks.find((task) => String(task.id) === String(selectedTaskId)) || null,
    [selectedTaskId, snapshot.tasks]
  );

  const summaryCards = [
    { label: 'All Tasks', value: summary.total, meta: 'Across every meeting', action: { filter: 'All', status: '' } },
    { label: 'Active', value: summary.active, meta: 'Still open on the board', action: { filter: 'Active', status: '' } },
    { label: 'Pending', value: summary.pending, meta: 'Queued and not started', action: { filter: 'All', status: 'pending' } },
    { label: 'Needs Review', value: summary.review, meta: 'Owner or deadline unclear', action: { filter: 'Needs review', status: 'needs-review' } },
    { label: 'Done', value: summary.done, meta: 'Already closed out', action: { filter: 'All', status: 'done' } },
  ];

  function syncView({
    nextQuery = query,
    nextFilter = activeFilter,
    nextStatus = statusFocus,
    nextOwner = ownerFocus,
    nextTaskId = selectedTaskId,
  } = {}) {
    const params = new URLSearchParams();
    const normalizedQuery = String(nextQuery || '').trim();
    const normalizedFilter = sanitizeTaskFilter(nextFilter);
    const normalizedStatus = sanitizeTaskStatus(nextStatus);
    const normalizedOwner = String(nextOwner || '').trim();
    const normalizedTaskId = String(nextTaskId || '').trim();

    if (normalizedQuery) {
      params.set('q', normalizedQuery);
    }

    if (normalizedFilter !== 'All') {
      params.set('filter', normalizedFilter);
    }

    if (normalizedStatus) {
      params.set('status', normalizedStatus);
    }

    if (normalizedOwner) {
      params.set('owner', normalizedOwner);
    }

    if (normalizedTaskId) {
      params.set('task', normalizedTaskId);
    }

    setSearchParams(params, { replace: true });
  }

  function applyBoardView({ filter = activeFilter, status = statusFocus, owner = ownerFocus, taskId = selectedTaskId } = {}) {
    const normalizedFilter = sanitizeTaskFilter(filter);
    const normalizedStatus = sanitizeTaskStatus(status);
    const normalizedOwner = String(owner || '').trim();
    const normalizedTaskId = String(taskId || '').trim();

    setActiveFilter(normalizedFilter);
    setStatusFocus(normalizedStatus);
    setOwnerFocus(normalizedOwner);
    setSelectedTaskId(normalizedTaskId);
    syncView({
      nextFilter: normalizedFilter,
      nextStatus: normalizedStatus,
      nextOwner: normalizedOwner,
      nextTaskId: normalizedTaskId,
    });
  }

  function handleQueryChange(nextValue) {
    setQuery(nextValue);
    syncView({ nextQuery: nextValue, nextTaskId: '' });
    setSelectedTaskId('');
  }

  function openTaskDetails(taskId) {
    const normalizedTaskId = String(taskId || '').trim();
    setSelectedTaskId(normalizedTaskId);
    syncView({ nextTaskId: normalizedTaskId });
  }

  function closeTaskDetails() {
    setSelectedTaskId('');
    syncView({ nextTaskId: '' });
  }

  async function cycleStatus(task) {
    const currentIndex = columns.findIndex((column) => column.id === normalizeTaskStatus(task.status));
    const nextStatus = columns[(currentIndex + 1 + columns.length) % columns.length].id;

    setSavingId(task.id);
    setError('');
    try {
      await updateWorkspaceTask(task.id, { status: nextStatus });
      await refresh({ silent: true });
    } catch (statusError) {
      setError(statusError.message || 'Moméntum could not update this task.');
    } finally {
      setSavingId('');
    }
  }

  function handleTaskDragStart(event, task) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(task.id || ''));
    setDraggingTaskId(String(task.id || ''));
    setDragTargetStatus('');
  }

  function handleTaskDragEnd() {
    setDraggingTaskId('');
    setDragTargetStatus('');
  }

  function handleColumnDragOver(event, status) {
    if (!draggingTaskId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dragTargetStatus !== status) {
      setDragTargetStatus(status);
    }
  }

  async function handleColumnDrop(event, status) {
    event.preventDefault();
    const droppedTaskId = String(event.dataTransfer.getData('text/plain') || draggingTaskId || '').trim();

    setDragTargetStatus('');
    setDraggingTaskId('');

    if (!droppedTaskId) {
      return;
    }

    const droppedTask = snapshot.tasks.find((task) => String(task.id) === droppedTaskId);
    if (!droppedTask || normalizeTaskStatus(droppedTask.status) === status) {
      return;
    }

    setSavingId(droppedTaskId);
    setError('');
    try {
      await updateWorkspaceTask(droppedTaskId, { status });
      await refresh({ silent: true });
    } catch (dropError) {
      setError(dropError.message || 'Momentum could not move this task.');
    } finally {
      setSavingId('');
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    setCreating(true);
    setError('');

    try {
      await createWorkspaceTask(newTask);
      setShowCreate(false);
      setNewTask({
        meetingId: liveMeetings[0]?.id || '',
        title: '',
        owner: '',
        dueDate: '',
        status: 'pending',
      });
      await refresh({ silent: true });
    } catch (createError) {
      setError(createError.message || 'Moméntum could not create this task.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      className="p-6 md:p-8 xl:p-12 max-w-[1600px] mx-auto space-y-8 min-h-screen"
    >
      <datalist id="task-owner-options">
        {ownerSuggestions.map((owner) => (
          <option key={owner} value={owner} />
        ))}
      </datalist>

      <motion.section variants={fadeUp} className="glass-panel p-8 md:p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] dark:opacity-5 pointer-events-none text-foreground">
          <LayoutList className="w-64 h-64" />
        </div>

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-end justify-between gap-8 mb-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-primary/10 border border-primary/20 text-[10px] uppercase font-bold text-primary tracking-widest shadow-sm">
              <Users className="w-3 h-3" />
              Execution Board
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground mb-4">
              Follow-ups with real navigation.
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed font-medium">
              Move tasks between lanes, jump straight to the source meeting, and deep-link into the exact follow-up that still needs work.
            </p>
          </div>

          <div className="w-full xl:w-auto flex flex-col sm:flex-row gap-4 relative z-10">
            <div className="relative group w-full xl:w-[320px]">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              </div>
              <input
                type="text"
                value={query}
                onChange={(event) => handleQueryChange(event.target.value)}
                placeholder="Search tasks, owners, or source meetings..."
                className="w-full bg-card border border-border rounded-2xl py-3 pl-12 pr-4 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium shadow-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setShowCreate((current) => !current);
                setNewTask((current) => ({
                  ...current,
                  meetingId: current.meetingId || liveMeetings[0]?.id || '',
                }));
              }}
              className="button-primary whitespace-nowrap shadow-md shadow-primary/20"
            >
              <Plus className="h-4 w-4" />
              Create Task
            </button>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mt-8">
          {summaryCards.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => applyBoardView({ filter: item.action.filter, status: item.action.status, owner: '', taskId: '' })}
              className={`rounded-2xl border p-5 text-left transition-colors shadow-sm ${
                activeFilter === item.action.filter && statusFocus === item.action.status
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border bg-secondary/50 hover:bg-card'
              }`}
            >
              <div className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground mb-3">{item.label}</div>
              <div className="text-3xl font-extrabold text-foreground mb-1">{item.value}</div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-muted-foreground/80">{item.meta}</div>
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>

        <div className="relative z-10 mt-8 pt-6 border-t border-border flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => applyBoardView({ filter: option, status: '', owner: '', taskId: '' })}
                className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all ${
                  activeFilter === option
                    ? 'bg-foreground text-background shadow-md'
                    : 'bg-secondary text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-sm'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
            {statusFocus ? (
              <button
                type="button"
                onClick={() => applyBoardView({ status: '', taskId: '' })}
                className="rounded-full bg-secondary px-3 py-1.5 text-foreground"
              >
                Status: {columns.find((column) => column.id === statusFocus)?.label || statusFocus} ×
              </button>
            ) : null}
            {ownerFocus ? (
              <button
                type="button"
                onClick={() => applyBoardView({ owner: '', taskId: '' })}
                className="rounded-full bg-secondary px-3 py-1.5 text-foreground"
              >
                Owner: {ownerFocus} ×
              </button>
            ) : null}
            <span>
              Showing <span className="text-foreground">{filteredTasks.length}</span> Tasks
            </span>
          </div>
        </div>
      </motion.section>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold shadow-sm"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreate && (
          <motion.form
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            onSubmit={handleCreate}
            className="glass-panel p-6 overflow-hidden"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <select
                value={newTask.meetingId}
                onChange={(event) => setNewTask((current) => ({ ...current, meetingId: event.target.value }))}
                className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm font-medium"
              >
                {liveMeetings.length === 0 ? <option value="">No meetings found</option> : null}
                {liveMeetings.map((meeting) => (
                  <option key={meeting.id} value={meeting.id}>
                    {meeting.aiTitle}
                  </option>
                ))}
              </select>

              <input
                value={newTask.title}
                onChange={(event) => setNewTask((current) => ({ ...current, title: event.target.value }))}
                placeholder="Task Title"
                className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm font-medium"
              />

              <input
                value={newTask.owner}
                onChange={(event) => setNewTask((current) => ({ ...current, owner: event.target.value }))}
                placeholder="Assign owner"
                list="task-owner-options"
                className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm font-medium"
              />

              <input
                value={newTask.dueDate}
                onChange={(event) => setNewTask((current) => ({ ...current, dueDate: event.target.value }))}
                placeholder="Due Date"
                className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm font-medium"
              />

              <button
                type="submit"
                disabled={creating || !newTask.title.trim() || !newTask.meetingId}
                className="button-primary h-full rounded-xl shadow-md disabled:opacity-50"
              >
                {creating ? 'Saving...' : 'Create Task'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <motion.section variants={fadeUp} className="grid gap-6 xl:grid-cols-4">
        {columns.map((column) => {
          const tasks = filteredTasks.filter((task) => normalizeTaskStatus(task.status) === column.id);
          const isFocusedColumn = !statusFocus || statusFocus === column.id;

          return (
            <div
              key={column.id}
              onDragOver={(event) => handleColumnDragOver(event, column.id)}
              onDrop={(event) => handleColumnDrop(event, column.id)}
              onDragLeave={() => {
                if (dragTargetStatus === column.id) {
                  setDragTargetStatus('');
                }
              }}
              className={`flex flex-col gap-4 rounded-2xl transition-all ${
                dragTargetStatus === column.id ? 'ring-1 ring-primary/35 bg-primary/5 p-2 -m-2' : ''
              } ${isFocusedColumn ? 'opacity-100' : 'opacity-55'}`}
            >
              <button
                type="button"
                onClick={() => applyBoardView({ status: statusFocus === column.id ? '' : column.id, taskId: '' })}
                className="flex items-center justify-between pb-3 border-b border-border text-left"
              >
                <h2 className="text-xl font-bold tracking-tight text-foreground">{column.label}</h2>
                <div className="text-[10px] font-bold bg-secondary text-muted-foreground px-2 py-1 rounded-md">
                  {tasks.length}
                </div>
              </button>

              <div className="flex flex-col gap-4 h-full">
                <AnimatePresence>
                  {tasks.map((task) => (
                    <motion.button
                      type="button"
                      key={task.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      draggable
                      onDragStart={(event) => handleTaskDragStart(event, task)}
                      onDragEnd={handleTaskDragEnd}
                      onClick={() => openTaskDetails(task.id)}
                      className={`glass-panel w-full p-5 text-left group hover:border-primary/20 transition-all shadow-sm cursor-grab active:cursor-grabbing ${
                        draggingTaskId === task.id ? 'opacity-55' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-bold text-foreground leading-snug pr-2 line-clamp-3">
                          {task.title}
                        </div>
                        <GripVertical className="h-4 w-4 text-muted-foreground/80 shrink-0" />
                      </div>

                      <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">
                        {getTaskSourceMeeting(task)}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
                        <span>{savingId === task.id ? 'Updating status...' : 'Click for details'}</span>
                        {task.owner ? <span className="truncate text-right">{task.owner}</span> : null}
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>

                {tasks.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm font-medium text-muted-foreground mt-2">
                    No tasks here.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </motion.section>

      <AnimatePresence>
        {selectedTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/65 backdrop-blur-sm p-4"
            onClick={closeTaskDetails}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-2">
                    Task Details
                  </div>
                  <h3 className="text-2xl font-extrabold tracking-tight text-foreground leading-tight">
                    {selectedTask.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeTaskDetails}
                  className="rounded-xl border border-border bg-background p-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 mb-5">
                <button
                  type="button"
                  onClick={() =>
                    applyBoardView({
                      filter: getTaskOwner(selectedTask) ? 'All' : 'Unassigned',
                      status: '',
                      owner: getTaskOwner(selectedTask),
                      taskId: '',
                    })
                  }
                  className="rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm font-semibold text-foreground text-left hover:bg-card"
                >
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Owner</span>
                  <span className="inline-flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {getTaskOwner(selectedTask) || 'Unassigned'}
                  </span>
                </button>
                <div className="rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm font-semibold text-foreground">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Due Date</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                    {selectedTask.dueDate || 'No constraint'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => applyBoardView({ filter: 'All', status: normalizeTaskStatus(selectedTask.status), owner: '', taskId: '' })}
                  className="rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm font-semibold text-foreground text-left hover:bg-card"
                >
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Status</span>
                  {normalizeTaskStatus(selectedTask.status)}
                </button>
                {selectedTask.meetingId ? (
                  <Link
                    to={`/dashboard/meetings/${selectedTask.meetingId}`}
                    className="rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm font-semibold text-foreground hover:bg-card"
                  >
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Source Meeting</span>
                    {getTaskSourceMeeting(selectedTask)}
                  </Link>
                ) : (
                  <div className="rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm font-semibold text-foreground">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Source Meeting</span>
                    {getTaskSourceMeeting(selectedTask)}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-background p-4 mb-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2 inline-flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" />
                  Evidence Snippet
                </div>
                <p className="text-sm leading-relaxed text-foreground">
                  {selectedTask.sourceSnippet || 'No transcript evidence snippet is stored for this task yet.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedTask.meetingId ? (
                  <Link to={`/dashboard/meetings/${selectedTask.meetingId}`} className="button-secondary">
                    Open Meeting
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={async () => {
                    await cycleStatus(selectedTask);
                    openTaskDetails(selectedTask.id);
                  }}
                  disabled={savingId === selectedTask.id}
                  className="button-primary disabled:opacity-60"
                >
                  {savingId === selectedTask.id ? 'Updating...' : 'Move To Next Status'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function sanitizeTaskFilter(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'active') return 'Active';
  if (normalized === 'needs review' || normalized === 'needs-review') return 'Needs review';
  if (normalized === 'unassigned') return 'Unassigned';
  if (normalized === 'missing deadline') return 'Missing deadline';
  if (normalized === 'workspace matched') return 'Workspace matched';
  return 'All';
}

function sanitizeTaskStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'todo' || normalized === 'pending') return 'pending';
  if (normalized === 'in-progress') return 'in-progress';
  if (normalized === 'needs-review') return 'needs-review';
  if (normalized === 'done') return 'done';
  return '';
}

function normalizeTaskStatus(value) {
  return sanitizeTaskStatus(value) || 'pending';
}

function getTaskOwner(task) {
  return String(task?.owner || task?.assignee || '').trim();
}

function normalizeOwnerKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s'.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTaskSourceMeeting(task) {
  return task?.sourceMeeting || task?.meetingTitle || 'Unknown meeting';
}
