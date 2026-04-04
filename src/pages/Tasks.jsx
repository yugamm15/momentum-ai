import { useDeferredValue, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../components/workspace/useWorkspace';
import { createWorkspaceTask, updateWorkspaceTask } from '../lib/workspace-data';

const columns = [
  { id: 'pending', label: 'Pending' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'needs-review', label: 'Needs Review' },
  { id: 'done', label: 'Done' },
];

const filterOptions = ['All', 'Needs review', 'Unassigned', 'Missing deadline'];

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

      if (!matchesQuery) {
        return false;
      }

      if (activeFilter === 'Needs review') {
        return task.needsReview;
      }

      if (activeFilter === 'Unassigned') {
        return !task.owner;
      }

      if (activeFilter === 'Missing deadline') {
        return !task.dueDate;
      }

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
    new Set(
      snapshot.tasks
        .map((task) => task.owner)
        .filter((owner) => owner && owner !== 'Unassigned')
    )
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
      setError(statusError.message || 'Momentum could not update this task.');
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
      setError(createError.message || 'Momentum could not create this task.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <datalist id="task-owner-options">
        {ownerSuggestions.map((owner) => (
          <option key={owner} value={owner} />
        ))}
      </datalist>

      <section className="momentum-card momentum-spotlight p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="momentum-pill-accent">Execution board</div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Manage follow-through with less friction.
            </h1>
            <p className="mt-4 text-base leading-8 text-slate-600">
              This board is optimized for the real work: triage ambiguity, assign owners faster, and connect every action back to the meeting that generated it.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="momentum-input-shell min-w-[260px]">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tasks, owners, or source snippets"
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
              className="momentum-button-primary"
            >
              <Plus className="h-4 w-4" />
              Add task
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {[
            { label: 'Tasks tracked', value: summary.total, meta: 'Across all visible meetings' },
            { label: 'Still pending', value: summary.pending, meta: 'Not yet done' },
            { label: 'Need review', value: summary.review, meta: 'Ambiguous or risky items' },
            { label: 'Completion', value: `${summary.completion}%`, meta: 'Execution progress' },
          ].map((item) => (
            <div key={item.label} className="momentum-card-soft p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {item.label}
              </div>
              <div className="momentum-number mt-3 text-3xl font-semibold text-slate-950">
                {item.value}
              </div>
              <div className="mt-2 text-sm text-slate-500">{item.meta}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setActiveFilter(option)}
                className={
                  activeFilter === option
                    ? 'rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white'
                    : 'rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900'
                }
              >
                {option}
              </button>
            ))}
          </div>
          <div className="text-sm text-slate-500">
            Showing <span className="font-semibold text-slate-900">{filteredTasks.length}</span> task{filteredTasks.length === 1 ? '' : 's'}
          </div>
        </div>

        {error ? (
          <div className="momentum-card-soft mt-5 border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {showCreate ? (
          <form onSubmit={handleCreate} className="mt-5 grid gap-3 rounded-[28px] border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="momentum-input-shell">
              <select
                value={newTask.meetingId}
                onChange={(event) => setNewTask((current) => ({ ...current, meetingId: event.target.value }))}
              >
                {liveMeetings.length === 0 ? <option value="">No live meetings yet</option> : null}
                {liveMeetings.map((meeting) => (
                  <option key={meeting.id} value={meeting.id}>
                    {meeting.aiTitle}
                  </option>
                ))}
              </select>
            </div>
            <div className="momentum-input-shell">
              <input
                value={newTask.title}
                onChange={(event) => setNewTask((current) => ({ ...current, title: event.target.value }))}
                placeholder="Task title"
              />
            </div>
            <div className="momentum-input-shell">
              <input
                value={newTask.owner}
                onChange={(event) => setNewTask((current) => ({ ...current, owner: event.target.value }))}
                placeholder="Owner"
                list="task-owner-options"
              />
            </div>
            <div className="momentum-input-shell">
              <input
                value={newTask.dueDate}
                onChange={(event) => setNewTask((current) => ({ ...current, dueDate: event.target.value }))}
                placeholder="Due date"
              />
            </div>
            <button
              type="submit"
              disabled={creating || !newTask.title.trim() || !newTask.meetingId}
              className="momentum-button-primary w-full"
            >
              {creating ? 'Creating...' : 'Create task'}
            </button>
          </form>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => {
          const tasks = filteredTasks.filter((task) => task.status === column.id);
          return (
            <div key={column.id} className="momentum-card p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">{column.label}</h2>
                <div className="momentum-pill">{tasks.length}</div>
              </div>
              <div className="mt-4 space-y-3">
                {tasks.map((task) => (
                  <div key={task.id} className="momentum-card-soft p-4">
                    <Link
                      to={`/dashboard/meetings/${task.meetingId}`}
                      className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                    >
                      {task.sourceMeeting}
                    </Link>
                    <div className="mt-2 text-sm font-semibold text-slate-950">{task.title}</div>
                    <div className="mt-2 text-xs text-slate-500">
                      {task.owner || 'Needs owner'} {' - '} {task.dueDate || 'Missing deadline'}
                    </div>
                    <div className="mt-3 rounded-[18px] border border-slate-200 bg-white px-3 py-3 text-xs leading-6 text-slate-600">
                      {task.sourceSnippet}
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-slate-500">
                        {task.needsReview ? 'Review before trusting' : `Confidence ${(task.confidence * 100).toFixed(0)}%`}
                      </div>
                      {!task.isSeeded ? (
                        <button
                          type="button"
                          onClick={() => cycleStatus(task)}
                          disabled={savingId === task.id}
                          className="rounded-[18px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-70"
                        >
                          {savingId === task.id ? 'Saving...' : 'Move forward'}
                        </button>
                      ) : (
                        <div className="rounded-[18px] bg-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Seeded
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {tasks.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    No tasks in {column.label.toLowerCase()} right now.
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

