import { useEffect, useState } from 'react';
import {
  Cpu,
  Database,
  KeyRound,
  PlugZap,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { apiUrl } from '../lib/api';
import { isSupabaseConfigured } from '../lib/supabase';

const initialStatus = {
  env: {
    hasSupabaseUrl: false,
    hasSupabaseKey: false,
    hasServiceRoleKey: false,
    hasGroqKey: false,
    hasGeminiKey: false,
  },
  schema: {
    mode: 'unavailable',
    demoWorkspaceAvailable: false,
    extensionConnectionsAvailable: false,
    extensionConnectionCount: 0,
  },
  summary: 'Checking server rollout state...',
};

function yesNo(value, yesLabel, noLabel) {
  return value ? yesLabel : noLabel;
}

export default function Settings() {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      try {
        const response = await fetch(apiUrl('/api/system-status'), {
          headers: { 'Cache-Control': 'no-store' },
        });
        const payload = await response.json().catch(() => null);

        if (!active || !payload) {
          return;
        }

        setStatus({
          env: {
            ...initialStatus.env,
            ...(payload.env || {}),
          },
          schema: {
            ...initialStatus.schema,
            ...(payload.schema || {}),
          },
          summary: payload.summary || initialStatus.summary,
        });
      } catch {
        if (active) {
          setStatus(initialStatus);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadStatus();

    return () => {
      active = false;
    };
  }, []);

  const serverReady = status.env.hasSupabaseUrl && status.env.hasSupabaseKey;
  const aiReady = status.env.hasGroqKey && status.env.hasGeminiKey;
  const v2Ready = status.schema.mode === 'v2';

  return (
    <div className="space-y-6">
      <section className="momentum-card momentum-spotlight p-6">
        <div className="momentum-pill-accent">
          <Wrench className="h-4 w-4" />
          Settings
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
          Product setup and rollout state
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
          This view now reflects the real backend posture more closely: what the server can do today, what schema path is active, and whether the extension can be tied to a workspace cleanly.
        </p>
        <div className="momentum-card-soft mt-5 px-4 py-4 text-sm text-slate-700">
          {loading ? 'Checking server rollout state...' : status.summary}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Auth and access',
            title: yesNo(isSupabaseConfigured, 'Client auth ready', 'Demo-first fallback'),
            body: isSupabaseConfigured
              ? 'Magic-link auth is configured on the client side.'
              : 'The dashboard can still run in demo mode while auth is being finalized.',
            icon: ShieldCheck,
          },
          {
            label: 'Schema path',
            title: v2Ready ? 'V2 schema detected' : 'Legacy path active',
            body: v2Ready
              ? 'Workspace tables, transcript segments, risk flags, and richer tasks are visible to the API.'
              : 'The server is still reading the original meetings/tasks shape on this deployment.',
            icon: Database,
          },
          {
            label: 'Server admin',
            title: yesNo(status.env.hasServiceRoleKey, 'Service role present', 'Service role missing'),
            body: status.env.hasServiceRoleKey
              ? 'This server can perform privileged rollout work and storage operations.'
              : 'This server is still running without a service-role key, so rollout remains limited.',
            icon: KeyRound,
          },
          {
            label: 'AI runtime',
            title: yesNo(aiReady, 'Transcription + extraction ready', 'AI keys incomplete'),
            body: aiReady
              ? 'Groq Whisper and Gemini Flash are available to the API.'
              : 'One or more AI keys are missing, so the upload flow may fall back to raw storage only.',
            icon: Cpu,
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="momentum-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {card.label}
                </div>
                <Icon className="h-4 w-4 text-sky-600" />
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                {card.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{card.body}</p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="momentum-card p-6">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            <Database className="h-4 w-4 text-sky-600" />
            Backend rollout
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            What the server can do right now
          </h2>
          <div className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
            <div className="momentum-card-soft px-4 py-4">
              Supabase environment:
              {' '}
              {yesNo(serverReady, 'available to the API.', 'still incomplete on this runtime.')}
            </div>
            <div className="momentum-card-soft px-4 py-4">
              Schema mode:
              {' '}
              {v2Ready ? 'V2 workspace tables are reachable.' : 'the deployment is still serving the legacy schema path.'}
            </div>
            <div className="momentum-card-soft px-4 py-4">
              Extension connection table:
              {' '}
              {yesNo(
                status.schema.extensionConnectionsAvailable,
                `${status.schema.extensionConnectionCount} saved connection${status.schema.extensionConnectionCount === 1 ? '' : 's'} detected.`,
                'not reachable yet on this deployment.'
              )}
            </div>
            <div className="momentum-card-soft px-4 py-4">
              Demo workspace:
              {' '}
              {yesNo(
                status.schema.demoWorkspaceAvailable,
                'present in the server schema.',
                'not yet created in the current V2 schema.'
              )}
            </div>
          </div>
        </div>

        <div className="momentum-card p-6">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            <PlugZap className="h-4 w-4 text-amber-600" />
            Extension workspace link
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            How uploads should be tied to a workspace
          </h2>
          <div className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
            <div className="rounded-[24px] border border-sky-200 bg-sky-50 px-4 py-4">
              The extension popup now has a dedicated Workspace link section for `workspace_id`, `user_id`, and `connection token`.
            </div>
            <div className="momentum-card-soft px-4 py-4">
              Best path:
              {' '}
              save a connection token when the V2 schema is live, so uploads route into the right workspace without trusting raw client IDs alone.
            </div>
            <div className="momentum-card-soft px-4 py-4">
              Safe fallback:
              {' '}
              if no token is saved, Momentum can still upload, but routing is less strict and should be treated as demo-safe rather than production-safe.
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="momentum-card p-6">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            <Sparkles className="h-4 w-4 text-amber-600" />
            Watermelon strategy
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Subtle, not copy-paste
          </h2>
          <div className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
            <div className="momentum-card-soft px-4 py-4">
              The current UI borrows sharper navigation treatment, premium card density, and richer status surfaces without making the app feel like a cloned template.
            </div>
            <div className="momentum-card-soft px-4 py-4">
              The judge-facing screens that benefit most are already the shell, overview, meetings, meeting detail, tasks, analytics, and upload flow.
            </div>
          </div>
        </div>

        <div className="momentum-card p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Privacy and trust
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            What the UX should keep saying
          </h2>
          <div className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4">
              "Momentum records this meeting only after you start it."
            </div>
            <div className="momentum-card-soft px-4 py-4">
              Avoid promising perfect transcription or perfect owner resolution. The right promise is evidence, reviewability, and faster execution.
            </div>
            <div className="momentum-card-soft px-4 py-4">
              Raw audio retention should stay temporary, with transcript and structured outputs as the primary long-term records.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
