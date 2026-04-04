import { useDeferredValue, useMemo, useState } from 'react';
import { ArrowRight, AudioLines, Search, Users, Activity, Filter, Lock } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkspace } from '../components/workspace/useWorkspace';
import PaginationControl from '../components/ui/PaginationControl';

const filterOptions = [
  'All Meetings',
  'Ready',
  'Pending Analysis',
  'Processing',
  'Risks Found',
  'Has Audio',
  'Transcript Ready',
];

const scorePill = {
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

const ITEMS_PER_PAGE = 4;

export default function Meetings() {
  const { snapshot } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => String(searchParams.get('q') || '').trim());
  const [activeFilter, setActiveFilter] = useState(() => sanitizeMeetingFilter(searchParams.get('filter')));
  const [pageRequest, setPageRequest] = useState(1);
  const deferredQuery = useDeferredValue(query);

  const summary = useMemo(() => {
    const total = snapshot.meetings.length;
    const withAudio = snapshot.meetings.filter((meeting) => meeting.audioUrl).length;
    const needsAttention = snapshot.meetings.filter(
      (meeting) => (meeting.meetingRisks?.length || 0) > 0 || Number(meeting.score?.overall || 0) < 75
    ).length;
    const transcriptReady = snapshot.meetings.filter(meetingHasTranscriptText).length;

    return { total, withAudio, needsAttention, transcriptReady };
  }, [snapshot.meetings]);

  const meetings = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return snapshot.meetings.filter((meeting) => {
      const searchableText = [
        meeting.aiTitle,
        meeting.rawTitle,
        meeting.summaryParagraph,
        meeting.participants.join(' '),
        meeting.transcriptText,
        (meeting.tasks || []).map((task) => task?.title).join(' '),
        (meeting.decisions || [])
          .map((decision) => (typeof decision === 'string' ? decision : decision?.text))
          .join(' '),
        (meeting.meetingRisks || []).map((risk) => `${risk?.type || ''} ${risk?.message || ''}`).join(' '),
      ]
        .join(' ')
        .toLowerCase();

      if (normalizedQuery && !searchableText.includes(normalizedQuery)) {
        return false;
      }

      if (activeFilter === 'Ready') return getMeetingLifecycle(meeting) === 'ready';
      if (activeFilter === 'Pending Analysis') return getMeetingLifecycle(meeting) === 'pending-analysis';
      if (activeFilter === 'Processing') return getMeetingLifecycle(meeting) === 'processing';
      if (activeFilter === 'Risks Found') {
        return (meeting.meetingRisks?.length || 0) > 0 || Number(meeting.score?.overall || 0) < 75;
      }
      if (activeFilter === 'Has Audio') return Boolean(meeting.audioUrl);
      if (activeFilter === 'Transcript Ready') return meetingHasTranscriptText(meeting);

      return true;
    });
  }, [activeFilter, deferredQuery, snapshot.meetings]);

  const totalPages = Math.max(1, Math.ceil(meetings.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(pageRequest, totalPages);

  const paginatedMeetings = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return meetings.slice(start, start + ITEMS_PER_PAGE);
  }, [currentPage, meetings]);

  const summaryCards = [
    { label: 'Total Meetings', value: summary.total, meta: 'Meetings captured', filter: 'All Meetings' },
    { label: 'Needs Attention', value: summary.needsAttention, meta: 'Score or risk signals', filter: 'Risks Found' },
    { label: 'Audio Recordings', value: summary.withAudio, meta: 'Files attached', filter: 'Has Audio' },
    { label: 'Transcript Ready', value: summary.transcriptReady, meta: 'Full text stored', filter: 'Transcript Ready' },
  ];

  function syncView({ nextQuery = query, nextFilter = activeFilter } = {}) {
    const params = new URLSearchParams();
    const normalizedQuery = String(nextQuery || '').trim();
    const normalizedFilter = sanitizeMeetingFilter(nextFilter);

    if (normalizedQuery) {
      params.set('q', normalizedQuery);
    }

    if (normalizedFilter !== 'All Meetings') {
      params.set('filter', normalizedFilter);
    }

    setSearchParams(params, { replace: true });
  }

  function handleQueryChange(nextValue) {
    setQuery(nextValue);
    setPageRequest(1);
    syncView({ nextQuery: nextValue });
  }

  function handleFilterChange(nextFilter) {
    const normalizedFilter = sanitizeMeetingFilter(nextFilter);
    setActiveFilter(normalizedFilter);
    setPageRequest(1);
    syncView({ nextFilter: normalizedFilter });
  }

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
              Saved meetings with real drill-downs.
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed font-medium">
              Filter recordings by readiness, risk, transcript coverage, and audio presence without losing your place.
            </p>
          </div>

          <div className="w-full max-w-md relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder="Search meetings, people, tasks, risks, or transcripts..."
              className="w-full bg-card border border-border rounded-2xl py-4 pl-12 pr-4 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all shadow-sm font-medium"
            />
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((card) => (
            <button
              key={card.label}
              type="button"
              onClick={() => handleFilterChange(card.filter)}
              className={`rounded-2xl border p-5 text-left shadow-sm transition-all ${
                activeFilter === card.filter
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border bg-secondary/50 hover:bg-card'
              }`}
            >
              <div className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground mb-3">{card.label}</div>
              <div className="text-3xl font-extrabold text-foreground mb-1">{card.value}</div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-muted-foreground/80">{card.meta}</div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      </motion.section>

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
                type="button"
                onClick={() => handleFilterChange(option)}
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
            Showing <span className="text-foreground">{paginatedMeetings.length}</span> of{' '}
            <span className="text-foreground">{meetings.length}</span> Meetings
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <AnimatePresence>
            {paginatedMeetings.map((meeting) => (
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
                      <div className="text-xs font-semibold text-muted-foreground/80 mt-1 uppercase tracking-widest">
                        {meeting.rawTitle}
                      </div>
                    </div>
                    <div className={`shrink-0 rounded-md border px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold ${scorePill[meeting.score.color]}`}>
                      Score {meeting.score.overall}%
                    </div>
                  </div>

                  <p className="text-muted-foreground leading-relaxed text-sm mb-6 line-clamp-3 font-medium">
                    {meeting.summaryParagraph}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {[
                      {
                        label: `${meeting.tasks.length} Tasks`,
                        color: 'bg-secondary text-secondary-foreground',
                      },
                      {
                        label: `${meeting.decisions.length} Decisions`,
                        color: 'bg-secondary text-secondary-foreground',
                      },
                      {
                        label: `${meeting.meetingRisks.length} Risks`,
                        color: 'bg-red-500/10 text-red-600 dark:text-red-400',
                      },
                    ].map((pill, index) => (
                      <span
                        key={index}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border border-transparent shadow-sm ${pill.color}`}
                      >
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
                      {String(meeting.transcriptText || '').trim()
                        ? 'Transcript text is available for direct review.'
                        : 'Transcript text is still pending for this meeting.'}
                    </span>
                    <ArrowRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 group-hover:text-primary transition-all" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {meetings.length > 0 && totalPages > 1 && (
          <PaginationControl totalPages={totalPages} value={currentPage} onChange={setPageRequest} />
        )}

        {meetings.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel text-center py-24 border-dashed">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground">No Meetings Found</h3>
            <p className="text-muted-foreground text-sm font-medium mt-2 max-w-sm mx-auto">
              Try another filter or upload a fresh recording to populate the library.
            </p>
          </motion.div>
        )}
      </motion.section>
    </motion.div>
  );
}

function sanitizeMeetingFilter(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'process next' || normalized === 'ready') {
    return 'Ready';
  }

  if (normalized === 'pending analysis' || normalized === 'pending-analysis') {
    return 'Pending Analysis';
  }

  if (normalized === 'processing') {
    return 'Processing';
  }

  if (normalized === 'risks found') {
    return 'Risks Found';
  }

  if (normalized === 'has audio') {
    return 'Has Audio';
  }

  if (normalized === 'transcript ready') {
    return 'Transcript Ready';
  }

  return 'All Meetings';
}

function getMeetingLifecycle(meeting) {
  const status = String(meeting?.processingStatus || meeting?.status || '').trim().toLowerCase();

  if (status === 'ready' || status === 'completed') {
    return 'ready';
  }

  if (status === 'processing') {
    return 'processing';
  }

  if (status === 'pending-analysis' || status.startsWith('raw-uploaded:') || status.startsWith('audio-uploaded:')) {
    return 'pending-analysis';
  }

  if (meetingHasTranscriptText(meeting)) {
    return 'ready';
  }

  return 'unknown';
}

function meetingHasTranscriptText(meeting) {
  if (String(meeting?.transcriptText || '').trim()) {
    return true;
  }

  return Array.isArray(meeting?.transcript)
    && meeting.transcript.some((segment) => String(segment?.text || '').trim());
}
