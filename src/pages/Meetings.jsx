import { useDeferredValue, useMemo, useState } from 'react';
import { ArrowRight, Search, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../components/workspace/useWorkspace';

const filterOptions = ['All', 'High score', 'Needs attention'];
const scorePill = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function Meetings() {
  const { snapshot } = useWorkspace();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const deferredQuery = useDeferredValue(query);

  const summary = useMemo(() => {
    const total = snapshot.meetings.length;
    const needsAttention = snapshot.meetings.filter(
      (meeting) => (meeting.meetingRisks?.length || 0) > 0 || Number(meeting.score?.overall || 0) < 75
    ).length;
    const averageScore =
      total > 0
        ? Math.round(
            snapshot.meetings.reduce((sum, meeting) => sum + Number(meeting.score?.overall || 0), 0) / total
          )
        : 0;

    return { total, needsAttention, averageScore };
  }, [snapshot.meetings]);

  const meetings = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return snapshot.meetings.filter((meeting) => {
      const matchesQuery =
        !normalizedQuery ||
        [meeting.aiTitle, meeting.rawTitle, meeting.summaryParagraph, meeting.participants.join(' ')]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);

      if (!matchesQuery) {
        return false;
      }

      if (activeFilter === 'High score') {
        return Number(meeting.score?.overall || 0) >= 80;
      }

      if (activeFilter === 'Needs attention') {
        return (meeting.meetingRisks?.length || 0) > 0 || Number(meeting.score?.overall || 0) < 75;
      }

      return true;
    });
  }, [activeFilter, deferredQuery, snapshot.meetings]);

  return (
    <div className="space-y-6">
      <section className="momentum-card momentum-spotlight p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="momentum-pill-accent">Meeting vault</div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Browse meetings by outcome, not by transcript dump.
            </h1>
            <p className="mt-4 text-base leading-8 text-slate-600">
              The list is designed to answer the important questions quickly: which meetings produced real action, which ones still feel risky, and where you should click next.
            </p>
          </div>

          <div className="momentum-input-shell w-full max-w-md">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search meetings, participants, or summary text"
            />
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            { label: 'Meetings visible', value: summary.total, meta: 'Live plus seeded history' },
            { label: 'Need attention', value: summary.needsAttention, meta: 'Risky or low-score meetings' },
            { label: 'Average score', value: summary.averageScore, meta: 'Execution quality baseline' },
          ].map((item) => (
            <div key={item.label} className="momentum-card-soft p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {item.label}
              </div>
              <div className="momentum-number mt-3 text-3xl font-semibold text-slate-950">
                {item.value}
              </div>
              <div className="mt-2 text-sm text-slate-500">{item.meta}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setActiveFilter(option)}
                className={
                  activeFilter === option
                    ? 'rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white'
                    : 'rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900'
                }
              >
                {option}
              </button>
            ))}
          </div>
          <div className="text-sm text-slate-500">
            Showing <span className="font-semibold text-slate-900">{meetings.length}</span> meeting{meetings.length === 1 ? '' : 's'}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {meetings.map((meeting) => (
          <Link
            key={meeting.id}
            to={`/dashboard/meetings/${meeting.id}`}
            className="momentum-card block p-6 transition hover:-translate-y-0.5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {meeting.timeLabel}
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {meeting.aiTitle}
                </h2>
                <div className="mt-2 text-sm text-slate-500">{meeting.rawTitle}</div>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${scorePill[meeting.score.color]}`}>
                Score {meeting.score.overall}
              </div>
            </div>

            <p className="mt-5 text-sm leading-7 text-slate-600">{meeting.summaryParagraph}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="momentum-pill">{meeting.tasks.length} tasks</span>
              <span className="momentum-pill">{meeting.decisions.length} decisions</span>
              <span className="momentum-pill">{meeting.meetingRisks.length} risks</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                <Users className="h-3.5 w-3.5" />
                {meeting.participants.length}
              </span>
            </div>

            <div className="mt-6 flex items-center justify-between text-sm">
              <div className="text-slate-500">{meeting.source}</div>
              <div className="inline-flex items-center gap-2 font-semibold text-slate-900">
                Open detail
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </Link>
        ))}
      </section>

      {meetings.length === 0 ? (
        <div className="momentum-card p-8 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">No meetings match this view</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Try clearing the search or switching filters to bring the vault back into focus.
          </p>
        </div>
      ) : null}
    </div>
  );
}
