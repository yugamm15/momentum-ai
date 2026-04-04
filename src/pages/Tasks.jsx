import { useDeferredValue, useMemo, useState } from 'react';
import { Plus, Search, Users, LayoutList } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkspace } from '../components/workspace/useWorkspace';
import { createWorkspaceTask, updateWorkspaceTask } from '../lib/workspace-data';

const columns = [
  { id: 'pending', label: 'Pending' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'needs-review', label: 'Needs Review' },
  { id: 'done', label: 'Done' },
];

const filterOptions = ['All', 'Needs review', 'Unassigned', 'Missing deadline', 'Workspace matched'];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
};

export default function Tasks() {
  const { snapshot, refresh } = useWorkspace();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState('');
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

    return snapshot.tasks.filter((task) => {
      const matchesQuery =
        !normalizedQuery ||
        [task.title, task.owner, task.sourceMeeting, task.sourceSnippet]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);

      if (!matchesQuery) return false;
      if (activeFilter === 'Needs review') return task.needsReview;
      if (activeFilter === 'Unassigned') return !task.owner;
      if (activeFilter === 'Missing deadline') return !task.dueDate;
      if (activeFilter === 'Workspace matched') return Boolean(task.ownerProfileId);
      return true;
    });
  }, [activeFilter, deferredQuery, snapshot.tasks]);

  const summary = useMemo(() => {
    const total = snapshot.tasks.length;
    const pending = snapshot.tasks.filter((task) => task.status !== 'done').length;
    const review = snapshot.tasks.filter((task) => task.needsReview).length;
    const completion =
      total > 0
        ? Math.round((snapshot.tasks.filter((task) => task.status === 'done').length / total) * 100)
        : 0;

    return { total, pending, review, completion };
  }, [snapshot.tasks]);

  const liveMeetings = snapshot.liveMeetings;
  const ownerSuggestions = Array.from(
    new Set((snapshot.people || []).map((person) => person.displayName).filter(Boolean))
  );

  async function cycleStatus(task) {
    const currentIndex = columns.findIndex((column) => column.id === task.status);
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

      {/* Hero Section */}
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
              Tasks & Actions
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed font-medium">
              Manage action items extracted directly from your meeting recordings. Assign owners and set deadlines.
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
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tasks, people..."
                className="w-full bg-card border border-border rounded-2xl py-3 pl-12 pr-4 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium shadow-sm"
              />
            </div>
            <button
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

        {/* Dynamic Telemetry */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          {[
            { label: 'Active Tasks', value: summary.total, meta: 'Across all meetings' },
            { label: 'Pending', value: summary.pending, meta: 'Needs to be done' },
            { label: 'Review Needed', value: summary.review, meta: 'Check for accuracy' },
            { label: 'Completion', value: `${summary.completion}%`, meta: 'Tasks finished' },
          ].map((item, idx) => (
            <div key={idx} className="bg-secondary/50 border border-border rounded-2xl p-5 hover:bg-card transition-colors shadow-sm">
              <div className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground mb-3">{item.label}</div>
              <div className="text-3xl font-extrabold text-foreground mb-1">{item.value}</div>
              <div className="text-xs font-semibold text-muted-foreground/80">{item.meta}</div>
            </div>
          ))}
        </div>
        
        {/* Filters Panel */}
        <div className="relative z-10 mt-8 pt-6 border-t border-border flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option}
                onClick={() => setActiveFilter(option)}
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
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Showing <span className="text-foreground">{filteredTasks.length}</span> Tasks
          </div>
        </div>
      </motion.section>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold shadow-sm">
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
          const tasks = filteredTasks.filter((task) => task.status === column.id);
          return (
            <div key={column.id} className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h2 className="text-xl font-bold tracking-tight text-foreground">{column.label}</h2>
                <div className="text-[10px] font-bold bg-secondary text-muted-foreground px-2 py-1 rounded-md">
                  {tasks.length}
                </div>
              </div>
              
              <div className="flex flex-col gap-4 h-full">
                <AnimatePresence>
                  {tasks.map((task) => (
                    <motion.div 
                      key={task.id} 
                      layout 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="glass-panel p-5 group hover:border-primary/20 transition-all shadow-sm"
                    >
                      <Link
                        to={`/dashboard/meetings/${task.meetingId}`}
                        className="text-[10px] font-bold uppercase tracking-widest text-primary/80 hover:text-primary transition-colors block mb-2 truncate"
                      >
                        {task.sourceMeeting}
                      </Link>
                      
                      <div className="text-sm font-bold text-foreground leading-snug mb-3 pr-2">
                        {task.title}
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="rounded-lg bg-secondary px-2.5 py-1 text-[10px] font-bold text-foreground shadow-sm truncate max-w-[120px]">
                          👤 {task.owner || 'Unassigned'}
                        </span>
                        <span className="rounded-lg bg-secondary px-2.5 py-1 text-[10px] font-bold text-foreground shadow-sm">
                          ⏳ {task.dueDate || 'No constraint'}
                        </span>
                        {task.ownerProfileId && (
                          <span className="rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1 text-[10px] font-bold text-primary shadow-sm">
                            Matched
                          </span>
                        )}
                        {task.needsReview && (
                          <span className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 shadow-sm">
                            Validate
                          </span>
                        )}
                      </div>
                      
                      <div className="rounded-xl border border-border bg-card/60 p-3 text-[11px] leading-relaxed text-muted-foreground font-medium italic mb-4 line-clamp-3 group-hover:bg-card transition-colors">
                        "{task.sourceSnippet}"
                      </div>
                      
                      <div className="flex items-center justify-between gap-2 mt-auto">
                        <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                          {task.needsReview ? 'Check task' : `Confidence ${(task.confidence * 100).toFixed(0)}%`}
                        </div>
                        <button
                          type="button"
                          onClick={() => cycleStatus(task)}
                          disabled={savingId === task.id}
                          className="rounded-lg bg-primary/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                        >
                          {savingId === task.id ? 'Moving...' : 'Move Status'}
                        </button>
                      </div>
                    </motion.div>
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
    </motion.div>
  );
}
