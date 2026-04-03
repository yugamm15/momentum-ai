import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [session, setSession] = useState(undefined);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // 1. First, check if we have a session in the URL Fragment (Google Auth)
    // We wait a moment for the Supabase library to "swallow" the hash
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log("INITIAL_AUTH_STABILIZED:", !!session);
      setSession(session);
      setIsInitializing(false);
    };

    checkSession();

    // 2. Listen for any future changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log("AUTH_EVENT:", event);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        setSession(newSession);
        setIsInitializing(false);
      }
    });

    return () => { if (subscription) subscription.unsubscribe(); };
  }, []);

  // While initializing or if session is unknown, show a solid loading state
  // This prevents the "Flash" because it doesn't render the Router yet
  if (isInitializing || session === undefined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-6 text-slate-400 font-bold tracking-widest text-[10px] uppercase">Stabilizing Momentum Session...</p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        
        {/* If session exists, stop them from seeing Login. If not, show Login. */}
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/dashboard" replace />} />
        
        {/* If session exists, show Dashboard. If not, force Login. */}
        <Route 
          path="/dashboard/*" 
          element={session ? <Dashboard /> : <Navigate to="/login" replace />} 
        />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
