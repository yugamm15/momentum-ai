import { useDeferredValue, useMemo, useState } from 'react';
import { ArrowRight, AudioLines, Search, Users, Activity, Filter, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkspace } from '../components/workspace/useWorkspace';

const filterOptions = ['All Meetings', 'Process Next', 'Risks Found', 'Has Audio'];
const scorePill = {
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
};

export default function Meetings() {
  const { snapshot } = useWorkspace();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All Variants');
  const deferredQuery = useDeferredValue(query);

  const summary = useMemo(() => {
    const total = snapshot.meetings.length;
    const withAudio = snapshot.meetings.filter((meeting) => meeting.audioUrl).length;
    const needsAttention = snapshot.meetings.filter(
      (meeting) => (meeting.meetingRisks?.length || 0) > 0 || Number(meeting.score?.overall || 0) < 75
    ).length;
    const speakerAttributed = snapshot.meetings.filter(
      (meeting) => meeting.transcriptAttribution === 'speaker-attributed'
    ).length;

    return { total, withAudio, needsAttention, speakerAttributed };
  }, [snapshot.meetings]);

  const meetings = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return snapshot.meetings.filter((meeting) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          meeting.aiTitle,
          meeting.rawTitle,
          meeting.summaryParagraph,
          meeting.participants.join(' '),
          meeting.transcriptText,
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);

      if (!matchesQuery) return false;

      if (activeFilter === 'Process Next') return meeting.processingStatus === 'ready';
      if (activeFilter === 'Risks Found') return (meeting.meetingRisks?.length || 0) > 0 || Number(meeting.score?.overall || 0) < 75;
      if (activeFilter === 'Has Audio') return Boolean(meeting.audioUrl);

      return true;
    });
  }, [activeFilter, deferredQuery, snapshot.meetings]);

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
      className="p-6 md:p-8 xl:p-12 max-w-[1600px] mx-auto space-y-8"
    >
      <motion.section variants={fadeUp} className="glass-panel p-8 md:p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] dark:opacity-5 pointer-events-none text-foreground">
          <Lock className="w-64 h-64" />
        </div>
        
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-end justify-between gap-8 mb-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-primary/10 border border-primary/20 text-[10px] uppercase font-bold text-primary tracking-widest shadow-sm">
              <Activity className="w-3 h-3" />
              Meeting Library
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground mb-4">
              Your securely stored meetings and strategic decisions.
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed font-medium">
              Find past recordings quickly with transcripts and extracted action items.
            </p>
          </div>

          <div className="w-full max-w-md relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search meetings, people, or transcripts..."
              className="w-full bg-card border border-border rounded-2xl py-4 pl-12 pr-4 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all shadow-sm font-medium"
            />
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Meetings', value: summary.total, meta: 'Meetings captured' },
            { label: 'Meetings to check', value: summary.needsAttention, meta: 'System noted anomalies' },
            { label: 'Audio Recordings', value: summary.withAudio, meta: 'Files attached' },
            { label: 'Recognized Voices', value: summary.speakerAttributed, meta: 'Named speakers recorded' },
          ].map((item, idx) => (
            <div key={idx} className="bg-secondary/50 border border-border rounded-2xl p-5 hover:bg-card transition-colors shadow-sm">
              <div className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground mb-3">{item.label}</div>
              <div className="text-3xl font-extrabold text-foreground mb-1">{item.value}</div>
              <div className="text-xs font-semibold text-muted-foreground/80">{item.meta}</div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Constraints & Grid */}
      <motion.section variants={fadeUp} className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-panel py-3 px-4">
          <div className="flex items-center gap-2 w-full overflow-x-auto snap-x pb-2 sm:pb-0 scrollbar-hide">
            <div className="flex shrink-0 items-center gap-2 pr-4 border-r border-border text-muted-foreground">
              <Filter className="w-4 h-4" />
              <span className="text-[10px] uppercase tracking-widest font-bold">Filter</span>
            </div>
            {filterOptions.map((option) => (
              <button
                key={option}
                onClick={() => setActiveFilter(option)}
                className={`shrink-0 snap-start px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                  activeFilter === option
                    ? 'bg-foreground text-background shadow-md'
                    : 'bg-secondary text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-sm'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="shrink-0 text-xs text-muted-foreground uppercase tracking-widest font-bold pr-2">
            Showing <span className="text-foreground">{meetings.length}</span> Meetings
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <AnimatePresence>
            {meetings.map((meeting) => (
              <motion.div
                key={meeting.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4 }}
              >
                <Link
                  to={`/dashboard/meetings/${meeting.id}`}
                  className="block glass-panel p-6 h-full group hover:border-primary/20 transition-all duration-300 relative overflow-hidden"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand-gradient opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                    <div>
                      <div className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground mb-2 bg-muted inline-block px-2 py-1 rounded">
                        {meeting.timeLabel}
                      </div>
                      <h2 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors tracking-tight">
                        {meeting.aiTitle}
                      </h2>
                      <div className="text-xs font-semibold text-muted-foreground/80 mt-1 uppercase tracking-widest">{meeting.rawTitle}</div>
                    </div>
                    <div className={`shrink-0 rounded-md border px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold ${scorePill[meeting.score.color]}`}>
                      Score {meeting.score.overall}%
                    </div>
                  </div>

                  <p className="text-muted-foreground leading-relaxed text-sm mb-6 line-clamp-3 font-medium">
                    {meeting.summaryParagraph}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {[{
                      label: `${meeting.tasks.length} Tasks`,
                      color: 'bg-secondary text-secondary-foreground'
                    }, {
                      label: `${meeting.decisions.length} Decisions`,
                      color: 'bg-secondary text-secondary-foreground'
                    }, {
                      label: `${meeting.meetingRisks.length} Risks`,
                      color: 'bg-red-500/10 text-red-600 dark:text-red-400'
                    }].map((pill, i) => (
                      <span key={i} className={`px-2.5 py-1 text-xs font-bold rounded-lg border border-transparent shadow-sm ${pill.color}`}>
                        {pill.label}
                      </span>
                    ))}
                    
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm">
                      <Users className="w-3.5 h-3.5" />
                      {meeting.participants.length || 0} People
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-sm">
                      <AudioLines className="w-3.5 h-3.5" />
                      {meeting.audioUrl ? 'Audio Recording' : 'Text Only'}
                    </span>
                  </div>

                  <div className="bg-secondary rounded-xl p-3 border border-border text-xs font-medium text-muted-foreground flex items-center justify-between mt-auto shadow-sm group-hover:bg-card transition-colors">
                    <span>
                      {meeting.transcriptAttribution === 'speaker-attributed'
                        ? 'Speaker identities recognized automatically.'
                        : 'Some speakers need your manual review.'}
                    </span>
                    <ArrowRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 group-hover:text-primary transition-all" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {meetings.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel text-center py-24 border-dashed">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
               <Lock className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground">No Meetings Found</h3>
            <p className="text-muted-foreground text-sm font-medium mt-2 max-w-sm mx-auto">
              Try changing your search to find more meetings.
            </p>
          </motion.div>
        )}
      </motion.section>
    </motion.div>
  );
}
