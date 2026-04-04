import { useEffect, useMemo, useState } from 'react';
import {
  CreditCard,
  Cpu,
  Database,
  KeyRound,
  PlugZap,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
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
  summary: 'Awaiting connection check...',
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

function yesNo(value, yesLabel, noLabel) {
  return value ? yesLabel : noLabel;
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(true);
  const selectedPanelId = String(searchParams.get('panel') || '').trim();

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
    return () => {
      active = false;
    };
  }, []);

  const serverReady = status.env.hasSupabaseUrl && status.env.hasSupabaseKey;
  const aiReady = status.env.hasGroqKey && status.env.hasGeminiKey;
  const v2Ready = status.schema.mode === 'v2';

  const panels = useMemo(
    () => ({
      'database-connection': {
        title: 'Database connection',
        eyebrow: 'Workspace access',
        description: serverReady
          ? 'The dashboard can reach Supabase with the configured client credentials.'
          : 'The dashboard is missing one or more client-side Supabase variables, so live workspace data may not load.',
        details: [
          `Supabase URL: ${status.env.hasSupabaseUrl ? 'present' : 'missing'}`,
          `Supabase anon key: ${status.env.hasSupabaseKey ? 'present' : 'missing'}`,
          `Current status: ${isSupabaseConfigured ? 'client ready' : 'client not configured'}`,
        ],
        actions: [
          { label: 'Open meetings', to: '/dashboard/meetings' },
          { label: 'Upload a recording', to: '/dashboard/upload' },
        ],
      },
      'data-schema': {
        title: 'Workspace schema',
        eyebrow: 'Data model',
        description: v2Ready
          ? 'The workspace is running on the newer scoped schema.'
          : 'The workspace is still using the legacy schema and may have fewer routing guarantees.',
        details: [
          `Schema mode: ${status.schema.mode || 'unknown'}`,
          `Demo workspace available: ${status.schema.demoWorkspaceAvailable ? 'yes' : 'no'}`,
          `Extension connections available: ${status.schema.extensionConnectionsAvailable ? 'yes' : 'no'}`,
        ],
        actions: [
          { label: 'Open analytics', to: '/dashboard/analytics' },
          { label: 'Open meetings', to: '/dashboard/meetings' },
        ],
      },
      permissions: {
        title: 'Database permissions',
        eyebrow: 'Privileged access',
        description: status.env.hasServiceRoleKey
          ? 'Privileged server-side operations are available.'
          : 'Service-role access is not configured, so privileged maintenance operations stay disabled.',
        details: [
          `Service role key: ${status.env.hasServiceRoleKey ? 'present' : 'missing'}`,
          'Client-side browsing does not use the service role directly.',
          'This mainly affects maintenance and advanced server operations.',
        ],
        actions: [{ label: 'Open system health', to: '/dashboard/settings' }],
      },
      'ai-integration': {
        title: 'Analysis providers',
        eyebrow: 'Processing readiness',
        description: aiReady
          ? 'Both configured providers are available for transcription and extraction flows.'
          : 'One or more analysis providers are unavailable, so uploads may fall back to lighter processing.',
        details: [
          `Groq key: ${status.env.hasGroqKey ? 'present' : 'missing'}`,
          `Gemini key: ${status.env.hasGeminiKey ? 'present' : 'missing'}`,
          'Manual uploads will still store recordings even when deeper analysis is limited.',
        ],
        actions: [
          { label: 'Open upload hub', to: '/dashboard/upload' },
          { label: 'Open meeting vault', to: '/dashboard/meetings' },
        ],
      },
      extension: {
        title: 'Extension connectivity',
        eyebrow: 'Capture pipeline',
        description: status.schema.extensionConnectionsAvailable
          ? 'The dashboard can see active extension connection records.'
          : 'No reachable extension connections are visible from the current workspace state.',
        details: [
          `Active extension connections: ${status.schema.extensionConnectionCount || 0}`,
          `Connection visibility: ${status.schema.extensionConnectionsAvailable ? 'available' : 'not available'}`,
          'Manual upload remains available even when extension connectivity is unavailable.',
        ],
        actions: [
          { label: 'Open upload hub', to: '/dashboard/upload' },
          { label: 'Open analytics', to: '/dashboard/analytics' },
        ],
      },
      routing: {
        title: 'Workspace routing',
        eyebrow: 'Data source flow',
        description:
          'Signed-in dashboard requests resolve against the authenticated workspace, while extension captures rely on stored routing context.',
        details: [
          'Dashboard reads use the current session workspace.',
          'Extension captures resolve through saved connection context when available.',
          'Fallback processing stores recordings even if a stronger route is unavailable.',
        ],
        actions: [
          { label: 'Open meetings', to: '/dashboard/meetings' },
          { label: 'Open analytics', to: '/dashboard/analytics' },
        ],
      },
      fallback: {
        title: 'Fallback handling',
        eyebrow: 'Recovery path',
        description:
          'If keys or richer routing signals are missing, recordings can still be stored and resumed later from the dashboard.',
        details: [
          'Manual upload remains the safest recovery path.',
          'Stored recordings can be reprocessed once the pipeline is healthy.',
          'Use Meeting Vault to track pending analysis items.',
        ],
        actions: [
          { label: 'Open upload hub', to: '/dashboard/upload' },
          { label: 'Open meeting vault', to: '/dashboard/meetings' },
        ],
      },
    }),
    [aiReady, serverReady, status, v2Ready]
  );

  const selectedPanel = panels[selectedPanelId] || null;

  function openPanel(panelId) {
    const normalizedPanelId = String(panelId || '').trim();
    const nextParams = new URLSearchParams();
    if (normalizedPanelId) {
      nextParams.set('panel', normalizedPanelId);
    }
    setSearchParams(nextParams, { replace: true });
  }

  function closePanel() {
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  const summaryCards = [
    {
      id: 'database-connection',
      label: 'Database Connection',
      title: yesNo(isSupabaseConfigured, 'Pipeline Ready', 'Pipeline Missing'),
      body: isSupabaseConfigured ? 'Live workspace reads are configured.' : 'Live workspace reads are not configured yet.',
      icon: ShieldCheck,
      color: isSupabaseConfigured ? 'text-emerald-500' : 'text-amber-500',
    },
    {
      id: 'data-schema',
      label: 'Data Schema',
      title: v2Ready ? 'Scoped Schema' : 'Legacy Schema',
      body: v2Ready ? 'The newer workspace model is active.' : 'The workspace is still on the older data model.',
      icon: Database,
      color: v2Ready ? 'text-primary' : 'text-amber-500',
    },
    {
      id: 'permissions',
      label: 'Database Permissions',
      title: yesNo(status.env.hasServiceRoleKey, 'Privileged Ready', 'Restricted'),
      body: status.env.hasServiceRoleKey ? 'Server-side elevated access is available.' : 'Privileged maintenance access is disabled.',
      icon: KeyRound,
      color: status.env.hasServiceRoleKey ? 'text-emerald-500' : 'text-amber-500',
    },
    {
      id: 'ai-integration',
      label: 'Analysis Providers',
      title: yesNo(aiReady, 'Ready', 'Partial'),
      body: aiReady ? 'Configured providers are available for deeper meeting analysis.' : 'One or more providers are offline or missing.',
      icon: Cpu,
      color: aiReady ? 'text-emerald-500' : 'text-rose-500',
    },
  ];

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
            Workspace settings
          </h1>
          <p className="max-w-3xl text-lg font-medium text-muted-foreground leading-relaxed">
            Inspect connection health, routing behavior, and analysis readiness without leaving the dashboard.
          </p>
          <div className="mt-8 inline-flex items-center gap-3 px-4 py-2.5 rounded-xl bg-secondary/50 border border-border shadow-sm text-sm font-bold text-foreground">
            <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            {loading ? 'Checking connection status...' : status.summary}
          </div>
          <div className="mt-5">
            <Link to="/dashboard/billing" className="button-secondary inline-flex">
              <CreditCard className="h-4 w-4" />
              Manage billing
            </Link>
          </div>
        </div>
      </motion.section>

      <motion.section variants={fadeUp} className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => openPanel(card.id)}
              className="glass-panel p-6 group hover:border-border transition-colors text-left"
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                  {card.label}
                </div>
                <div className={`p-2 rounded-xl bg-background border border-border shadow-sm ${card.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-foreground mb-2">{card.title}</h2>
              <p className="text-xs font-medium leading-relaxed text-muted-foreground">{card.body}</p>
            </button>
          );
        })}
      </motion.section>

      <motion.section variants={fadeUp} className="grid gap-6 xl:grid-cols-2">
        <div className="glass-panel p-8">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground mb-4">
            <Database className="h-4 w-4 text-blue-500" />
            Backend Readiness
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-6">System health</h2>
          <div className="space-y-3 text-sm font-medium leading-relaxed text-foreground">
            <button
              type="button"
              onClick={() => openPanel('database-connection')}
              className="w-full rounded-2xl bg-secondary/50 border border-border px-5 py-4 flex items-center justify-between shadow-sm text-left hover:bg-card"
            >
              <span>Database</span>
              <span className="font-extrabold text-primary">{yesNo(serverReady, 'ONLINE', 'OFFLINE')}</span>
            </button>
            <button
              type="button"
              onClick={() => openPanel('data-schema')}
              className="w-full rounded-2xl bg-secondary/50 border border-border px-5 py-4 flex items-center justify-between shadow-sm text-left hover:bg-card"
            >
              <span>Schema Version</span>
              <span className="font-extrabold">{v2Ready ? 'SCOPED' : 'LEGACY'}</span>
            </button>
            <button
              type="button"
              onClick={() => openPanel('extension')}
              className="w-full rounded-2xl bg-secondary/50 border border-border px-5 py-4 flex flex-col gap-2 shadow-sm text-left hover:bg-card"
            >
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
            </button>
          </div>
        </div>

        <div className="glass-panel p-8">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground mb-4">
            <PlugZap className="h-4 w-4 text-amber-500" />
            Data Pipeline
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-6">Where data comes from</h2>
          <div className="space-y-4 text-sm font-medium leading-relaxed">
            <button
              type="button"
              onClick={() => openPanel('routing')}
              className="w-full rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 text-foreground shadow-sm text-left hover:bg-primary/10"
            >
              <span className="font-extrabold text-primary">Primary route:</span> signed-in dashboard requests resolve to the active workspace session.
            </button>
            <button
              type="button"
              onClick={() => openPanel('extension')}
              className="w-full rounded-2xl bg-secondary/50 border border-border px-5 py-4 text-muted-foreground shadow-sm text-left hover:bg-card"
            >
              Extension captures rely on stored connection context when available.
            </button>
            <button
              type="button"
              onClick={() => openPanel('fallback')}
              className="w-full rounded-2xl bg-secondary/50 border border-border px-5 py-4 text-muted-foreground shadow-sm text-left hover:bg-card"
            >
              When richer routing is unavailable, recordings can still be stored safely and resumed later from the dashboard.
            </button>
          </div>
        </div>
      </motion.section>

      <AnimatePresence>
        {selectedPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/65 backdrop-blur-sm p-4"
            onClick={closePanel}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-1">
                    {selectedPanel.eyebrow}
                  </div>
                  <h3 className="text-xl font-extrabold tracking-tight text-foreground leading-tight">
                    {selectedPanel.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closePanel}
                  className="rounded-xl border border-border bg-background p-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-sm leading-7 text-muted-foreground">{selectedPanel.description}</p>

              <div className="mt-5 space-y-3">
                {selectedPanel.details.map((detail) => (
                  <div key={detail} className="rounded-2xl border border-border bg-secondary/50 px-4 py-3 text-sm text-foreground">
                    {detail}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                {selectedPanel.actions.map((action) => (
                  <Link key={action.label} to={action.to} className="button-secondary" onClick={closePanel}>
                    {action.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
