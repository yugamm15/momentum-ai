import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  AudioLines,
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
  Users,
  Video,
  Waves,
  X,
} from 'lucide-react';
import { signOut } from '../../lib/auth';
import { useWorkspace } from '../workspace/useWorkspace';

const navigation = [
  {
    to: '/dashboard',
    label: 'Overview',
    description: 'Workspace pulse',
    icon: LayoutDashboard,
    end: true,
  },
  {
    to: '/dashboard/meetings',
    label: 'Meetings',
    description: 'Playback and evidence',
    icon: Video,
  },
  {
    to: '/dashboard/tasks',
    label: 'Tasks',
    description: 'Owners and follow-through',
    icon: Columns3,
  },
  {
    to: '/dashboard/analytics',
    label: 'Analytics',
    description: 'Execution patterns',
    icon: ChartNoAxesCombined,
  },
  {
    to: '/dashboard/upload',
    label: 'Upload',
    description: 'Manual intake',
    icon: Upload,
  },
  {
    to: '/dashboard/settings',
    label: 'Settings',
    description: 'Runtime and routing',
    icon: Settings,
  },
];

const pageMeta = [
  {
    match: (pathname) => pathname === '/dashboard',
    label: 'Overview',
    title: 'Operational view of every meeting that matters',
    description:
      'Keep the workspace centered on what happened, who owns it, and whether the evidence is strong enough to trust.',
    primaryAction: { to: '/dashboard/meetings', label: 'Open meeting library' },
    secondaryAction: { to: '/dashboard/tasks', label: 'Review task load' },
  },
  {
    match: (pathname) => pathname.startsWith('/dashboard/meetings'),
    label: 'Meetings',
    title: 'Playback, transcript, and accountability in one place',
    description:
      'Review recordings with a clearer sequence: understand the moment, inspect the people, then validate the extracted work.',
    primaryAction: { to: '/dashboard/tasks', label: 'See linked tasks' },
    secondaryAction: { to: '/dashboard/upload', label: 'Add recording' },
  },
  {
    match: (pathname) => pathname.startsWith('/dashboard/tasks'),
    label: 'Tasks',
    title: 'Cross-meeting execution without guesswork',
    description:
      'Move tasks forward with a stronger people pool, cleaner owner suggestions, and evidence that stays one click away.',
    primaryAction: { to: '/dashboard/meetings', label: 'Open source meetings' },
    secondaryAction: { to: '/dashboard/analytics', label: 'Inspect load patterns' },
  },
  {
    match: (pathname) => pathname.startsWith('/dashboard/analytics'),
    label: 'Analytics',
    title: 'Patterns behind drift, load, and ambiguity',
    description:
      'Use the broader view to spot recurring ownership gaps, overloaded people, and meetings that leave too much unresolved.',
    primaryAction: { to: '/dashboard/tasks', label: 'Triage open work' },
    secondaryAction: { to: '/dashboard/meetings', label: 'Return to meetings' },
  },
  {
    match: (pathname) => pathname.startsWith('/dashboard/upload'),
    label: 'Upload',
    title: 'Bring a recording in without losing context',
    description:
      'Use the manual intake path when the browser capture is unavailable or when an existing recording needs to be processed.',
    primaryAction: { to: '/dashboard/meetings', label: 'View processed meetings' },
    secondaryAction: { to: '/dashboard/settings', label: 'Check runtime state' },
  },
  {
    match: (pathname) => pathname.startsWith('/dashboard/settings'),
    label: 'Settings',
    title: 'Inspect what the system can really do today',
    description:
      'Keep the product honest by showing environment status, schema readiness, routing posture, and current platform limitations.',
    primaryAction: { to: '/dashboard/upload', label: 'Open intake path' },
    secondaryAction: { to: '/dashboard', label: 'Back to overview' },
  },
];

