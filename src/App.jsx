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
    // 1. Fragment Guard: If we see a Google Auth hash, we WAIT longer.
    const hasHash = window.location.hash.includes('access_token=');
    console.log("Auth System Status: " + (hasHash ? "Handshaking with Google..." : "Checking Local Session..."));

    // 2. Load the session
    const loadSession = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      // If no hash is present, we can settle on the session immediately.
      // If a hash IS present, we wait for onAuthStateChange to fire instead.
      if (!hasHash) {
        setSession(currentSession);
        setIsInitializing(false);
      }
    };

    loadSession();

    // 3. Listen for the SIGNED_IN event (This is what handles the Google redirect hash)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log("AUTH_ENGINE_EVENT:", event);
      if (newSession || event === 'SIGNED_OUT') {
        setSession(newSession);
        setIsInitializing(false);
      }
    });

    return () => { if (subscription) subscription.unsubscribe(); };
  }, []);

  // Show a solid, un-skippable Loading state
  if (isInitializing || session === undefined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-8 text-blue-500 font-black tracking-widest text-[11px] uppercase">Finalizing Secure Session...</p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        
        {/* Strictly prevent seeing /login if logged in */}
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/dashboard" replace />} />
        
        {/* Strictly prevent seeing Dashboard if logged out */}
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
