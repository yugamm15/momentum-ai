import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ChartNoAxesCombined,
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
import { motion, AnimatePresence } from 'framer-motion';
import { signOut } from '../../lib/auth';
import { useWorkspace } from '../workspace/useWorkspace';
import MomentumLogo from '../MomentumLogo';

const navigation = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dashboard/meetings', label: 'Meetings', icon: Video },
  { to: '/dashboard/tasks', label: 'Tasks', icon: Columns3 },
  { to: '/dashboard/analytics', label: 'Analytics', icon: ChartNoAxesCombined },
  { to: '/dashboard/upload', label: 'Upload Audio', icon: Upload },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function WorkspaceShell({ session }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { error, refresh, loading } = useWorkspace();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  async function handleSignOut() {
    try {
      await signOut();
    } finally {
      navigate('/');
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row relative transition-colors duration-500">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-60 dark:opacity-100" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-primary/5 to-transparent opacity-60 dark:opacity-100" />
        <div className="absolute inset-0 cinematic-grid opacity-[0.03] dark:opacity-20" />
      </div>

      {/* Mobile Nav Overlay */}
      <AnimatePresence>
        {navOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden"
            onClick={() => setNavOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col border-r border-border bg-card/50 backdrop-blur-3xl transition-transform duration-500 ease-[0.22,1,0.36,1] md:static md:translate-x-0 ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Logo Area */}
        <div className="h-20 px-6 flex items-center justify-between border-b border-border/50">
          <Link to="/" className="flex items-center gap-2">
            <MomentumLogo className="w-8 h-8" />
            <span className="font-bold tracking-tight text-lg text-foreground">Moméntum</span>
          </Link>
          <button onClick={() => setNavOpen(false)} className="md:hidden text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Context */}
        <div className="p-6">
          <div className="glass-panel p-4 flex items-center gap-4 group relative overflow-hidden rounded-2xl mx-auto shadow-sm">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-primary/10 text-primary group-hover:scale-110 transition-transform">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="relative z-10 min-w-0">
              <div className="truncate text-sm font-semibold text-foreground tracking-tight">{session?.user?.email || 'System Default'}</div>
              <div className="text-[10px] uppercase font-bold tracking-widest text-primary/80 mt-0.5">Active Session</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
          <div className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80">Workspace</div>
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-2xl px-3 py-3 transition-all duration-300 ${
                  isActive
                    ? 'bg-foreground text-background shadow-md'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? 'text-background' : 'text-muted-foreground group-hover:text-foreground'}`} />
                  <span className="text-sm font-semibold truncate flex-1">{item.label}</span>
                  {isActive && <motion.div layoutId="nav-indicator" className="w-1.5 h-1.5 rounded-full bg-background" />}
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-border/50 space-y-1">
          <button onClick={() => refresh()} className="w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-sm font-semibold">Refresh Data</span>
          </button>
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all">
            <LogOut className="h-4 w-4" />
            <span className="text-sm font-semibold">Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative z-10 w-full h-screen overflow-y-auto">
        {/* Mobile Header Box */}
        <div className="md:hidden sticky top-0 z-20 flex items-center justify-between px-6 h-20 border-b border-border/50 bg-card/60 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <MomentumLogo className="w-8 h-8" />
            <span className="font-bold tracking-tight text-lg text-foreground">Moméntum</span>
          </div>
          <button onClick={() => setNavOpen(true)} className="text-foreground relative z-20 p-2 -mr-2">
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="m-6 glass-panel border-destructive/20 bg-destructive/10 p-5 rounded-3xl flex items-center gap-4 text-destructive shadow-lg">
            <ShieldCheck className="w-6 h-6 shrink-0" />
            <p className="text-sm font-medium">Failed to load workspace data. Please check your network connection.</p>
          </div>
        )}

        <div className="h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