function sourceCopy(source) {
  if (source === 'error') {
    return 'Unavailable';
  }

  if (source === 'empty') {
    return 'Waiting for first meeting';
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
  const livePeopleCount = snapshot.people?.length || snapshot.analytics.peopleTracked || 0;
  const attributedMeetings = snapshot.analytics.speakerAttributedMeetings || 0;
  const matchedOwners = snapshot.analytics.matchedTaskOwners || 0;

  async function handleSignOut() {
    try {
      await signOut();
    } finally {
      navigate('/');
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1680px] lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
        {navOpen ? (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
            className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm lg:hidden"
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[300px] transform overflow-y-auto border-r border-slate-900/10 bg-[#0c1623]/96 px-5 py-5 text-white backdrop-blur-2xl transition duration-300 lg:static lg:z-auto lg:block lg:min-h-screen lg:translate-x-0 ${
            navOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="relative flex min-h-full flex-col">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(251,146,60,0.12),_transparent_24%)]" />

            <div className="relative">
              <div className="flex items-center justify-between">
                <Link to="/" className="inline-flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-gradient-to-br from-teal-300 via-cyan-300 to-sky-400 text-lg font-black text-slate-950 shadow-[0_20px_48px_rgba(45,212,191,0.26)]">
                    M
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/80">
                      Momentum
                    </div>
                    <div className="text-lg font-semibold tracking-tight text-white">
                      Meeting execution system
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

              <div className="momentum-dark-panel mt-7 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-100/70">
                      Workspace pulse
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                      Execution stays visible.
                    </h2>
                  </div>
                  <Waves className="h-5 w-5 text-teal-200" />
                </div>

                <p className="mt-4 text-sm leading-7 text-slate-300">
                  The strongest signal is not the transcript. It is whether the people, owners, and next actions still make sense after the meeting ends.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      People pool
                    </div>
                    <div className="momentum-number mt-2 text-3xl font-semibold text-white">
                      {livePeopleCount}
                    </div>
                  </div>
                  <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Open work
                    </div>
                    <div className="momentum-number mt-2 text-3xl font-semibold text-white">
                      {snapshot.analytics.metrics[2]?.value || '0'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100">
                    {sourceCopy(snapshot.source)}
                  </span>
                  <span className="rounded-full bg-amber-300/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">
                    {snapshot.analytics.unassignedTasks} unassigned
                  </span>
                </div>
              </div>
            </div>

            <div className="relative mt-7 flex-1">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Navigation
                </div>
                <div className="text-[11px] text-slate-500">6 views</div>
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
                        `group flex items-center gap-3 rounded-[22px] border px-4 py-3 transition ${
                          isActive
                            ? 'border-cyan-200/50 bg-white text-slate-950 shadow-[0_18px_40px_rgba(8,15,25,0.22)]'
                            : 'border-transparent bg-transparent text-slate-300 hover:border-white/10 hover:bg-white/10 hover:text-white'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-[16px] transition ${
                              isActive
                                ? 'bg-slate-950 text-white'
                                : 'bg-white/10 text-slate-200 group-hover:bg-white/14'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold">{item.label}</div>
                            <div className={`mt-0.5 text-xs ${isActive ? 'text-slate-500' : 'text-slate-500 group-hover:text-slate-300'}`}>
                              {item.description}
                            </div>
                          </div>
                          <ArrowUpRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            <div className="relative mt-7 rounded-[28px] border border-white/10 bg-white/5 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-emerald-400/14 text-emerald-200">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">
                    {session?.user?.email || 'Workspace session'}
                  </div>
                  <div className="mt-1 text-xs leading-6 text-slate-400">
                    Scoped workspace data, real recordings, and evidence-linked task routing.
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={() => refresh()}
                  className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-white/10 bg-white/10 px-3 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/14"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh workspace
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-white px-3 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  <LogOut className="h-4 w-4" />
                  {session ? 'Sign out' : 'Exit'}
                </button>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 px-4 py-4 sm:px-5 sm:py-5 lg:px-8 lg:py-7">
          <div className="sticky top-3 z-20 mb-6">
            <div className="momentum-card-soft px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
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
                    <h1 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                      {currentPage.title}
                    </h1>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                      {currentPage.description}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 xl:items-end">
                  <div className="flex flex-wrap gap-2">
                    <span className="momentum-pill">{snapshot.meetings.length} meetings</span>
                    <span className="momentum-pill">{snapshot.tasks.length} tasks</span>
                    <span className="momentum-pill">{livePeopleCount} people</span>
                    <span className="momentum-pill">{matchedOwners} matched owners</span>
                    <span className="momentum-pill">{attributedMeetings} named-speaker recordings</span>
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

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-[22px] border border-slate-200/80 bg-white/80 px-4 py-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <Users className="h-4 w-4 text-teal-700" />
                    People mapped
                  </div>
                  <div className="momentum-number mt-2 text-3xl font-semibold text-slate-950">
                    {livePeopleCount}
                  </div>
                </div>
                <div className="rounded-[22px] border border-slate-200/80 bg-white/80 px-4 py-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <AudioLines className="h-4 w-4 text-amber-700" />
                    Speaker-attributed meetings
                  </div>
                  <div className="momentum-number mt-2 text-3xl font-semibold text-slate-950">
                    {attributedMeetings}
                  </div>
                </div>
                <div className="rounded-[22px] border border-slate-200/80 bg-white/80 px-4 py-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <Video className="h-4 w-4 text-sky-700" />
                    Average score
                  </div>
                  <div className="momentum-number mt-2 text-3xl font-semibold text-slate-950">
                    {snapshot.analytics.metrics[1]?.value || '0'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error ? (
            <div className="momentum-card mb-6 border-amber-200/70 bg-amber-50/90 px-5 py-4 text-sm text-amber-900">
              Momentum could not load the scoped workspace snapshot. Check auth, workspace mapping, and backend connectivity before trusting the current view.
            </div>
          ) : null}

          <Outlet />
        </main>
      </div>
    </div>
  );
}
