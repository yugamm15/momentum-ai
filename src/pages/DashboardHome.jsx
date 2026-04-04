import { ArrowRight, AudioLines, Sparkles, Target, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../components/workspace/useWorkspace';

const scorePill = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function DashboardHome() {
  const { snapshot, loading } = useWorkspace();
  const { analytics, meetings, tasks, people } = snapshot;
  const recentMeetings = meetings.slice(0, 3);
  const reviewQueue = tasks.filter((task) => task.needsReview).slice(0, 4);
  const activePeople = people.slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <div className="momentum-card momentum-spotlight p-7 lg:p-8">
          <div className="momentum-pill-accent">
            <Sparkles className="h-4 w-4" />
            Workspace overview
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
            Everything important from the meeting should still be obvious a day later.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            Momentum works when the workspace keeps four things visible at once: the recording, the transcript, the people involved, and the exact follow-through still missing.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/dashboard/meetings" className="momentum-button-primary">
              Open meeting library
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/dashboard/tasks" className="momentum-button-secondary">
              Review owner load
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                label: 'Meetings processed',
                value: analytics.metrics[0]?.value || '0',
                meta: analytics.metrics[0]?.meta || 'No meetings yet',
              },
              {
                label: 'People tracked',
                value: String(analytics.peopleTracked || people.length || 0),
                meta: `${analytics.matchedTaskOwners || 0} task owners matched to workspace people`,
              },
              {
                label: 'Speaker-attributed recordings',
                value: String(analytics.speakerAttributedMeetings || 0),
                meta: 'Truthful transcript coverage today',
              },
            ].map((metric) => (
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

        <div className="momentum-dark-panel p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-100/70">
                Accountability pressure
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                Meeting debt
              </h2>
            </div>
            <Target className="h-5 w-5 text-teal-200" />
          </div>

          <div className="momentum-number mt-5 text-6xl font-semibold text-white">
            {analytics.meetingDebt}
          </div>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Open ambiguity across recordings: unassigned tasks, missing dates, and moments where the transcript still needs human confirmation.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Unassigned tasks
              </div>
              <div className="momentum-number mt-2 text-3xl font-semibold text-white">
                {analytics.unassignedTasks}
              </div>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Missing deadlines
              </div>
              <div className="momentum-number mt-2 text-3xl font-semibold text-white">
                {analytics.missingDeadlines}
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

      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="momentum-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Recent recordings
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                What landed most recently
              </h2>
            </div>
            <Link to="/dashboard/meetings" className="text-sm font-semibold text-sky-700">
              View all
            </Link>
          </div>

          <div className="mt-5 grid gap-4">
            {recentMeetings.map((meeting) => (
              <Link
                key={meeting.id}
                to={`/dashboard/meetings/${meeting.id}`}
                className="momentum-card-soft block p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {meeting.timeLabel}
                    </div>
                    <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                      {meeting.aiTitle}
                    </div>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                      {meeting.summaryParagraph}
                    </p>
                  </div>
                  <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${scorePill[meeting.score.color]}`}>
                    Score {meeting.score.overall}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="momentum-pill">{meeting.tasks.length} tasks</span>
                  <span className="momentum-pill">{meeting.participants.length} people</span>
                  <span className="momentum-pill">
                    {meeting.audioUrl ? 'Recording available' : 'Transcript only'}
                  </span>
                </div>
              </Link>
            ))}

            {recentMeetings.length === 0 && !loading ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                The workspace is waiting for its first recording.
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-6">
          <div className="momentum-card p-6">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              <Users className="h-4 w-4 text-teal-700" />
              People pool
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Who Momentum recognizes
            </h2>

            <div className="mt-5 space-y-3">
              {activePeople.map((person) => (
                <div key={person.id} className="momentum-card-soft px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{person.displayName}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {person.isWorkspaceMember ? person.email || 'Workspace member' : 'Meeting participant'}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <div>{person.ownedTaskCount} tasks</div>
                      <div className="mt-1">{person.meetingCount} meetings</div>
                    </div>
                  </div>
                </div>
              ))}

              {activePeople.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  People will appear here once recordings and owners start flowing into the workspace.
                </div>
              ) : null}
            </div>
          </div>

          <div className="momentum-card p-6">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              <AudioLines className="h-4 w-4 text-amber-700" />
              Review queue
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Needs human confirmation
            </h2>

            <div className="mt-5 space-y-3">
              {reviewQueue.map((task) => (
                <div key={task.id} className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4">
                  <div className="text-sm font-semibold text-slate-900">{task.title}</div>
                  <div className="mt-1 text-xs text-slate-600">{task.sourceMeeting}</div>
                </div>
              ))}

              {reviewQueue.length === 0 ? (
                <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                  No review-critical tasks right now.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
