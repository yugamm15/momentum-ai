import {
  ArrowRight,
  AudioLines,
  CheckCircle2,
  Layers3,
  Sparkles,
  Target,
  Waves,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const featureCards = [
  {
    title: 'Recordings with consequence',
    body: 'Momentum starts from the meeting audio, not from a decorative summary card. Playback, transcript, and extracted actions stay tied together.',
    icon: AudioLines,
  },
  {
    title: 'People and ownership first',
    body: 'Task routing becomes more trustworthy when participant names, workspace people, and review states live in the same surface.',
    icon: Target,
  },
  {
    title: 'Evidence stays visible',
    body: 'Decisions, tasks, risk flags, and transcript excerpts all remain one click away from the source meeting.',
    icon: CheckCircle2,
  },
  {
    title: 'Real workspace posture',
    body: 'The dashboard is built for live records, not for seeded demos. Every major surface expects actual meeting data to flow through it.',
    icon: Layers3,
  },
];

export default function Landing({ session }) {
  return (
    <div className="min-h-screen px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <nav className="momentum-card px-6 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="inline-flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-gradient-to-br from-teal-300 via-cyan-300 to-sky-400 text-lg font-black text-slate-950 shadow-[0_18px_45px_rgba(45,212,191,0.24)]">
                M
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-700">
                  Momentum
                </div>
                <div className="text-lg font-semibold tracking-tight text-slate-950">
                  Meeting execution intelligence
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link to="/login" className="momentum-button-secondary">
                Sign in
              </Link>
              <Link to={session ? '/dashboard' : '/login'} className="momentum-button-primary">
                {session ? 'Open workspace' : 'Enter Momentum'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </nav>

        <main className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="momentum-card momentum-spotlight p-8 lg:p-10">
            <div className="momentum-pill-accent">
              <Sparkles className="h-4 w-4" />
              Web-first workspace
            </div>

            <h1 className="mt-6 max-w-5xl text-5xl font-semibold tracking-tight text-slate-950 lg:text-7xl">
              Meetings should leave behind more than notes.
              <span className="mt-2 block text-teal-700">They should leave behind accountable motion.</span>
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
              Momentum captures the recording after explicit start, turns it into structured execution context, and keeps the evidence accessible enough for a team to correct what the AI got wrong.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={session ? '/dashboard' : '/login'} className="momentum-button-primary">
                {session ? 'Go to workspace' : 'Access the product'}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/dashboard" className="momentum-button-secondary">
                Open the live workspace
              </Link>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                { label: 'Core artifact', value: 'Recording + transcript' },
                { label: 'Decision lens', value: 'Ownership + risk' },
                { label: 'System promise', value: 'Evidence over theater' },
              ].map((stat) => (
                <div key={stat.label} className="momentum-card-soft p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {stat.label}
                  </div>
                  <div className="momentum-number mt-3 text-2xl font-semibold text-slate-950">
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <div className="momentum-dark-panel p-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/20 bg-teal-200/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-100">
                <Waves className="h-4 w-4" />
                Product loop
              </div>

              <div className="mt-6 space-y-4">
                {[
                  'Start recording only after consent from inside the meeting flow.',
                  'Store the recording, transcript it, and extract decisions, tasks, and execution risk.',
                  'Map visible participants and task owners into a workspace people pool when names line up cleanly.',
                  'Review the meeting with playback, transcript, people, and tasks in one continuous surface.',
                ].map((step, index) => (
                  <div key={step} className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                    <div className="flex gap-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-teal-200/15 text-sm font-semibold text-teal-100">
                        {index + 1}
                      </div>
                      <div className="text-sm leading-6 text-slate-200">{step}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {featureCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.title} className="momentum-card p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-teal-50 text-teal-700">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                        {card.title}
                      </h2>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-slate-600">{card.body}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
