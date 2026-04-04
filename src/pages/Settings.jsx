import { useEffect, useState } from 'react';
import {
  AudioLines,
  Cpu,
  Database,
  KeyRound,
  PlugZap,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
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
        const response = await apiFetch('/api/system-status', {
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
          Runtime state
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
          Inspect what the system can actually do
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
          This page should stay plainspoken. It exists to show whether the backend is ready, whether routing is trustworthy, and which parts of the meeting pipeline still have hard limitations.
        </p>
        <div className="momentum-card-soft mt-5 px-4 py-4 text-sm text-slate-700">
          {loading ? 'Checking server rollout state...' : status.summary}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Auth and access',
            title: yesNo(isSupabaseConfigured, 'Client auth ready', 'Client auth missing'),
            body: isSupabaseConfigured
              ? 'Magic-link auth is configured on the client side.'
              : 'Client auth is not configured on this deployment yet.',
            icon: ShieldCheck,
          },
          {
            label: 'Schema path',
            title: v2Ready ? 'V2 schema detected' : 'Legacy path active',
            body: v2Ready
              ? 'Workspace-scoped meeting tables are reachable.'
              : 'The deployment is still serving the original meetings/tasks shape.',
            icon: Database,
          },
          {
            label: 'Server admin',
            title: yesNo(status.env.hasServiceRoleKey, 'Service role present', 'Service role missing'),
            body: status.env.hasServiceRoleKey
              ? 'This server can perform privileged rollout and storage work.'
              : 'This server is still running without a service-role key.',
            icon: KeyRound,
          },
          {
            label: 'AI runtime',
            title: yesNo(aiReady, 'Transcription + extraction ready', 'AI keys incomplete'),
            body: aiReady
              ? 'Groq Whisper and Gemini are available to the API.'
              : 'One or more AI keys are missing, so the upload path may fall back to raw audio storage only.',
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
            Backend readiness
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            What the server can handle right now
          </h2>
          <div className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
            <div className="momentum-card-soft px-4 py-4">
              Supabase environment: {yesNo(serverReady, 'available to the API.', 'still incomplete on this runtime.')}
            </div>
            <div className="momentum-card-soft px-4 py-4">
              Schema mode: {v2Ready ? 'workspace-scoped V2 tables are active.' : 'the server is still reading the legacy schema path.'}
            </div>
            <div className="momentum-card-soft px-4 py-4">
              Extension connection table:{' '}
              {yesNo(
                status.schema.extensionConnectionsAvailable,
                `${status.schema.extensionConnectionCount} saved connection${status.schema.extensionConnectionCount === 1 ? '' : 's'} detected.`,
                'not reachable yet on this deployment.'
              )}
            </div>
          </div>
        </div>

        <div className="momentum-card p-6">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            <PlugZap className="h-4 w-4 text-amber-600" />
            Workspace routing
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            How uploads should find the right workspace
          </h2>
          <div className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
            <div className="rounded-[24px] border border-sky-200 bg-sky-50 px-4 py-4">
              Best path: signed-in dashboard requests use the workspace from the authenticated session, and extension uploads use a saved connection token when available.
            </div>
            <div className="momentum-card-soft px-4 py-4">
              The extension popup can still store `workspace_id`, `user_id`, and a connection token when you want explicit routing from the browser side.
            </div>
            <div className="momentum-card-soft px-4 py-4">
              If a token is missing, uploads can still succeed, but routing is less strict than a token-backed workspace connection.
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="momentum-card p-6">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            <AudioLines className="h-4 w-4 text-amber-700" />
            Transcript honesty
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Limits the product should state clearly
          </h2>
          <div className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
              Speaker attribution should only appear when the system has real speaker-level evidence. Otherwise the transcript must remain unattributed.
            </div>
            <div className="momentum-card-soft px-4 py-4">
              Task owners can be matched to workspace people when names align, but the UI should still surface review states when ownership is uncertain.
            </div>
            <div className="momentum-card-soft px-4 py-4">
              Raw audio retention should stay temporary, with transcript and structured outputs as the main long-term records.
            </div>
          </div>
        </div>

        <div className="momentum-card p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Privacy and trust
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            The product promise
          </h2>
          <div className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4">
              “Momentum records this meeting only after you start it.”
            </div>
            <div className="momentum-card-soft px-4 py-4">
              The strongest promise is not perfection. It is evidence, reviewability, and faster correction when the AI gets something almost right.
            </div>
            <div className="momentum-card-soft px-4 py-4">
              If the runtime or routing is incomplete, this screen should say that directly instead of masking it with marketing language.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
