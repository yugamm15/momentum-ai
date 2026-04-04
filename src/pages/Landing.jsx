import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import MomentumLogo from '../components/MomentumLogo';

const memoryEvents = [
  {
    label: 'Resurfaced commitment',
    title: 'Pricing deck came back again',
    detail: 'It was left open in the last staff sync and surfaced again this week.',
  },
  {
    label: 'Owner changed',
    title: 'Vendor outreach moved from Arjun to Neha',
    detail: 'Momentum keeps the change visible instead of letting it disappear in notes.',
  },
  {
    label: 'Timeline shifted',
    title: 'Launch review moved from Friday to next Tuesday',
    detail: 'The record shows exactly when the deadline changed and what replaced it.',
  },
  {
    label: 'Needs proof',
    title: 'Decision still unclear',
    detail: 'The transcript does not support a strong decision yet, so it stays in review.',
  },
];

const proofRows = [
  {
    eyebrow: 'What was promised',
    title: 'Carry commitments forward instead of starting from zero every time.',
    body: 'Momentum pulls the last related meeting into the next one so repeating work is obvious the second it resurfaces.',
  },
  {
    eyebrow: 'What changed',
    title: 'Owner shifts and deadline movement become first-class signals.',
    body: 'The product highlights when a commitment changed hands or moved in time, so teams can see drift before it becomes delay.',
  },
  {
    eyebrow: 'What still lacks proof',
    title: 'Answers come with transcript evidence or they stay cautious.',
    body: 'Search the record, inspect the exact wording, and keep weak signals visible until a human resolves them.',
  },
];

const workflow = [
  {
    title: 'Capture the meeting',
    body: 'Audio or transcript lands in the workspace as a real record, not an ephemeral chat artifact.',
    icon: Workflow,
  },
  {
    title: 'Extract follow-ups with evidence',
    body: 'Tasks, decisions, and risk flags stay grounded in transcript snippets and source audio.',
    icon: Search,
  },
  {
    title: 'Review ambiguity fast',
    body: 'Missing owner, vague wording, and low-confidence passages stay in one focused review lane.',
    icon: AlertTriangle,
  },
  {
    title: 'Walk into the next meeting prepared',
    body: 'Momentum shows what resurfaced, what changed, and what still needs a decision before the room moves on.',
    icon: CalendarClock,
  },
];

