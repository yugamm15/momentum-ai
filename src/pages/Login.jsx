import { useEffect, useState } from 'react';
import { ArrowRight, Mail, ShieldCheck, Sparkles, LayoutDashboard } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { sendMagicLink } from '../lib/auth';
import { isSupabaseConfigured } from '../lib/supabase';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
};

export default function Login({ session }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session) navigate('/dashboard', { replace: true });
  }, [navigate, session]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const result = await sendMagicLink(email);
      setMessage(result.message);
    } catch (submitError) {
      setError(submitError.message || 'Moméntum could not send the magic link.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div 
      initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      className="min-h-screen bg-background text-foreground flex items-center justify-center p-6"
    >
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-60 dark:opacity-100" />
        <div className="absolute inset-0 cinematic-grid opacity-10 dark:opacity-30" />
      </div>

      <div className="mx-auto w-full max-w-6xl grid lg:grid-cols-[1fr_0.8fr] gap-6 relative z-10">
        <motion.section variants={fadeUp} className="glass-panel p-8 lg:p-12">
          <Link to="/" className="inline-flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center vibrant-panel">
              <span className="text-white font-bold text-xl leading-none">M</span>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-primary">
                Moméntum
              </div>
              <div className="text-sm font-extrabold tracking-tight text-foreground">
                Workspace Access
              </div>
            </div>
          </Link>

          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-primary/10 border border-primary/20 text-[10px] uppercase font-bold text-primary tracking-widest shadow-sm">
              <Sparkles className="h-3 w-3" />
              Secure Access
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground mb-4">
              Request a magic link.
            </h1>
            <p className="text-lg font-medium leading-relaxed text-muted-foreground max-w-xl">
              Enter your email to securely access your team's meeting recordings and assigned tasks.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-12 max-w-md space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">Work Email</span>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@organization.com"
                  className="w-full bg-card border border-border rounded-xl py-3 pl-12 pr-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm font-medium"
                  required
                />
              </div>
            </label>

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-600 dark:text-rose-400 shadow-sm">
                  {error}
                </motion.div>
              )}
              {message && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400 shadow-sm">
                  {message}
                </motion.div>
              )}
            </AnimatePresence>

            <button type="submit" disabled={submitting} className="button-primary w-full py-3.5 text-base shadow-xl shadow-primary/20 mt-2">
              {submitting ? 'Sending link...' : 'Send magic link'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-8 flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground border-t border-border pt-6">
            <ShieldCheck className={`h-4 w-4 ${isSupabaseConfigured ? 'text-primary' : 'text-amber-500'}`} />
            {isSupabaseConfigured
              ? 'Auth is configured and working.'
              : 'Warning: Authentication is not configured.'}
          </div>
        </motion.section>

        <motion.section variants={fadeUp} className="vibrant-panel p-8 lg:p-12 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-sm backdrop-blur-md self-start mb-6">
            <LayoutDashboard className="h-3 w-3" />
            What you get
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-6">
            Clear Workspace View.
          </h2>
          <p className="max-w-md text-base font-medium leading-relaxed text-white/80 mb-10">
            Accessing the dashboard shows you the meetings, people, and tasks meant only for you.
          </p>

          <div className="grid gap-4">
            {[
              'Recordings directly tied to tasks.',
              'Tasks mapped to real people.',
              'Clear accountability for actionable work.',
            ].map((item) => (
              <div key={item} className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-sm font-medium text-white/90 shadow-sm backdrop-blur-sm hover:bg-white/10 transition-colors">
                {item}
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
}
