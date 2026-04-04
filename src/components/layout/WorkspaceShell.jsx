import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  ChartNoAxesCombined,
  ChevronRight,
  Columns3,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  Settings,
  ShieldCheck,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { signOut } from '../../lib/auth';
import { useWorkspace } from '../workspace/useWorkspace';

const navigation = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/meetings', label: 'Meetings', icon: Video },
  { to: '/dashboard/tasks', label: 'Tasks', icon: Columns3 },
  { to: '/dashboard/analytics', label: 'Analytics', icon: ChartNoAxesCombined },
  { to: '/dashboard/upload', label: 'Upload', icon: Upload },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
];

const pageMeta = [
  {
    match: (pathname) => pathname === '/dashboard',
    label: 'Overview',
    title: 'Workspace command center',
    description: 'Track execution quality, open ambiguity, and fresh meeting outcomes from one place.',
    primaryAction: { to: '/dashboard/meetings', label: 'Open meeting vault' },
    secondaryAction: { to: '/dashboard/upload', label: 'Upload recording' },
  },
  {
    match: (pathname) => pathname.startsWith('/dashboard/meetings'),
    label: 'Meetings',
    title: 'Execution snapshots',
    description: 'Review meetings with stronger hierarchy: score first, evidence second, edits always available.',
    primaryAction: { to: '/dashboard/tasks', label: 'Open tasks board' },
    secondaryAction: { to: '/dashboard/upload', label: 'Process another meeting' },
  },
  {
    match: (pathname) => pathname.startsWith('/dashboard/tasks'),
    label: 'Tasks',
    title: 'Cross-meeting follow-through',
    description: 'Move from extraction to execution with quicker filters, clearer ownership, and less ambiguity.',
    primaryAction: { to: '/dashboard/meetings', label: 'See source meetings' },
    secondaryAction: { to: '/dashboard/analytics', label: 'View analytics' },
  },
  {
    match: (pathname) => pathname.startsWith('/dashboard/analytics'),
    label: 'Analytics',
    title: 'Execution intelligence',
    description: 'Spot drift, owner load, and recurring risk patterns before they compound across the workspace.',
    primaryAction: { to: '/dashboard/tasks', label: 'Inspect tasks' },
    secondaryAction: { to: '/dashboard/meetings', label: 'Open meetings' },
  },
  {
    match: (pathname) => pathname.startsWith('/dashboard/upload'),
    label: 'Upload',
    title: 'Safe fallback intake',
    description: 'Keep the demo reliable with a manual route that preserves the working pipeline.',
    primaryAction: { to: '/dashboard/meetings', label: 'View processed meetings' },
    secondaryAction: { to: '/dashboard', label: 'Back to overview' },
  },
  {
    match: (pathname) => pathname.startsWith('/dashboard/settings'),
    label: 'Settings',
    title: 'Connection and rollout state',
    description: 'Keep the product honest: what is wired, what is demo-only, and what still needs admin rollout.',
    primaryAction: { to: '/dashboard/upload', label: 'Open upload center' },
    secondaryAction: { to: '/dashboard', label: 'Return to overview' },
  },
];

function sourceCopy(source) {
  if (source === 'mixed') {
    return 'Live plus seeded';
  }

  if (source === 'seeded-fallback') {
    return 'Seeded fallback';
  }

  if (source === 'seeded') {
    return 'Seeded demo';
  }

  return 'Live workspace';
}

function resolvePageMeta(pathname) {
  return pageMeta.find((item) => item.match(pathname)) || pageMeta[0];
}