export default function Landing({ session }) {
  const [showIntro, setShowIntro] = useState(true);
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.4], [1, 0.92]);

  useEffect(() => {
    const hideTimer = window.setTimeout(() => {
      setShowIntro(false);
    }, 2400);

    return () => window.clearTimeout(hideTimer);
  }, []);

  return (
    <div ref={containerRef} className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(13,110,253,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.1),transparent_28%),radial-gradient(circle_at_50%_24%,rgba(255,255,255,0.7),transparent_52%)]" />
        <div className="absolute inset-0 cinematic-grid opacity-[0.035]" />
        <motion.div
          animate={{ x: [0, 24, -10, 0], y: [0, -18, 12, 0], scale: [1, 1.06, 0.98, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -left-20 top-24 h-72 w-72 rounded-full bg-primary/10 blur-[90px]"
        />
        <motion.div
          animate={{ x: [0, -32, 14, 0], y: [0, 20, -14, 0], scale: [1, 0.96, 1.08, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 2.5 }}
          className="absolute bottom-16 right-0 h-80 w-80 rounded-full bg-amber-400/10 blur-[100px]"
        />
      </div>

      <AnimatePresence>
        {showIntro ? (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-background/88 backdrop-blur-md"
          >
            <div className="relative h-[180px] w-[min(88vw,760px)]">
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: [0, 0.35, 0], scale: [0.85, 1.05, 1.2] }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-3xl"
              />

              <motion.div
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: [0, 1, 1] }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
                className="absolute left-0 right-0 top-1/2 h-[2px] origin-center bg-gradient-to-r from-transparent via-primary to-transparent"
              />

              <motion.div
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: [0, 0.8, 0] }}
                transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1], delay: 0.75 }}
                className="absolute left-1/2 top-[18%] bottom-[18%] w-[2px] -translate-x-1/2 origin-top bg-gradient-to-b from-transparent via-primary/80 to-transparent"
              />

              <motion.div
                initial={{ left: '6%', opacity: 0 }}
                animate={{ left: '94%', opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.25, ease: 'easeInOut', delay: 0.5 }}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-primary shadow-[0_0_20px_rgba(0,102,255,0.8)]"
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <nav className="fixed left-0 right-0 top-0 z-40 bg-background/72 backdrop-blur-2xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-3">
            <MomentumLogo className="h-8 w-8" />
            <div>
              <div className="text-sm font-black uppercase tracking-[0.24em] text-foreground">Momentum</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Accountability Memory
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <a href="#proof" className="hidden text-sm font-semibold text-muted-foreground transition hover:text-foreground md:inline-flex">
              Why it is different
            </a>
            <Link to={session ? '/dashboard' : '/login'} className="button-primary px-6 py-2.5 text-sm">
              {session ? 'Open workspace' : 'Get access'}
            </Link>
          </div>
        </div>
        <div className="mx-auto h-px max-w-7xl bg-gradient-to-r from-transparent via-foreground/8 to-transparent" />
      </nav>

      <main className="relative z-10 pt-20">
        <motion.section
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative overflow-hidden px-6 pb-24 pt-8 lg:px-10 xl:px-16"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-4xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-foreground shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                The accountability memory for recurring meetings
              </div>

              <h1 className="mt-8 text-5xl font-black tracking-[-0.06em] text-foreground sm:text-6xl md:text-7xl">
                Keep the commitments your meetings keep losing.
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
                Momentum does not stop at summary. It shows what was promised, what changed since the last related
                meeting, and what still lacks enough proof to trust.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link to={session ? '/dashboard' : '/login'} className="button-primary h-14 px-8 text-base">
                  {session ? 'Enter the workspace' : 'Get the workspace'}
                </Link>
                <a href="#proof" className="button-secondary h-14 px-8 text-base group">
                  See the proof flow
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              </div>
            </div>

            <div className="mt-16 grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
              <div className="relative overflow-hidden rounded-[40px] bg-[linear-gradient(145deg,rgba(255,255,255,0.78),rgba(255,255,255,0.38))] p-7 shadow-[0_24px_80px_rgba(15,23,42,0.06)] backdrop-blur-xl lg:p-8">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(13,110,253,0.1),transparent_24%),radial-gradient(circle_at_84%_82%,rgba(245,158,11,0.08),transparent_22%)]" />
                <div className="relative">
                  <div className="max-w-md">
                    <div className="text-[10px] font-black uppercase tracking-[0.26em] text-primary">Live memory rail</div>
                    <h2 className="mt-3 text-3xl font-black tracking-tight text-foreground">
                      The second meeting should know what the first one already promised.
                    </h2>
                  </div>

                  <div className="mt-8 grid gap-4">
                    {memoryEvents.map((event, index) => (
                      <motion.div
                        key={event.title}
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.12 * index, ease: [0.22, 1, 0.36, 1] }}
                        className={`rounded-[28px] bg-white/88 px-5 py-5 shadow-sm ${index === 1 ? 'ml-8' : ''} ${index === 2 ? 'mr-6' : ''}`}
                      >
                        <div className="mb-3 inline-flex rounded-full bg-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                          {event.label}
                        </div>
                        <div className="text-xl font-black tracking-tight text-foreground">{event.title}</div>
                        <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{event.detail}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                {[
                  'Every follow-up stays tied to source wording.',
                  'Recurring meetings gain a visible memory layer.',
                  'Weak evidence stays in review instead of pretending certainty.',
                ].map((line) => (
                  <div key={line} className="rounded-[32px] bg-card/72 px-5 py-5 shadow-sm backdrop-blur-md">
                    <div className="flex items-start gap-3 text-sm leading-6 text-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{line}</span>
                    </div>
                  </div>
                ))}

                <div className="rounded-[32px] bg-[linear-gradient(135deg,rgba(13,110,253,0.96),rgba(37,99,235,0.86))] px-6 py-7 text-white shadow-[0_24px_70px_rgba(13,110,253,0.2)]">
                  <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/70">What actually matters</div>
                  <p className="mt-3 text-lg font-semibold leading-8">
                    Show what changed, show the proof, and make the next meeting start from the right place.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <section id="proof" className="px-6 py-20 lg:px-10 xl:px-16">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <div className="text-[10px] font-black uppercase tracking-[0.26em] text-primary">Why it is different</div>
              <h2 className="mt-4 text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                The product is only valuable if it can prove what changed.
              </h2>
            </div>

            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {proofRows.map((row, index) => (
                <motion.div
                  key={row.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.6, delay: index * 0.06 }}
                  className="rounded-[34px] bg-card/72 px-6 py-7 shadow-[0_20px_60px_rgba(15,23,42,0.05)] backdrop-blur-md"
                >
                  <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
                    {row.eyebrow}
                  </div>
                  <div>
                    <h3 className="mt-3 text-2xl font-black tracking-tight text-foreground">{row.title}</h3>
                    <p className="mt-3 max-w-2xl text-base leading-8 text-muted-foreground">{row.body}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-16 lg:px-10 xl:px-16">
          <div className="mx-auto max-w-7xl rounded-[42px] bg-[linear-gradient(145deg,rgba(255,255,255,0.78),rgba(255,255,255,0.38))] px-7 py-8 shadow-[0_28px_90px_rgba(15,23,42,0.07)] backdrop-blur-xl lg:px-10 lg:py-10">
            <div className="max-w-2xl">
              <div className="text-[10px] font-black uppercase tracking-[0.26em] text-primary">Operating model</div>
              <h2 className="mt-4 text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                Proof, review, memory, then the next meeting brief.
              </h2>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-4">
              {workflow.map((step, index) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.55, delay: index * 0.08 }}
                  className="rounded-[30px] bg-background/78 px-5 py-6 shadow-sm"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card text-foreground shadow-sm">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <div className="mt-5 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">Step {index + 1}</div>
                  <h3 className="mt-3 text-xl font-black tracking-tight text-foreground">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 pb-24 pt-16 lg:px-10 xl:px-16">
          <div className="mx-auto max-w-6xl rounded-[42px] bg-[linear-gradient(135deg,rgba(13,110,253,0.95),rgba(37,99,235,0.84))] px-8 py-14 text-center text-white shadow-[0_35px_110px_rgba(13,110,253,0.28)]">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/90">
              <ShieldCheck className="h-3.5 w-3.5" />
              Built for teams that run recurring meetings
            </div>
            <h2 className="mx-auto mt-8 max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">
              Stop losing the thread between one meeting and the next.
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/78">
              Let the workspace keep the promises, changes, and proof in view so the next meeting starts where the last
              one actually ended.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to={session ? '/dashboard' : '/login'} className="rounded-full bg-white px-9 py-4 text-base font-semibold text-slate-950 shadow-sm transition hover:bg-slate-100">
                {session ? 'Open Momentum' : 'Get access'}
              </Link>
              <a href="#proof" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-9 py-4 text-base font-semibold text-white/92 transition hover:bg-white/8">
                Proof flow
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-6 py-10 lg:px-10 xl:px-16">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-black uppercase tracking-[0.22em] text-foreground">Momentum</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Meetings become visible commitments, proof, and continuity.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-sm font-semibold text-muted-foreground">
            <a href="#proof" className="transition hover:text-foreground">
              Proof flow
            </a>
            <Link to={session ? '/dashboard' : '/login'} className="inline-flex items-center gap-2 transition hover:text-foreground">
              Workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
