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
import { motion } from 'framer-motion';
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
  summary: 'Awaiting node synchronization...',
};

function yesNo(value, yesLabel, noLabel) {
  return value ? yesLabel : noLabel;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
};

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

        if (!active || !payload) return;

        setStatus({
          env: { ...initialStatus.env, ...(payload.env || {}) },
          schema: { ...initialStatus.schema, ...(payload.schema || {}) },
          summary: payload.summary || initialStatus.summary,
        });
      } catch {
        if (active) setStatus(initialStatus);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadStatus();
    return () => { active = false; };
  }, []);

  const serverReady = status.env.hasSupabaseUrl && status.env.hasSupabaseKey;
  const aiReady = status.env.hasGroqKey && status.env.hasGeminiKey;
  const v2Ready = status.schema.mode === 'v2';

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      className="p-6 md:p-8 xl:p-12 max-w-[1600px] mx-auto space-y-8 min-h-screen"
    >
      <motion.section variants={fadeUp} className="glass-panel p-8 md:p-10 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] dark:opacity-5 pointer-events-none text-foreground">
          <Wrench className="w-64 h-64 scale-150 rotate-12" />
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-primary/10 border border-primary/20 text-[10px] uppercase font-bold text-primary tracking-widest shadow-sm">
            <Wrench className="h-3 w-3" />
            Configuration
          </div>
          <h1 className="mt-2 text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground mb-4">
            System Settings.
          </h1>
          <p className="max-w-3xl text-lg font-medium text-muted-foreground leading-relaxed">
            See your database and AI connection statuses here.
          </p>
          <div className="mt-8 inline-flex items-center gap-3 px-4 py-2.5 rounded-xl bg-secondary/50 border border-border shadow-sm text-sm font-bold text-foreground">
            <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            {loading ? 'Checking connection status...' : status.summary}
          </div>
        </div>
      </motion.section>

      <motion.section variants={fadeUp} className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Database Connection',
            title: yesNo(isSupabaseConfigured, 'Pipeline Ready', 'Pipeline Missing'),
            body: isSupabaseConfigured
              ? 'Client-side verification mechanism active.'
              : 'Network node unverified.',
            icon: ShieldCheck,
            color: isSupabaseConfigured ? 'text-emerald-500' : 'text-amber-500'
          },
          {
            label: 'Data Schema',
            title: v2Ready ? 'V2 Topology' : 'Legacy Instance',
            body: v2Ready
              ? 'Multi-dimensional scoping architecture mounted.'
              : 'Original flat matrix schema detected.',
            icon: Database,
            color: v2Ready ? 'text-primary' : 'text-amber-500'
          },
          {
            label: 'Database Permissions',
            title: yesNo(status.env.hasServiceRoleKey, 'Elevated Node', 'Restricted Node'),
            body: status.env.hasServiceRoleKey
              ? 'Privileged operations permitted.'
              : 'Service-role escalation disabled.',
            icon: KeyRound,
            color: status.env.hasServiceRoleKey ? 'text-emerald-500' : 'text-amber-500'
          },
          {
            label: 'AI Integration',
            title: yesNo(aiReady, 'Full Capability', 'Engines Offline'),
            body: aiReady
              ? 'Tensor extraction pipelines fully active.'
              : 'Certain tensors are offline. Processing defaults to base capture.',
            icon: Cpu,
            color: aiReady ? 'text-emerald-500' : 'text-rose-500'
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="glass-panel p-6 group hover:border-border transition-colors">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                  {card.label}
                </div>
                <div className={`p-2 rounded-xl bg-background border border-border shadow-sm ${card.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-foreground mb-2">
                {card.title}
              </h2>
              <p className="text-xs font-medium leading-relaxed text-muted-foreground">
                {card.body}
              </p>
            </div>
          );
        })}
      </motion.section>

      <motion.section variants={fadeUp} className="grid gap-6 xl:grid-cols-2">
        <div className="glass-panel p-8">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground mb-4">
            <Database className="h-4 w-4 text-blue-500" />
            Backend Readiness
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-6">
            System Health
          </h2>
          <div className="space-y-3 text-sm font-medium leading-relaxed text-foreground">
            <div className="rounded-2xl bg-secondary/50 border border-border px-5 py-4 flex items-center justify-between shadow-sm">
              <span>Database</span>
              <span className="font-extrabold text-primary">{yesNo(serverReady, 'ONLINE', 'OFFLINE')}</span>
            </div>
            <div className="rounded-2xl bg-secondary/50 border border-border px-5 py-4 flex items-center justify-between shadow-sm">
              <span>Schema Version</span>
              <span className="font-extrabold">{v2Ready ? 'V2 MOUNTED' : 'LEGACY MOUNTED'}</span>
            </div>
            <div className="rounded-2xl bg-secondary/50 border border-border px-5 py-4 flex flex-col gap-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span>Chrome Extension</span>
                <span className="font-extrabold text-blue-500">
                  {yesNo(
                    status.schema.extensionConnectionsAvailable,
                    `${status.schema.extensionConnectionCount} ACTIVE`,
                    'UNREACHABLE'
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-8">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground mb-4">
            <PlugZap className="h-4 w-4 text-amber-500" />
            Data Pipeline
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-6">
            Where data comes from
          </h2>
          <div className="space-y-4 text-sm font-medium leading-relaxed">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 text-foreground shadow-sm">
              <span className="font-extrabold text-primary">Primary Vector:</span> Signed-in dashboard requests use the workspace from the authenticated session. Extensions resolve to stored keychains.
            </div>
            <div className="rounded-2xl bg-secondary/50 border border-border px-5 py-4 text-muted-foreground shadow-sm">
              Browser-based popup architectures execute routing parameters explicitly through `workspace_id` injections.
            </div>
            <div className="rounded-2xl bg-secondary/50 border border-border px-5 py-4 text-muted-foreground shadow-sm">
              Orphan signals (missing keys) are processed securely but without robust workspace deterministic mounting.
            </div>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}
