import {
  ArrowRight,
  AudioLines,
  ChevronRight,
  Columns3,
  FileText,
  Target,
  Users,
  Activity,
  Globe
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useWorkspace } from '../components/workspace/useWorkspace';

const scoreColors = {
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const fadeUp = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
};

function meetingHasTranscriptText(meeting) {
  if (String(meeting?.transcriptText || '').trim()) {
    return true;
  }

  return Array.isArray(meeting?.transcript)
    && meeting.transcript.some((segment) => String(segment?.text || '').trim());
}

export default function DashboardHome() {
  const { snapshot, loading } = useWorkspace();
  const { analytics, meetings, tasks, people } = snapshot;
  const recentMeetings = meetings.slice(0, 4);
  const reviewQueue = tasks.filter((task) => task.needsReview).slice(0, 4);
  const activePeople = people.slice(0, 4);
  const transcriptReadyMeetings = meetings.filter(meetingHasTranscriptText).length;

  const metrics = analytics.metrics || [];

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="p-4 md:p-6 xl:p-8 space-y-6 max-w-[1600px] mx-auto min-h-full"
    >
      {/* Header Context */}
      <motion.header variants={fadeUp} className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-primary/10 border border-primary/20 text-[10px] uppercase font-bold text-primary tracking-widest shadow-sm">
            <Activity className="w-3 h-3" />
            Live Overview
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-2">
            Dashboard
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl font-medium">
            A real-time look at your meetings, open tasks, and active people across the workspace.
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/dashboard/tasks" className="button-secondary">
            View Tasks
          </Link>
          <Link to="/dashboard/meetings" className="button-primary group">
            <span>Meeting Library</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </motion.header>

      {/* Primary Telemetry */}
      <motion.section variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Meetings Processed', val: metrics[0]?.value || '0', meta: 'Total meetings saved', icon: Globe },
          { label: 'People Tracked', val: String(analytics.peopleTracked || people.length || 0), meta: 'Active participants', icon: Users },
          { label: 'Transcript Ready', val: String(transcriptReadyMeetings), meta: 'Meetings with full text', icon: FileText },
          { label: 'Meeting Debt', val: String(analytics.meetingDebt || '0'), meta: 'Open actionable tasks', icon: Target },
        ].map((stat, i) => (
          <motion.div variants={fadeUp} key={i} className="glass-panel p-6 group relative">
            <div className={`absolute top-0 right-0 p-4 opacity-[0.04] dark:opacity-10 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3 text-foreground`}>
              <stat.icon className="w-20 h-20" />
            </div>
            <div className="relative z-10">
              <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-3">{stat.label}</div>
              <div className="text-4xl lg:text-5xl font-extrabold text-foreground mb-2 tracking-tighter">{stat.val}</div>
              <div className="text-xs font-semibold text-muted-foreground/80">{stat.meta}</div>
            </div>
          </motion.div>
        ))}
      </motion.section>

      {/* Main Grid Split */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6 -mt-2">
        
        {/* Left Column: Recent Audio Logic */}
        <motion.div variants={staggerContainer} className="space-y-4">
          <motion.div variants={fadeUp} className="flex justify-between items-end mb-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Recent Meetings</h2>
              <p className="text-sm font-medium text-muted-foreground mt-1">The latest meetings recorded and processed.</p>
            </div>
            <Link to="/dashboard/meetings" className="text-sm font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-widest">
              View All →
            </Link>
          </motion.div>

          <div className="space-y-4">
            {recentMeetings.map((meeting) => (
              <motion.div variants={fadeUp} key={meeting.id}>
                <Link to={`/dashboard/meetings/${meeting.id}`} className="block glass-panel p-6 group hover:border-primary/30 relative overflow-hidden transition-all duration-300">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand-gradient opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <span className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground bg-muted px-2 py-1 rounded">
                          {meeting.timeLabel}
                        </span>
                        <div className={`rounded-md border px-2 py-1 text-[10px] uppercase font-bold tracking-widest ${scoreColors[meeting.score.color]}`}>
                          Score: {meeting.score.overall}
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-foreground truncate group-hover:text-primary transition-colors tracking-tight">
                        {meeting.aiTitle}
                      </h3>
                      <p className="mt-2 text-sm font-medium text-muted-foreground leading-relaxed line-clamp-2 pr-4">
                        {meeting.summaryParagraph}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs font-semibold text-secondary-foreground shadow-sm">
                      <Columns3 className="w-3.5 h-3.5 opacity-70" /> {meeting.tasks.length} Tasks
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs font-semibold text-secondary-foreground shadow-sm">
                      <Users className="w-3.5 h-3.5 opacity-70" /> {meeting.participants.length} People
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}

            {recentMeetings.length === 0 && !loading && (
              <div className="p-12 text-center glass-panel border-dashed border-border flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <AudioLines className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold text-foreground">No Meetings Yet</h3>
                <p className="text-muted-foreground font-medium text-sm mt-1">Upload an audio recording to see it here.</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Right Column: Execution Debt & Identities */}
        <motion.div variants={staggerContainer} className="space-y-6">
          {/* Action Required */}
          <motion.div variants={fadeUp} className="glass-panel p-6 border-amber-500/20 bg-amber-50 dark:bg-amber-500/[0.02]">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center justify-center shadow-sm">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground tracking-tight">Needs Review</h3>
                <p className="text-[10px] font-bold text-amber-600/70 dark:text-amber-500/70 uppercase tracking-widest mt-1">Check these tasks</p>
              </div>
            </div>

            <div className="space-y-3">
              {reviewQueue.map((task) => (
                <div key={task.id} className="p-4 rounded-2xl bg-background/50 border border-border/50 hover:bg-background transition-colors shadow-sm">
                  <div className="font-bold text-foreground text-sm truncate">{task.title}</div>
                  <div className="text-[11px] font-medium text-muted-foreground mt-1 truncate">{task.sourceMeeting}</div>
                </div>
              ))}

              {reviewQueue.length === 0 && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold text-sm text-center">
                  All tasks look clean. No immediate review needed.
                </div>
              )}
            </div>
            
            <div className="mt-6 pt-5 border-t border-border/50 flex justify-between gap-4">
              <div className="flex-1">
                <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1 tracking-widest">Unassigned Tasks</div>
                <div className="text-3xl font-extrabold text-foreground">{analytics.unassignedTasks}</div>
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1 tracking-widest">Time Lapsed</div>
                <div className="text-3xl font-extrabold text-foreground">{analytics.missingDeadlines}</div>
              </div>
            </div>
          </motion.div>

          {/* Identity Pool */}
          <motion.div variants={fadeUp} className="glass-panel p-6">
            <div className="flex justify-between items-center mb-6">
               <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground tracking-tight">People Overview</h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Active Members</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {activePeople.map((person) => (
                <div key={person.id} className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-secondary/50 border border-transparent hover:border-border transition-colors">
                  <div className="min-w-0">
                    <div className="font-bold text-foreground text-sm truncate">{person.displayName}</div>
                    <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mt-1 truncate">
                      {person.isWorkspaceMember ? person.email || 'Native' : 'External'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 rounded-lg bg-background text-[11px] font-bold text-foreground shadow-sm">
                      {person.ownedTaskCount} Tasks
                    </span>
                  </div>
                </div>
              ))}

              {activePeople.length === 0 && (
                <div className="text-center p-6 text-sm font-medium text-muted-foreground bg-secondary/50 rounded-2xl border border-dashed border-border">
                  No people found in meetings yet.
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>

      </div>
    </motion.div>
  );
}
