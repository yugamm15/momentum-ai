import { AlertTriangle, AudioLines, BarChart3, Gauge, Users, KeyRound, ShieldCheck, Database, PlugZap, Cpu, Wrench } from 'lucide-react';
import { useWorkspace } from '../components/workspace/useWorkspace';
import { motion } from 'framer-motion';

function barColor(score) {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-rose-500';
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
};

export default function Analytics() {
  const { snapshot } = useWorkspace();
  const { analytics, meetings, people } = snapshot;

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      className="p-6 md:p-8 xl:p-12 max-w-[1600px] mx-auto space-y-8 min-h-screen"
    >
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
            Flow state & Accountability
          </h1>
          <p className="mt-2 max-w-3xl text-lg font-medium text-white/80 leading-relaxed">
            The point of the analytics surface is not volume. It is to show where the system is trustworthy, where it still needs human review, and how accountability is spreading across the workspace.
          </p>
        </div>
      </motion.section>

      <motion.section variants={fadeUp} className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Execution Debt', value: analytics.meetingDebt, meta: 'Open ambiguity signals', icon: Gauge },
          { label: 'Unassigned Tasks', value: analytics.unassignedTasks, meta: 'Ownership gaps', icon: Users },
          { label: 'People Tracked', value: analytics.peopleTracked || people.length, meta: 'Workspace + meeting participants', icon: BarChart3 },
          { label: 'Speaker Detected', value: analytics.speakerAttributedMeetings || 0, meta: 'True speaker attribution', icon: AudioLines },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="glass-panel p-6 group hover:border-primary/20 transition-all shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                  {card.label}
                </div>
                <div className="p-2 bg-secondary rounded-lg">
                  <Icon className="h-4 w-4 text-foreground" />
                </div>
              </div>
              <div className="text-4xl font-extrabold text-foreground mb-2">
                {card.value}
              </div>
              <div className="text-xs font-semibold text-muted-foreground/80">{card.meta}</div>
            </div>
          );
        })}
      </motion.section>

      <motion.section variants={fadeUp} className="grid gap-8 xl:grid-cols-[1.5fr_1fr]">
        <div className="glass-panel p-8">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            System Integrity
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground mb-8">
            Execution quality over time
          </h2>
          
          <div className="rounded-2xl border border-border bg-card/50 p-6">
            <div className="relative flex min-h-[300px] items-end justify-between gap-4 w-full">
              {analytics.scoreTrend.map((point) => (
                <div key={point.id} className="flex flex-1 flex-col items-center gap-3 group relative">
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border px-3 py-1.5 rounded-lg text-xs font-bold text-foreground shadow-lg z-10">
                    {point.score}% Integrity
                  </div>
                  <div
                    className="flex w-full items-end justify-center rounded-t-xl bg-secondary/50 border border-transparent group-hover:border-border transition-colors px-1 h-full"
                    style={{ height: `${Math.max(point.score, 10)}%`, minHeight: '40px' }}
                  >
                    <div className={`w-full rounded-t-lg ${barColor(point.score)} opacity-80 group-hover:opacity-100 transition-opacity`} style={{ height: `${Math.max(point.score, 10)}%` }} />
                  </div>
                  <div className="text-center w-full">
                    <div className="text-sm font-extrabold text-foreground">{point.score}</div>
                    <div className="mt-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">{point.label}</div>
                  </div>
                </div>
              ))}
              {analytics.scoreTrend.length === 0 && (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="text-sm font-medium text-muted-foreground text-center bg-background px-6 py-4 rounded-xl border border-border shadow-sm">
                    Process a few meetings to extract a global integrity trend.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="glass-panel p-8">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Owner Load
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-6">
              Who is carrying the work?
            </h2>
            <div className="space-y-3">
              {analytics.ownerLoad.map((owner) => (
                <div key={owner.name} className="rounded-2xl bg-secondary/50 border border-border px-5 py-4 flex items-center justify-between hover:bg-card transition-colors">
                  <div className="text-sm font-bold text-foreground">{owner.name}</div>
                  <div className="rounded-lg bg-background border border-border px-3 py-1.5 text-xs font-extrabold text-foreground shadow-sm">
                    {owner.count} Tasks
                  </div>
                </div>
              ))}
              {analytics.ownerLoad.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-secondary/50 p-6 text-sm text-muted-foreground text-center font-medium">
                  No tasks assigned yet.
                </div>
              )}
            </div>
          </div>

          <div className="glass-panel p-8">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Frequency Diagnostics
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-6">
              Where meetings lose momentum
            </h2>
            <div className="space-y-3">
              {analytics.topRisks.map((risk) => (
                <div key={risk.label} className="rounded-2xl bg-amber-500/10 border border-amber-500/20 px-5 py-4 flex items-center justify-between shadow-sm">
                  <div className="text-sm font-bold text-amber-700 dark:text-amber-400">{risk.label}</div>
                  <div className="rounded-lg bg-background border border-border px-3 py-1.5 text-xs font-extrabold text-amber-700 dark:text-amber-400 shadow-sm">
                    {risk.value} Issues
                  </div>
                </div>
              ))}
              {analytics.topRisks.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-secondary/50 p-6 text-sm text-muted-foreground text-center font-medium">
                  Zero systemic anomalies detected.
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section variants={fadeUp} className="grid gap-6 xl:grid-cols-2">
        <div className="glass-panel p-8">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
            <Users className="h-4 w-4 text-blue-500" />
            People Coverage
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground mb-6">
            Recognized People
          </h2>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {(people || []).slice(0, 8).map((person) => (
              <div key={person.id} className="rounded-2xl bg-secondary/50 hover:bg-card border border-border p-4 transition-colors">
                <div className="flex flex-col gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-foreground truncate">{person.displayName}</div>
                    <div className="mt-1 text-[10px] uppercase font-bold tracking-widest text-muted-foreground truncate">
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
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel p-8">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            System Verification
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground mb-6">
            Trust Posture
          </h2>
          <div className="space-y-4 text-sm leading-relaxed text-foreground font-medium">
            <div className="rounded-2xl bg-secondary/50 border border-border p-5 shadow-sm flex items-center justify-between">
              <div>
                <span className="font-extrabold text-foreground">{analytics.matchedTaskOwners || 0}</span> / {snapshot.tasks.length} tasks currently map to a workspace person.
              </div>
            </div>
            <div className="rounded-2xl bg-secondary/50 border border-border p-5 shadow-sm flex items-center justify-between">
              <div>
                <span className="font-extrabold text-foreground">{analytics.speakerAttributedMeetings || 0}</span> / {meetings.length} meetings include trustworthy audio speaker isolation.
              </div>
            </div>
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5 text-blue-700 dark:text-blue-400 shadow-sm">
              <span className="font-extrabold">Acoustic Principle:</span> Speaker attribution is never hallucinated. If the system does not concretely isolate a vocal profile, the ledger explicitly omits attribution to prevent false execution routing.
            </div>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}
