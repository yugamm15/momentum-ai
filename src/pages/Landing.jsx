import {
  ArrowRight,
  AudioLines,
  CheckCircle2,
  ChevronRight,
  Command,
  Database,
  Layers3,
  Mic,
  PlayCircle,
  Sparkles,
  Target,
  Waves,
  Workflow
} from 'lucide-react';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import MomentumLogo from '../components/MomentumLogo';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};

const featureCards = [
  {
    title: 'Smart Audio Processing',
    body: 'Moméntum securely captures and processes your calls and turns them into tasks.',
    icon: AudioLines,
  },
  {
    title: 'Automatic Assignments',
    body: 'Assigns tasks securely and easily to people from your workspace automatically.',
    icon: Target,
  },
  {
    title: 'Reliable Information Ledger',
    body: 'Keep an accurate history of your calls and tasks over time easily.',
    icon: CheckCircle2,
  },
  {
    title: 'Live Workspace Design',
    body: 'Built for teams solving real problems in real time with high reliability.',
    icon: Layers3,
  },
];

const processSteps = [
  {
    title: "Simple Recording",
    desc: "Simply start capturing your Google Meets with the extension.",
    icon: Mic
  },
  {
    title: "Information Processing",
    desc: "Your data is converted into actionable items immediately.",
    icon: Database
  },
  {
    title: "People Match",
    desc: "Automatically map recorded speakers to members within your team.",
    icon: Workflow
  },
  {
    title: "Dashboard Management",
    desc: "Review your tasks with full playback and editing on a beautiful web interface.",
    icon: Command
  }
];

