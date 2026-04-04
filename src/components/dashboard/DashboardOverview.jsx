import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileAudio,
  ListTodo,
  Search,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DashboardOverview({ snapshot, loading, error }) {
  const meetings = Array.isArray(snapshot?.meetings) ? snapshot.meetings : [];
  const tasks = Array.isArray(snapshot?.tasks) ? snapshot.tasks : [];
  const ownerLoad = buildOwnerLoad(snapshot?.analytics?.ownerLoad, tasks);
  const reviewTasks = tasks
    .filter((task) => isTaskNeedsReview(task))
    .slice(0, 4)
    .map((task) => ({
      id: task.id,
      title: task.title || 'Untitled follow-up',
      meetingTitle: getTaskMeetingTitle(task),
      reviewReason: getTaskReviewReason(task),
      confidence: task.confidence,
    }));
  const recentMeetings = meetings.slice(0, 4).map((meeting) => ({
    id: meeting.id,
    title: getMeetingTitle(meeting),
    state: getMeetingState(meeting),
    createdAt: meeting.createdAt || meeting.created_at || '',
  }));
  const staleTasks = tasks
    .filter((task) => getTaskStatus(task) !== 'done')
    .slice()
    .sort((left, right) => getTaskTimestamp(right) - getTaskTimestamp(left))
    .slice(0, 5)
    .map((task) => ({
      id: task.id,
      title: task.title || 'Untitled follow-up',
      meetingTitle: getTaskMeetingTitle(task),
      sourceSnippet: task.sourceSnippet || task.source_snippet || '',
      status: getTaskStatus(task),
    }));

  const readyMeetings = meetings.filter((meeting) => getMeetingState(meeting) === 'completed');
  const pendingMeetings = meetings.filter((meeting) => {
    const state = getMeetingState(meeting);
    return state === 'pending-analysis' || state === 'processing';
  });
  const openTasks = tasks.filter((task) => getTaskStatus(task) !== 'done');
  const averageActionability =
    readyMeetings.length > 0
      ? Math.round(
          readyMeetings.reduce((total, meeting) => total + Number(meeting?.score?.overall || 0), 0) /
            readyMeetings.length
        )
      : 0;
  const readyMeetingsHref = buildDashboardPath('/dashboard/meetings', { filter: 'Ready' });
  const pendingMeetingsHref = buildDashboardPath('/dashboard/meetings', { filter: 'Pending Analysis' });
  const reviewTasksHref = buildDashboardPath('/dashboard/tasks', { filter: 'Needs review', status: 'needs-review' });
  const openFollowUpsHref = buildDashboardPath('/dashboard/tasks', { filter: 'Active' });
  const transcriptSearchHref = buildDashboardPath('/dashboard/meetings', { filter: 'Transcript Ready' });
  const uploadHref = '/dashboard/upload';

  if (loading) {
    return (
      <div className="p-4 md:p-6 xl:p-8">
        <div className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--panel)] px-8 py-20 text-center">
          <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">Loading workspace</div>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
            Pulling meetings and follow-ups into view.
          </h3>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 xl:p-8">
      <div className="mx-auto max-w-[1600px] space-y-8">
        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--panel)] p-8">
            <div className="max-w-2xl">
              <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">
                Working surface
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                Captured meetings become visible follow-ups before they disappear.
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                This workspace stays narrow on purpose: recent recordings, follow-ups that still need ownership, and the
                evidence behind each task.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <OverviewMetric
                label="Meetings ready"
                value={readyMeetings.length}
                meta="Completed analyses"
                icon={<CheckCircle2 className="h-4 w-4" />}
                to={readyMeetingsHref}
              />
              <OverviewMetric
                label="Needs review"
                value={reviewTasks.length}
                meta="Owner or deadline unclear"
                icon={<AlertTriangle className="h-4 w-4" />}
                tone="rose"
                to={reviewTasksHref}
              />
              <OverviewMetric
                label="Pending analysis"
                value={pendingMeetings.length}
                meta="Saved or processing"
                icon={<FileAudio className="h-4 w-4" />}
                tone="amber"
                to={pendingMeetingsHref}
              />
              <OverviewMetric
                label="Open follow-ups"
                value={openTasks.length}
                meta="Still moving through the board"
                icon={<ListTodo className="h-4 w-4" />}
                to={openFollowUpsHref}
              />
            </div>
          </div>

          <div className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--soft-panel)] p-8">
            <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">Operational pressure</div>
            <div className="mt-5 space-y-5">
              <PressureRow
                label="Average meeting score"
                value={`${averageActionability}%`}
                hint="How actionable recent recordings look."
                to={readyMeetingsHref}
              />
              <PressureRow
                label="Unresolved review items"
                value={reviewTasks.length}
                hint="These are the fastest credibility wins in the demo."
                to={reviewTasksHref}
              />
              <PressureRow
                label="Owners carrying load"
                value={ownerLoad.length}
                hint="Shows whether follow-ups are clustering around a few people."
                to={openFollowUpsHref}
              />
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/dashboard/tasks" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950 transition hover:text-[color:var(--accent-strong)]">
                Open task board
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/dashboard/meetings" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950">
                Open meeting vault
                <Search className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {(error || recentMeetings.length === 0) && (
          <section className="rounded-[32px] border border-dashed border-[color:var(--line)] bg-white px-8 py-12">
            <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">Current state</div>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              {error ? 'The workspace needs attention before the demo.' : 'No live meeting data has landed yet.'}
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              {error
                ? error
                : 'Upload a real recording first so this overview can show actual follow-ups, review flags, and transcript-backed context.'}
            </p>
            {!error && (
              <Link
                to={uploadHref}
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-950 transition hover:text-[color:var(--accent-strong)]"
              >
                Upload a recording
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </section>
        )}

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr_0.9fr]">
          <Panel
            eyebrow="Recent recordings"
            title="Most recent meeting output"
            body="Use this to show the product tracking live recordings instead of canned examples."
          >
            <div className="divide-y divide-[color:var(--line)]">
              {recentMeetings.map((meeting) => (
                <Link
                  key={meeting.id}
                  to={`/dashboard/meetings/${meeting.id}`}
                  className="flex items-start justify-between gap-4 py-4 text-left transition first:pt-0 last:pb-0 hover:text-[color:var(--accent-strong)]"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{meeting.title}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">{getMeetingStateLabel(meeting.state)}</div>
                  </div>
                  <div className="text-xs text-slate-500">
                    {meeting.createdAt ? new Date(meeting.createdAt).toLocaleDateString() : 'Recent'}
                  </div>
                </Link>
              ))}
              {recentMeetings.length === 0 && <EmptyPanelCopy copy="New recordings will appear here once the workspace starts receiving meetings." />}
            </div>
          </Panel>

          <Panel
            eyebrow="Review queue"
            title="Ambiguities to resolve"
            body="These are the moments where the product proves restraint instead of guessing."
          >
            <div className="space-y-4">
              {reviewTasks.map((task) => (
                <Link
                  key={task.id}
                  to={buildDashboardPath('/dashboard/tasks', {
                    filter: 'Needs review',
                    status: 'needs-review',
                    task: task.id,
                  })}
                  className="block rounded-3xl border border-rose-200 bg-rose-50 px-4 py-4 transition hover:border-rose-300 hover:bg-rose-100/70"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{task.title}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.22em] text-rose-700">{task.meetingTitle}</div>
                    </div>
                    <div className="text-xs font-semibold text-rose-700">{formatConfidence(task.confidence)}</div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-rose-900">{task.reviewReason}</p>
                </Link>
              ))}
              {reviewTasks.length === 0 && (
                <EmptyPanelCopy copy="No review items are open right now. Owners and deadlines are landing cleanly." />
              )}
            </div>
          </Panel>

          <Panel
            eyebrow="Owner load"
            title="Where follow-ups are accumulating"
            body="Helps the demo land as an execution surface rather than just a transcript viewer."
          >
            <div className="space-y-4">
              {ownerLoad.map((entry) => (
                <Link
                  key={entry.owner}
                  to={buildOwnerTaskPath(entry.owner)}
                  className="flex items-center justify-between gap-4 rounded-2xl px-3 py-3 transition hover:bg-[color:var(--soft-panel)]"
                >
                  <div className="text-sm font-medium text-slate-700">{entry.owner}</div>
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-[color:var(--line)]">
                      <div
                        className="h-full rounded-full bg-[color:var(--accent-strong)]"
                        style={{ width: `${Math.min(100, entry.count * 20)}%` }}
                      />
                    </div>
                    <div className="w-6 text-right text-sm font-semibold text-slate-950">{entry.count}</div>
                  </div>
                </Link>
              ))}
              {ownerLoad.length === 0 && (
                <EmptyPanelCopy copy="No owner load to show yet. Open work will appear here once meetings produce follow-ups." />
              )}
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Panel
            eyebrow="Stale follow-ups"
            title="Work that risks getting lost"
            body="This is the sharpest proof after a real upload: follow-ups that are still hanging around."
          >
            <div className="space-y-4">
              {staleTasks.map((task) => (
                <Link
                  key={task.id}
                  to={buildDashboardPath('/dashboard/tasks', { task: task.id })}
                  className="flex items-start justify-between gap-4 border-b border-[color:var(--line)] py-4 first:pt-0 last:border-b-0 last:pb-0"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{task.title}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {task.sourceSnippet || 'No source snippet stored yet.'}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                      <span>{task.meetingTitle}</span>
                      <span>•</span>
                      <span>{getTaskStatusLabel(task.status)}</span>
                    </div>
                  </div>
                  <Clock3 className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                </Link>
              ))}
              {staleTasks.length === 0 && (
                <EmptyPanelCopy copy="No stale follow-ups are visible yet. Once tasks remain open across refreshes, they will surface here." />
              )}
            </div>
          </Panel>

          <Panel eyebrow="Next actions" title="Suggested demo path" body="Keep the walkthrough narrow and honest.">
            <div className="space-y-4 text-sm leading-6 text-slate-700">
              <Step
                index="1"
                title="Open Meetings"
                body="Show one completed meeting and open its detail view."
                icon={<Search className="h-4 w-4" />}
                to={readyMeetingsHref}
              />
              <Step
                index="2"
                title="Inspect evidence"
                body="Scroll through extracted follow-ups and point to the source wording."
                icon={<CheckCircle2 className="h-4 w-4" />}
                to={transcriptSearchHref}
              />
              <Step
                index="3"
                title="Resolve one ambiguity"
                body="Move one needs-review task into a clear owner and deadline."
                icon={<AlertTriangle className="h-4 w-4" />}
                to={reviewTasksHref}
              />
              <Step
                index="4"
                title="Upload a real recording"
                body="End with a live upload so the workspace feels current instead of staged."
                icon={<FileAudio className="h-4 w-4" />}
                to={uploadHref}
              />
            </div>
          </Panel>
        </section>
      </div>
    </div>
  );
}

