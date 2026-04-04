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

      if (result.demoMode) {
        navigate('/dashboard');
      }
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
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-gradient-to-br from-sky-300 via-sky-400 to-blue-500 text-lg font-black text-slate-950 shadow-[0_18px_45px_rgba(56,189,248,0.24)]">
              M
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700">
                Momentum AI
              </div>
              <div className="text-lg font-semibold tracking-tight text-slate-950">
                Sign in to your workspace
              </div>
            </div>
          </Link>

          <div className="mt-10 max-w-2xl">
            <div className="momentum-pill-accent">
              <Sparkles className="h-4 w-4" />
              SaaS-ready access
            </div>
            <h1 className="mt-5 text-5xl font-semibold tracking-tight text-slate-950">
              Bring meetings into an execution system, not a note graveyard.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-600">
              Use email login for the real product story, or keep moving in the demo workspace while the rest of the stack keeps getting sharper.
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
              ? 'Auth is configured. This flow sends a real magic link.'
              : 'Auth is not configured yet, so Momentum keeps the demo workspace open for build velocity.'}
          </div>
        </section>

        <section className="momentum-dark-panel p-8 lg:p-10">
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100">
              <Sparkles className="h-4 w-4" />
              Demo workspace
            </div>

            <h2 className="mt-6 text-4xl font-semibold tracking-tight text-white">
              Ship first. Keep the auth story believable.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-slate-300">
              The hackathon version should never feel blocked by auth polish. The workspace stays explorable while the production posture matures underneath it.
            </p>

            <div className="mt-8 grid gap-3">
              {[
                'Seeded meeting history so the workspace looks alive before the live demo',
                'A signature meeting detail page with decisions, risks, tasks, and transcript evidence',
                'Cross-meeting task board and analytics that sell the SaaS narrative fast',
              ].map((item) => (
                <div key={item} className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-200">
                  {item}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-[20px] bg-gradient-to-r from-sky-300 via-sky-400 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5"
            >
              Continue in demo workspace
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
