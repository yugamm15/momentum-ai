import { AlertTriangle, AudioLines, BarChart3, Gauge, Users } from 'lucide-react';
import { useWorkspace } from '../components/workspace/useWorkspace';

function barColor(score) {
  if (score >= 80) {
    return 'bg-emerald-400';
  }

  if (score >= 60) {
    return 'bg-amber-400';
  }

  return 'bg-rose-400';
}

export default function Analytics() {
  const { snapshot } = useWorkspace();
  const { analytics, meetings, people } = snapshot;

  return (
    <div className="space-y-6">
      <section className="momentum-card momentum-spotlight p-6">
        <div className="momentum-pill-accent">
          <BarChart3 className="h-4 w-4" />
          Analytics
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
          Patterns behind meeting quality and follow-through
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
          The point of the analytics surface is not volume. It is to show where the system is trustworthy, where it still needs human review, and how accountability is spreading across the workspace.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Meeting debt', value: analytics.meetingDebt, meta: 'Open ambiguity signals', icon: Gauge },
          { label: 'Unassigned tasks', value: analytics.unassignedTasks, meta: 'Ownership gaps', icon: Users },
          { label: 'People tracked', value: analytics.peopleTracked || people.length, meta: 'Workspace + meeting participants', icon: BarChart3 },
          { label: 'Named-speaker recordings', value: analytics.speakerAttributedMeetings || 0, meta: 'True speaker attribution', icon: AudioLines },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="momentum-card p-5">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {card.label}
                </div>
                <Icon className="h-4 w-4 text-sky-600" />
              </div>
              <div className="momentum-number mt-3 text-4xl font-semibold text-slate-950">
                {card.value}
              </div>
              <div className="mt-2 text-sm text-slate-500">{card.meta}</div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <div className="momentum-card p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Meeting score trend
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Execution quality over time
          </h2>
          <div className="momentum-dark-panel mt-6 p-5">
            <div className="relative flex min-h-[260px] items-end gap-4">
              {analytics.scoreTrend.map((point) => (
                <div key={point.id} className="flex flex-1 flex-col items-center gap-3">
                  <div
                    className="flex w-full items-end justify-center rounded-t-[20px] bg-white/5 px-2"
                    style={{ height: `${Math.max(point.score, 24) * 1.6}px` }}
                  >
                    <div className={`w-full rounded-t-[18px] ${barColor(point.score)}`} style={{ height: `${Math.max(point.score, 24)}%` }} />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-semibold text-white">{point.score}</div>
                    <div className="mt-1 text-[11px] leading-4 text-slate-400">{point.label}</div>
                  </div>
                </div>
              ))}
              {analytics.scoreTrend.length === 0 ? (
                <div className="flex h-full flex-1 items-center justify-center text-sm text-slate-400">
                  Process a few meetings to start building a trend line.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="momentum-card p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Owner load
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Who is carrying the work?
            </h2>
            <div className="mt-5 space-y-3">
              {analytics.ownerLoad.map((owner) => (
                <div key={owner.name} className="momentum-card-soft px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">{owner.name}</div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                      {owner.count}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="momentum-card p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Risk frequency
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Where meetings lose momentum
            </h2>
            <div className="mt-5 space-y-3">
              {analytics.topRisks.map((risk) => (
                <div key={risk.label} className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">{risk.label}</div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm">
                      {risk.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="momentum-card p-6">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            <Users className="h-4 w-4 text-teal-700" />
            People coverage
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Recognized people pool
          </h2>
          <div className="mt-5 space-y-3">
            {(people || []).slice(0, 8).map((person) => (
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
          </div>
        </div>

        <div className="momentum-card p-6">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            System honesty
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            What still needs work
          </h2>
          <div className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
            <div className="momentum-card-soft px-4 py-4">
              {analytics.matchedTaskOwners || 0} of {snapshot.tasks.length} tasks currently map to a known workspace person.
            </div>
            <div className="momentum-card-soft px-4 py-4">
              {analytics.speakerAttributedMeetings || 0} of {meetings.length} meetings currently include trustworthy named-speaker transcript data.
            </div>
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
              Speaker attribution should never be faked. If the system does not know who said a line, the transcript must stay unattributed.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