export default function WorkspaceShell({ session }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { snapshot, error, refresh, loading } = useWorkspace();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  const currentPage = useMemo(() => resolvePageMeta(location.pathname), [location.pathname]);

  async function handleSignOut() {
    try {
      await signOut();
    } finally {
      navigate('/');
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1660px] lg:grid lg:grid-cols-[320px_minmax(0,1fr)]">
        {navOpen ? (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
            className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-sm lg:hidden"
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[320px] transform overflow-y-auto border-r border-slate-800/70 bg-[#07111d]/96 px-5 py-5 text-white backdrop-blur-xl transition duration-300 lg:static lg:z-auto lg:block lg:min-h-screen lg:translate-x-0 ${
            navOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(250,204,21,0.08),_transparent_22%)]" />

          <div className="relative">
            <div className="flex items-center justify-between">
              <Link to="/" className="inline-flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-gradient-to-br from-sky-300 via-sky-400 to-blue-500 text-lg font-black text-slate-950 shadow-[0_18px_45px_rgba(56,189,248,0.28)]">
                  M
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200">
                    Momentum AI
                  </div>
                  <div className="text-lg font-semibold tracking-tight text-white">
                    Execution intelligence
                  </div>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => setNavOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 lg:hidden"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="momentum-dark-panel momentum-spotlight mt-7 p-5">
              <div className="momentum-grid rounded-[26px] border border-white/10 bg-white/5 p-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100">
                  <Activity className="h-4 w-4" />
                  Workspace signal
                </div>

                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">
                  Turn conversation into accountable motion.
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  The product feels intuitive when the next action, missing owner, and quality signal all stay visible without effort.
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Meeting debt
                    </div>
                    <div className="momentum-number mt-2 text-3xl font-semibold text-white">
                      {snapshot.analytics.meetingDebt}
                    </div>
                  </div>
                  <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Completion
                    </div>
                    <div className="momentum-number mt-2 text-3xl font-semibold text-white">
                      {snapshot.analytics.metrics[3]?.value || '0%'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100">
                    {sourceCopy(snapshot.source)}
                  </span>
                  <span className="rounded-full bg-amber-300/15 px-3 py-1 text-xs font-semibold text-amber-100">
                    {snapshot.analytics.unassignedTasks} unassigned
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-7">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Workspace navigation
                </div>
                <div className="text-[11px] text-slate-500">6 surfaces</div>
              </div>
              <nav className="space-y-2">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 rounded-[22px] border px-4 py-3 text-sm font-medium transition ${
                          isActive
                            ? 'border-sky-200/50 bg-white text-slate-950 shadow-[0_22px_50px_rgba(15,23,42,0.18)]'
                            : 'border-transparent bg-transparent text-slate-300 hover:border-white/10 hover:bg-white/10 hover:text-white'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-[16px] transition ${
                              isActive
                                ? 'bg-slate-100 text-slate-900'
                                : 'bg-white/10 text-slate-200 group-hover:bg-white/14'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div>{item.label}</div>
                          </div>
                          <ArrowUpRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            <div className="mt-7 space-y-3 rounded-[28px] border border-white/10 bg-white/5 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-emerald-400/12 text-emerald-200">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">
                    {session?.user?.email || 'Demo workspace mode'}
                  </div>
                  <div className="mt-1 text-xs leading-6 text-slate-400">
                    Live pipeline preserved. UI and workflow now layer on top more cleanly.
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => refresh()}
                  className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-white/10 bg-white/10 px-3 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/14"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh data
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-white px-3 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  <LogOut className="h-4 w-4" />
                  {session ? 'Sign out' : 'Leave demo'}
                </button>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 px-4 py-4 sm:px-5 sm:py-5 lg:px-8 lg:py-7">
          <div className="sticky top-3 z-20 mb-6">
            <div className="momentum-card-soft px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setNavOpen(true)}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-slate-200 bg-white text-slate-800 lg:hidden"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      <span className="momentum-pill-accent">{currentPage.label}</span>
                      <span className="hidden items-center gap-1 sm:inline-flex">
                        <span>Workspace</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                        <span>{sourceCopy(snapshot.source)}</span>
                      </span>
                    </div>
                    <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                      {currentPage.title}
                    </h1>
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                      {currentPage.description}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 xl:items-end">
                  <div className="flex flex-wrap gap-2">
                    <span className="momentum-pill">{snapshot.meetings.length} meetings</span>
                    <span className="momentum-pill">{snapshot.tasks.length} tasks</span>
                    <span className="momentum-pill">{snapshot.analytics.metrics[1]?.value || '0'} avg score</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link to={currentPage.secondaryAction.to} className="momentum-button-secondary">
                      {currentPage.secondaryAction.label}
                    </Link>
                    <Link to={currentPage.primaryAction.to} className="momentum-button-primary">
                      {currentPage.primaryAction.label}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error ? (
            <div className="momentum-card mb-6 border-amber-200/70 bg-amber-50/90 px-5 py-4 text-sm text-amber-900">
              Momentum fell back to the seeded demo workspace because live data could not be loaded cleanly. The upload path is still untouched, and the core product flow remains available.
            </div>
          ) : null}

          <Outlet />
        </main>
      </div>
    </div>
  );
}