export default function Landing({ session }) {
  const [showIntro, setShowIntro] = useState(true);
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  useEffect(() => {
    const hideTimer = window.setTimeout(() => {
      setShowIntro(false);
    }, 2400);

    return () => window.clearTimeout(hideTimer);
  }, []);

  return (
    <div className="relative min-h-screen bg-background text-foreground transition-colors duration-500" ref={containerRef}>
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-60 dark:opacity-100" />
        <div className="absolute inset-0 cinematic-grid opacity-10 dark:opacity-30" />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full"
        />
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 5 }}
          className="absolute top-[30%] -right-[10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full"
        />
      </div>

      <AnimatePresence>
        {showIntro && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-background/88 backdrop-blur-md"
          >
            <div className="relative w-[min(88vw,760px)] h-[180px]">
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
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-primary shadow-[0_0_20px_rgba(0,102,255,0.8)]"
              />

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-card/40 backdrop-blur-2xl">
        <div className="mx-auto max-w-7xl px-6 h-20 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex items-center gap-2"
          >
            <MomentumLogo className="w-8 h-8" />
            <span className="font-bold tracking-tight text-lg text-foreground">Moméntum-AI</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex items-center gap-4"
          >
            <Link to="/login" className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors duration-200">
              Access Request
            </Link>
            <Link to={session ? '/dashboard' : '/login'} className="button-primary group flex items-center gap-2 py-2.5 px-6 shadow-md shadow-primary/20">
              <span>{session ? 'Workspace' : 'Get Magic Link'}</span>
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>
      </nav>

      <main className="relative z-10 pt-20 pb-20 px-6 overflow-hidden">
        {/* Hero Section */}
        <motion.section
          style={{ y: heroY, opacity: heroOpacity }}
          className="mx-auto max-w-7xl pt-6 pb-32 text-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 backdrop-blur-md mb-8 shadow-sm"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground">Meeting Intelligence</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="mx-auto max-w-5xl text-5xl sm:text-6xl md:text-8xl font-extrabold tracking-tighter text-foreground"
          >
            Meeting Tasks.<br />
            <span className="text-gradient">Done completely automatically.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="mx-auto mt-8 max-w-2xl text-lg sm:text-xl leading-relaxed text-muted-foreground font-medium"
          >
            Moméntum captures your meetings and turns them into actual actionable tasks automatically, keeping your workflow quick and organized.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
            className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to={session ? '/dashboard' : '/login'} className="button-primary w-full sm:w-auto h-14 text-base px-10 flex justify-center items-center shadow-lg shadow-primary/20">
              {session ? 'Open Dashboard' : 'Get Started'}
            </Link>
            <Link to="/dashboard" className="button-secondary w-full sm:w-auto h-14 text-base px-10 flex justify-center items-center gap-2 group">
              <PlayCircle className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span>Learn More</span>
            </Link>
          </motion.div>
        </motion.section>

        {/* Cinematic Bento Layout */}
        <motion.section
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-12 gap-6 mt-16"
        >
          {/* Main Visualizer Panel */}
          <motion.div variants={fadeIn} className="md:col-span-8 glass-panel p-8 sm:p-12 min-h-[500px] flex flex-col justify-between group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 mb-6">
                <Waves className="h-3 w-3 text-blue-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">Fast AI Processing</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground mb-4">
                How it works.
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed max-w-md font-medium">
                Turning unstructured conversations into a robust framework of action items.
              </p>
            </div>

            <div className="relative z-10 mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {processSteps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-4 p-5 rounded-2xl bg-secondary/50 border border-transparent hover:border-border hover:bg-card transition-colors shadow-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-background border border-border text-foreground shadow-sm">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{step.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed font-medium">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Stats / Context Panel */}
          <motion.div variants={fadeIn} className="md:col-span-4 vibrant-panel p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.2)_0%,transparent_60%)]" />

            <div className="relative z-10 space-y-12">
              {[
                { label: 'Data Quality', value: '100%', desc: 'Safe storage binding.' },
                { label: 'Processing Speed', value: '< 2.4s', desc: 'Real-time task fetching.' },
                { label: 'AI Risk', value: 'Zero', desc: 'No unverified actions.' },
              ].map((stat, idx) => (
                <div key={idx} className="group/stat">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-2 group-hover/stat:text-white/80 transition-colors">
                    {stat.label}
                  </div>
                  <div className="text-4xl sm:text-5xl font-extrabold tracking-tighter text-white mb-2">
                    {stat.value}
                  </div>
                  <div className="text-xs font-semibold text-white/60">
                    {stat.desc}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Feature Grid */}
          {featureCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <motion.div key={idx} variants={fadeIn} className="md:col-span-6 glass-panel p-8 sm:p-10 group relative transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-secondary border border-border text-foreground shadow-sm mb-6 transition-transform duration-500 group-hover:scale-110 group-hover:bg-card">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight text-foreground mb-4">
                    {card.title}
                  </h3>
                  <p className="text-muted-foreground font-medium leading-relaxed">
                    {card.body}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.section>

        {/* Global CTA */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1 }}
          className="mx-auto max-w-5xl mt-32 mb-20 text-center relative"
        >
          <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
            <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-foreground to-transparent" />
          </div>

          <div className="relative z-10 py-16">
            <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tighter text-foreground mb-6">
              Establish Moméntum.
            </h2>
            <p className="text-lg text-muted-foreground font-medium mb-10 max-w-xl mx-auto">
              Stop taking manual notes and start being productive. Let the system do the work.
            </p>
            <Link to={session ? '/dashboard' : '/login'} className="button-primary px-12 py-4 text-lg shadow-xl shadow-primary/20">
              Open Dashboard
            </Link>
          </div>
        </motion.section>
      </main>

      <footer className="border-t border-border bg-gradient-to-b from-card to-background/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 md:py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-12">
            {/* Brand Column */}
            <div>
              <div className="flex items-center mb-4">
                <MomentumLogo className="h-8 w-auto max-w-[180px]" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">Transform your meetings into actionable intelligence with AI-powered task automation.</p>
            </div>

            {/* Product Column */}
            <div>
              <h3 className="font-semibold text-foreground mb-4 text-sm uppercase tracking-wide">Product</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Documentation</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Status</a></li>
              </ul>
            </div>

            {/* Company Column */}
            <div>
              <h3 className="font-semibold text-foreground mb-4 text-sm uppercase tracking-wide">Company</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border/50 pt-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <p className="text-xs text-muted-foreground font-medium">© 2026 Moméntum-AI. All rights reserved.</p>
              <div className="flex items-center gap-6">
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  <span className="text-xs font-medium">Twitter</span>
                </a>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  <span className="text-xs font-medium">LinkedIn</span>
                </a>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  <span className="text-xs font-medium">GitHub</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
