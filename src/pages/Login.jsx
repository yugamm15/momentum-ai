import { useEffect, useState } from 'react';
import { ArrowRight, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { sendMagicLink } from '../lib/auth';
import { isSupabaseConfigured } from '../lib/supabase';

export default function Login({ session }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session) {
      navigate('/dashboard', { replace: true });
    }
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
      setError(submitError.message || 'Momentum could not start sign-in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="momentum-card momentum-spotlight p-8 lg:p-10">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-gradient-to-br from-teal-300 via-cyan-300 to-sky-400 text-lg font-black text-slate-950 shadow-[0_18px_45px_rgba(45,212,191,0.24)]">
              M
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-700">
                Momentum
              </div>
              <div className="text-lg font-semibold tracking-tight text-slate-950">
                Sign in to your workspace
              </div>
            </div>
          </Link>

          <div className="mt-10 max-w-2xl">
            <div className="momentum-pill-accent">
              <Sparkles className="h-4 w-4" />
              Real workspace access
            </div>
            <h1 className="mt-5 text-5xl font-semibold tracking-tight text-slate-950">
              Enter the live system, not a placeholder shell.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-600">
              Sign in with email to access the scoped workspace view, live meeting records, and the current execution pipeline.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-10 max-w-xl space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Work email</span>
              <div className="momentum-input-shell">
                <Mail className="h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@team.com"
                />
              </div>
            </label>

            {error ? (
              <div className="momentum-card-soft border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
            {message ? (
              <div className="momentum-card-soft border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {message}
              </div>
            ) : null}

            <button type="submit" disabled={submitting} className="momentum-button-primary w-full">
              {submitting ? 'Sending link...' : 'Send magic link'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-5 flex items-center gap-3 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            {isSupabaseConfigured
              ? 'Auth is configured and this flow sends a real magic link.'
              : 'Auth is not configured yet on this deployment.'}
          </div>
        </section>

        <section className="momentum-dark-panel p-8 lg:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-100">
            <Sparkles className="h-4 w-4" />
            What unlocks after sign-in
          </div>

          <h2 className="mt-6 text-4xl font-semibold tracking-tight text-white">
            Scoped workspace visibility.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-7 text-slate-300">
            The goal is a workspace view that shows only the meetings, people, and tasks that belong to the signed-in team context.
          </p>

          <div className="mt-8 grid gap-3">
            {[
              'Meeting pages combine recording playback, transcript evidence, people, and extracted work.',
              'Task editing keeps owner suggestions grounded in the people pool visible to this workspace.',
              'Analytics surfaces reveal where ownership is mapped cleanly and where the system still needs review.',
            ].map((item) => (
              <div key={item} className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
