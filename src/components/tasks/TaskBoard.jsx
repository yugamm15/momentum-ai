import { useEffect, useState } from 'react';
import {
  Plus,
  Filter,
  AlertCircle,
  Clock,
  ArrowRight,
  Layers,
  Layout,
  Kanban,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const TASK_STATUSES = ['todo', 'in-progress', 'done', 'needs-review'];

export default function TaskBoard() {
  const [tasks, setTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [createError, setCreateError] = useState('');
  const [form, setForm] = useState({
    title: '',
    assignee: '',
    deadline: '',
    status: 'todo',
    meetingId: '',
  });

  async function loadBoardData({ quiet = false } = {}) {
    if (!quiet) {
      setLoading(true);
    }

    try {
      const [tasksResponse, meetingsResponse] = await Promise.all([
        supabase.from('tasks').select('id, title, assignee, deadline, status, meeting_id, meetings(title)'),
        supabase.from('meetings').select('id, title').order('created_at', { ascending: false }),
      ]);

      if (tasksResponse.error) {
        throw tasksResponse.error;
      }

      if (meetingsResponse.error) {
        throw meetingsResponse.error;
      }

      setTasks(tasksResponse.data || []);
      setMeetings(meetingsResponse.data || []);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Momentum could not load the task board.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBoardData().catch(() => {});
    const interval = setInterval(() => {
      if (!navigator.onLine) {
        return;
      }

      loadBoardData({ quiet: true }).catch(() => {});
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  async function handleAdvanceTask(task, direction) {
    const currentIndex = TASK_STATUSES.indexOf(task.status);
    const nextIndex = Math.max(0, Math.min(TASK_STATUSES.length - 1, currentIndex + direction));
    const nextStatus = TASK_STATUSES[nextIndex];

    if (nextStatus === task.status) {
      return;
    }

    const { error } = await supabase
      .from('tasks')
      .update({ status: nextStatus })
      .eq('id', task.id);

    if (error) {
      setLoadError(error.message || 'Momentum could not update that task.');
      return;
    }

    setTasks((previous) =>
      previous.map((existingTask) =>
        existingTask.id === task.id
          ? {
              ...existingTask,
              status: nextStatus,
            }
          : existingTask
      )
    );
  }

  async function handleCreateTask(event) {
    event.preventDefault();
    if (!form.title.trim()) {
      setCreateError('Task title is required.');
      return;
    }

    setIsSaving(true);
    setCreateError('');

    const payload = {
      title: form.title.trim(),
      assignee: form.assignee.trim() || 'UNCLEAR',
      deadline: form.deadline.trim() || 'Missing',
      status: form.status,
      meeting_id: form.meetingId || null,
    };

    const { error } = await supabase.from('tasks').insert(payload);

    if (error) {
      setCreateError(error.message || 'Momentum could not create that task.');
      setIsSaving(false);
      return;
    }

    setForm({
      title: '',
      assignee: '',
      deadline: '',
      status: 'todo',
      meetingId: '',
    });
    setIsSaving(false);
    setIsCreateOpen(false);
    await loadBoardData({ quiet: true });
  }

  const visibleTasks = tasks.filter((task) => {
    if (filterMode === 'all') {
      return true;
    }

    if (filterMode === 'active') {
      return task.status !== 'done';
    }

    if (filterMode === 'review') {
      return task.status === 'needs-review' || task.assignee === 'UNCLEAR' || task.deadline === 'Missing';
    }

    return true;
  });

  const columns = [
    { id: 'todo', label: 'Queued', color: 'bg-slate-400', icon: Layers },
    { id: 'in-progress', label: 'Executing', color: 'bg-blue-600', icon: Layout },
    { id: 'done', label: 'Resolved', color: 'bg-emerald-500', icon: Kanban },
    { id: 'needs-review', label: 'Needs Review', color: 'bg-rose-600', icon: AlertCircle },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400">
        <RefreshCw className="w-10 h-10 animate-spin mb-4" />
        <span className="font-black uppercase tracking-widest text-xs">Loading Task Board...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-8 duration-700">
      <div className="flex justify-between items-center mb-12 bg-white p-10 rounded-[40px] border-2 border-slate-50 shadow-2xl">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-2 font-black">Execution Hub</h1>
          <p className="text-slate-500 font-medium">Automatic task extraction and team workflow management.</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setFilterMode(getNextTaskFilterMode(filterMode))}
            className="px-8 py-4 bg-white border-2 border-slate-100 shadow-xl rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all active:scale-95"
          >
            <Filter className="w-4 h-4 inline mr-2" /> {getTaskFilterLabel(filterMode)}
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-8 py-4 bg-slate-900 text-white shadow-2xl shadow-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 inline mr-2" /> Inject Task
          </button>
        </div>
      </div>

      {loadError && (
        <div className="mb-8 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="text-sm font-semibold">{loadError}</div>
          <button
            onClick={() => loadBoardData().catch(() => {})}
            className="px-4 py-2 rounded-xl bg-white border border-rose-200 text-xs font-black uppercase tracking-widest"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex gap-8 overflow-x-auto pb-12 snap-x px-4">
        {columns.map((column) => {
          const columnTasks = visibleTasks.filter((task) => task.status === column.id);
          const Icon = column.icon;

          return (
            <div key={column.id} className="flex-none w-96 flex flex-col bg-slate-50/50 rounded-[48px] border-4 border-white p-6 shadow-inner snap-center">
              <div className="flex justify-between items-center mb-8 px-4 pt-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 flex items-center justify-center rounded-2xl shadow-lg ${column.color} text-white`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-black text-xs text-slate-900 uppercase tracking-[0.2em]">
                    {column.label}
                  </h3>
                </div>
                <span className="w-10 h-10 flex items-center justify-center bg-white border-2 border-slate-100 text-slate-900 text-xs font-black rounded-2xl shadow-sm">
                  {columnTasks.length}
                </span>
              </div>

              <div className="flex flex-col gap-6">
                {columnTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`bg-white p-8 rounded-[32px] border-2 border-slate-50 shadow-xl transition-all duration-300 relative group ${
                      task.status === 'needs-review' ? 'border-rose-100' : ''
                    }`}
                  >
                    {task.status === 'needs-review' && (
                      <div className="flex items-center gap-2 text-[10px] font-black text-rose-600 uppercase tracking-widest mb-4">
                        <AlertCircle className="w-4 h-4 animate-pulse" /> Critical Ambiguity
                      </div>
                    )}

                    <h4 className="text-lg font-black text-slate-900 mb-6 leading-tight group-hover:text-blue-600 transition-colors">
                      {task.title}
                    </h4>

                    <div className="px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8 inline-flex items-center gap-2 w-full">
                      <ArrowRight className="w-4 h-4 flex-shrink-0 text-blue-500" />
                      <span className="truncate">{task.meetings?.title || 'System Task'}</span>
                    </div>

                    <div className="flex justify-between items-center border-t-2 border-slate-50 pt-6 mt-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shadow-lg ${
                          task.assignee === 'UNCLEAR'
                            ? 'bg-rose-100 text-rose-700 border-2 border-rose-200'
                            : 'bg-indigo-600 text-white'
                        }`}>
                          {task.assignee === 'UNCLEAR' ? '?' : task.assignee.charAt(0)}
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${task.assignee === 'UNCLEAR' ? 'text-rose-600' : 'text-slate-400'}`}>
                          {task.assignee}
                        </span>
                      </div>

                      <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${
                        task.deadline === 'Missing' ? 'text-rose-500' : 'text-slate-400 text-xs px-3 py-1 bg-slate-100 rounded-lg'
                      }`}>
                        <Clock className="w-4 h-4" />
                        {task.deadline}
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between gap-3">
                      <button
                        onClick={() => handleAdvanceTask(task, -1)}
                        disabled={TASK_STATUSES.indexOf(task.status) === 0}
                        className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-500 disabled:opacity-40"
                      >
                        <ChevronLeft className="w-4 h-4 inline mr-2" />
                        Back
                      </button>
                      <button
                        onClick={() => handleAdvanceTask(task, 1)}
                        disabled={TASK_STATUSES.indexOf(task.status) === TASK_STATUSES.length - 1}
                        className="flex-1 px-4 py-3 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest disabled:opacity-40"
                      >
                        Forward
                        <ChevronRight className="w-4 h-4 inline ml-2" />
                      </button>
                    </div>
                  </div>
                ))}

                {columnTasks.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-48 border-4 border-dashed border-slate-200 rounded-[32px] text-xs text-slate-300 font-black uppercase tracking-widest my-2 bg-white/50">
                    <Layers className="w-8 h-8 mb-4 opacity-10" />
                    No Data Detected
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[999] flex items-center justify-center p-6">
          <div className="w-full max-w-xl bg-white rounded-[32px] shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2">Manual Injection</div>
                <h3 className="text-2xl font-black text-slate-900">Create Task</h3>
              </div>
              <button
                onClick={() => {
                  setIsCreateOpen(false);
                  setCreateError('');
                }}
                className="w-12 h-12 rounded-2xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-8 space-y-4">
              <input
                type="text"
                value={form.title}
                onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
                placeholder="Task title"
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  value={form.assignee}
                  onChange={(event) => setForm((previous) => ({ ...previous, assignee: event.target.value }))}
                  placeholder="Assignee"
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none"
                />
                <input
                  type="text"
                  value={form.deadline}
                  onChange={(event) => setForm((previous) => ({ ...previous, deadline: event.target.value }))}
                  placeholder="Deadline"
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select
                  value={form.status}
                  onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value }))}
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none"
                >
                  <option value="todo">Queued</option>
                  <option value="in-progress">Executing</option>
                  <option value="done">Resolved</option>
                  <option value="needs-review">Needs Review</option>
                </select>
                <select
                  value={form.meetingId}
                  onChange={(event) => setForm((previous) => ({ ...previous, meetingId: event.target.value }))}
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none"
                >
                  <option value="">No linked meeting</option>
                  {meetings.map((meeting) => (
                    <option key={meeting.id} value={meeting.id}>
                      {meeting.title}
                    </option>
                  ))}
                </select>
              </div>

              {createError && <div className="rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 text-sm">{createError}</div>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setCreateError('');
                  }}
                  className="px-6 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-3 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function getNextTaskFilterMode(currentFilter) {
  const filterModes = ['all', 'active', 'review'];
  const currentIndex = filterModes.indexOf(currentFilter);
  return filterModes[(currentIndex + 1) % filterModes.length];
}

function getTaskFilterLabel(filterMode) {
  if (filterMode === 'active') {
    return 'Filter: Active';
  }

  if (filterMode === 'review') {
    return 'Filter: Review';
  }

  return 'Filter: All';
}
