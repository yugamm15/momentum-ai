import {
  ArrowRight,
  CheckCircle2,
  Layers3,
  Sparkles,
  Target,
  Waves,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const featureCards = [
  {
    title: 'Execution-first AI',
    body: 'Momentum does not stop at transcripts. It extracts tasks, decisions, and accountability gaps that a team can immediately work on.',
    icon: Target,
  },
  {
    title: 'Evidence over guessing',
    body: 'The product becomes trustworthy when important outputs stay tied to transcript evidence and remain easy to correct.',
    icon: CheckCircle2,
  },
  {
    title: 'Real SaaS posture',
    body: 'Dashboard, meeting vault, task board, analytics, and settings make the experience feel investable, not like a single hack.',
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
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-gradient-to-br from-sky-300 via-sky-400 to-blue-500 text-lg font-black text-slate-950 shadow-[0_18px_45px_rgba(56,189,248,0.24)]">
                M
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700">
                  Momentum AI
                </div>
                <div className="text-lg font-semibold tracking-tight text-slate-950">
                  Meeting execution intelligence
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link to="/login" className="momentum-button-secondary">
                Log in
              </Link>
              <Link to={session ? '/dashboard' : '/login'} className="momentum-button-primary">
                {session ? 'Open workspace' : 'Start with Momentum'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </nav>

        <main className="mt-8 grid gap-8 lg:grid-cols-[1.18fr_0.82fr]">
          <section className="momentum-card momentum-spotlight p-8 lg:p-10">
            <div className="momentum-pill-accent">
              <Sparkles className="h-4 w-4" />
              Google Meet first
            </div>

            <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-slate-950 lg:text-7xl">
              Other tools summarize meetings.
              <span className="mt-2 block text-sky-700">Momentum turns them into execution.</span>
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
              Record only after consent, transcribe with a dedicated speech model, extract accountable work with AI, and surface the ambiguity that slows teams down.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={session ? '/dashboard' : '/login'} className="momentum-button-primary">
                {session ? 'Go to workspace' : 'Enter the product'}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/dashboard" className="momentum-button-secondary">
                Open the workspace
              </Link>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                { label: 'Processing story', value: 'Upload to ready' },
                { label: 'AI stack', value: 'Whisper + Gemini' },
                { label: 'North star', value: 'Meeting debt down' },
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
            <div className="momentum-dark-panel momentum-spotlight p-8">
              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100">
                  <Waves className="h-4 w-4" />
                  Signature flow
                </div>

                <div className="mt-6 space-y-4">
                  {[
                    'Join a Google Meet and activate Momentum after explicit consent.',
                    'Upload the audio, transcribe it, and extract accountable execution signals.',
                    'Reveal title, decisions, tasks, checklist, risk flags, and score in one view.',
                    'Correct one AI miss live and show the task board updating across the workspace.',
                  ].map((step, index) => (
                    <div key={step} className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                      <div className="flex gap-4">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-sky-300/20 text-sm font-semibold text-sky-100">
                          {index + 1}
                        </div>
                        <div className="text-sm leading-6 text-slate-200">{step}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              {featureCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.title} className="momentum-card p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-sky-50 text-sky-700">
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
