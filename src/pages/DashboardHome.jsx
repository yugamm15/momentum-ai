import { ArrowRight, Sparkles, Target, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../components/workspace/useWorkspace';

const scorePill = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function DashboardHome() {
  const { snapshot, loading } = useWorkspace();
  const { analytics, meetings, tasks } = snapshot;
  const recentMeetings = meetings.slice(0, 4);
  const reviewQueue = tasks.filter((task) => task.needsReview).slice(0, 4);

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <div className="momentum-card momentum-spotlight p-6 lg:p-7">
          <div className="momentum-pill-accent">
            <Sparkles className="h-4 w-4" />
            Momentum command center
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
            Meetings become follow-through the moment they land here.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
            The product wins when the first screen explains the whole loop fast: what happened, what needs action, what still feels ambiguous, and whether the meeting was actually executable.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/dashboard/meetings" className="momentum-button-primary">
              Open meeting vault
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/dashboard/upload" className="momentum-button-secondary">
              Upload a fresh recording
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {analytics.metrics.slice(0, 3).map((metric) => (
              <div key={metric.label} className="momentum-card-soft p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {metric.label}
                </div>
                <div className="momentum-number mt-3 text-3xl font-semibold text-slate-950">
                  {metric.value}
                </div>
                <div className="mt-2 text-sm text-slate-500">{metric.meta}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="momentum-dark-panel momentum-spotlight p-6">
          <div className="relative">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200">
              <TrendingUp className="h-4 w-4" />
              Meeting debt
            </div>
            <div className="momentum-number mt-4 text-6xl font-semibold text-white">
              {analytics.meetingDebt}
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Signals of unresolved ownership, vague wording, and missing deadlines across the workspace.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Unassigned
                </div>
                <div className="momentum-number mt-2 text-3xl font-semibold text-white">
                  {analytics.unassignedTasks}
                </div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  No deadline
                </div>
                <div className="momentum-number mt-2 text-3xl font-semibold text-white">
                  {analytics.missingDeadlines}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {analytics.metrics.map((metric) => (
          <div key={metric.label} className="momentum-card p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              {metric.label}
            </div>
            <div className="momentum-number mt-3 text-4xl font-semibold text-slate-950">
              {metric.value}
            </div>
            <div className="mt-2 text-sm text-slate-500">{metric.meta}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="momentum-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Execution trend
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                Score momentum
              </h2>
            </div>
            <Target className="h-5 w-5 text-sky-600" />
          </div>

          <div className="momentum-dark-panel mt-6 p-5">
            <div className="relative flex min-h-[240px] items-end gap-3">
              {analytics.scoreTrend.map((point) => (
                <div key={point.id} className="flex flex-1 flex-col items-center gap-3">
                  <div
                    className="flex w-full items-end justify-center rounded-t-[20px] bg-white/5 px-2"
                    style={{ height: `${Math.max(point.score, 24) * 1.55}px` }}
                  >
                    <div
                      className={`w-full rounded-t-[18px] ${
                        point.color === 'emerald'
                          ? 'bg-emerald-300'
                          : point.color === 'amber'
                            ? 'bg-amber-300'
                            : 'bg-rose-300'
                      }`}
                      style={{ height: `${Math.max(point.score, 24)}%` }}
                    />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-semibold text-white">{point.score}</div>
                    <div className="mt-1 text-[11px] leading-4 text-slate-400">{point.label}</div>
                  </div>
                </div>
              ))}
              {analytics.scoreTrend.length === 0 && !loading ? (
                <div className="flex h-full flex-1 items-center justify-center text-sm text-slate-400">
                  Add processed meetings to start the score trend.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="momentum-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Risk radar
                </div>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  Most common blockers
                </h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {analytics.topRisks.map((risk) => (
                <div key={risk.label} className="momentum-card-soft px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-semibold text-slate-800">{risk.label}</div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                      {risk.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="momentum-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Review queue
                </div>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  Needs human eyes
                </h2>
              </div>
              <Link to="/dashboard/tasks" className="text-sm font-semibold text-sky-700">
                Open board
              </Link>
            </div>
            <div className="mt-5 space-y-3">
              {reviewQueue.map((task) => (
                <div key={task.id} className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4">
                  <div className="text-sm font-semibold text-slate-900">{task.title}</div>
                  <div className="mt-1 text-xs text-slate-600">{task.sourceMeeting}</div>
                </div>
              ))}
              {reviewQueue.length === 0 ? (
                <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                  No risky tasks right now. The workspace looks unusually crisp.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="momentum-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Recent meetings
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Latest execution snapshots
            </h2>
          </div>
          <Link to="/dashboard/meetings" className="text-sm font-semibold text-sky-700">
            View all
          </Link>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {recentMeetings.map((meeting) => (
            <Link
              key={meeting.id}
              to={`/dashboard/meetings/${meeting.id}`}
              className="momentum-card-soft block p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {meeting.timeLabel}
                  </div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {meeting.aiTitle}
                  </div>
                </div>
                <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${scorePill[meeting.score.color]}`}>
                  {meeting.score.overall}
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600">{meeting.summaryParagraph}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