function OverviewMetric({ label, value, meta, icon, tone = 'default', to }) {
  const iconClass =
    tone === 'rose'
      ? 'text-rose-700 bg-rose-100'
      : tone === 'amber'
        ? 'text-amber-700 bg-amber-100'
        : 'text-slate-950 bg-[color:var(--soft-panel)]';

  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${iconClass}`}>{icon}</div>
        <div className="text-2xl font-semibold tracking-tight text-slate-950">{value}</div>
      </div>
      <div className="mt-4 text-sm font-semibold text-slate-950">{label}</div>
      <div className="mt-1 text-sm text-slate-600">{meta}</div>
    </>
  );

  if (!to) {
    return <div className="rounded-[28px] border border-[color:var(--line)] bg-white px-4 py-4">{content}</div>;
  }

  return (
    <Link to={to} className="rounded-[28px] border border-[color:var(--line)] bg-white px-4 py-4 transition hover:border-slate-300 hover:bg-[color:var(--soft-panel)]">
      {content}
    </Link>
  );
}

function PressureRow({ label, value, hint, to }) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-950">{label}</div>
        <div className="text-lg font-semibold tracking-tight text-slate-950">{value}</div>
      </div>
      <div className="mt-1 text-sm text-slate-600">{hint}</div>
    </>
  );

  if (!to) {
    return (
      <div className="border-b border-[color:var(--line)] pb-5 last:border-b-0 last:pb-0">
        {content}
      </div>
    );
  }

  return (
    <Link
      to={to}
      className="block border-b border-[color:var(--line)] pb-5 transition hover:text-[color:var(--accent-strong)] last:border-b-0 last:pb-0"
    >
      {content}
    </Link>
  );
}

function Panel({ eyebrow, title, body, children }) {
  return (
    <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--panel)] p-8">
      <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">{eyebrow}</div>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function EmptyPanelCopy({ copy }) {
  return <p className="rounded-3xl bg-[color:var(--soft-panel)] px-4 py-4 text-sm leading-6 text-slate-600">{copy}</p>;
}

function Step({ index, title, body, icon, to }) {
  const content = (
    <>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--soft-panel)] text-slate-950">
        {icon}
      </div>
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">{index}</div>
        <div className="mt-1 text-sm font-semibold text-slate-950">{title}</div>
        <div className="mt-1 text-sm text-slate-600">{body}</div>
      </div>
    </>
  );

  if (!to) {
    return <div className="flex gap-4">{content}</div>;
  }

  return (
    <Link to={to} className="flex gap-4 rounded-2xl px-2 py-2 transition hover:bg-[color:var(--soft-panel)]">
      {content}
    </Link>
  );
}

function buildOwnerLoad(existingOwnerLoad, tasks) {
  if (Array.isArray(existingOwnerLoad) && existingOwnerLoad.length > 0) {
    return existingOwnerLoad.slice(0, 6).map((entry) => ({
      owner: entry.owner || entry.name || 'Unassigned',
      count: Number(entry.count || 0),
    }));
  }

  const counts = new Map();

  tasks.forEach((task) => {
    if (getTaskStatus(task) === 'done') {
      return;
    }

    const owner = getTaskOwner(task);
    counts.set(owner, (counts.get(owner) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([owner, count]) => ({ owner, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);
}

function getMeetingTitle(meeting) {
  return meeting?.aiTitle || meeting?.title || meeting?.rawTitle || 'Untitled meeting';
}

function getMeetingState(meeting) {
  const status = String(meeting?.processingStatus || meeting?.status || '').trim().toLowerCase();

  if (status === 'ready' || status === 'completed') {
    return 'completed';
  }

  if (status === 'processing') {
    return 'processing';
  }

  if (status === 'pending-analysis' || status.startsWith('raw-uploaded:') || status.startsWith('audio-uploaded:')) {
    return 'pending-analysis';
  }

  if (String(meeting?.transcriptText || '').trim()) {
    return 'completed';
  }

  return 'unknown';
}

function getMeetingStateLabel(state) {
  if (state === 'completed') {
    return 'Ready';
  }

  if (state === 'processing') {
    return 'Processing';
  }

  if (state === 'pending-analysis') {
    return 'Recording saved';
  }

  return 'Needs review';
}

function getTaskMeetingTitle(task) {
  return task?.sourceMeeting || task?.meetingTitle || task?.meetings?.title || 'Unlinked follow-up';
}

function getTaskStatus(task) {
  const status = String(task?.status || '').trim().toLowerCase();

  if (status === 'todo') {
    return 'pending';
  }

  if (status === 'in-progress' || status === 'needs-review' || status === 'done' || status === 'pending') {
    return status;
  }

  return 'pending';
}

function getTaskStatusLabel(status) {
  if (status === 'in-progress') {
    return 'In progress';
  }

  if (status === 'needs-review') {
    return 'Needs review';
  }

  if (status === 'done') {
    return 'Done';
  }

  return 'Queued';
}

function getTaskOwner(task) {
  const owner = String(task?.owner || task?.assignee || '').trim();

  if (!owner || owner.toUpperCase() === 'UNCLEAR') {
    return 'Unassigned';
  }

  return owner;
}

function getTaskDeadline(task) {
  const deadline = String(task?.dueDate || task?.deadline || '').trim();
  return deadline;
}

function isTaskNeedsReview(task) {
  return getTaskStatus(task) === 'needs-review' || isTaskOwnerUnclear(task) || isTaskDeadlineMissing(task);
}

function isTaskOwnerUnclear(task) {
  const owner = String(task?.owner || task?.assignee || '').trim();
  return !owner || owner.toUpperCase() === 'UNCLEAR';
}

function isTaskDeadlineMissing(task) {
  const deadline = getTaskDeadline(task);
  return !deadline || deadline === 'Missing';
}

function getTaskReviewReason(task) {
  const explicitReason = String(task?.reviewReason || task?.review_reason || '').trim();
  if (explicitReason) {
    return explicitReason;
  }

  const reasons = [];

  if (isTaskOwnerUnclear(task)) {
    reasons.push('Owner was not explicit in the meeting.');
  }

  if (isTaskDeadlineMissing(task)) {
    reasons.push('Deadline was not explicit in the meeting.');
  }

  return reasons.join(' ') || 'This follow-up needs a quick human pass before it moves forward.';
}

function formatConfidence(confidence) {
  const value = Number(confidence);

  if (!Number.isFinite(value)) {
    return 'Manual';
  }

  const normalized = value > 1 ? value : value * 100;
  return `${Math.round(normalized)}%`;
}

function getTaskTimestamp(task) {
  const source = task?.updatedAt || task?.updated_at || task?.createdAt || task?.created_at || '';
  const parsed = Date.parse(source);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildDashboardPath(path, params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    const normalizedValue = String(value || '').trim();
    if (normalizedValue) {
      search.set(key, normalizedValue);
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
