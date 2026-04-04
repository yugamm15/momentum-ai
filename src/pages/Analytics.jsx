import { AlertTriangle, BarChart3, Gauge, Users } from 'lucide-react';
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
  const { analytics, meetings } = snapshot;

  return (
    <div className="space-y-6">
      <section className="momentum-card momentum-spotlight p-6">
        <div className="momentum-pill-accent">
          <BarChart3 className="h-4 w-4" />
          Analytics
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
          Execution quality across the workspace
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
          Momentum becomes unique when the workspace makes ambiguity, accountability, and follow-through visible over time instead of just storing transcripts.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Meeting debt', value: analytics.meetingDebt, meta: 'Open ambiguity signals', icon: Gauge },
          { label: 'Unassigned tasks', value: analytics.unassignedTasks, meta: 'Ownership gaps', icon: Users },
          { label: 'Missing deadlines', value: analytics.missingDeadlines, meta: 'Execution timing gaps', icon: AlertTriangle },
          { label: 'Meetings tracked', value: meetings.length, meta: 'Seeded plus live history', icon: BarChart3 },
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

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
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
    </div>
  );
}
