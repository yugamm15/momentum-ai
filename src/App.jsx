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
    // Check if we have a hash in the URL (Google callback)
    const hasHash = window.location.hash.includes('access_token=');
    
    const initAuth = async () => {
      // 1. Fetch initial session
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      
      // 2. If NO hash from google, we finalize the initial session immediately
      if (!hasHash) {
        setSession(initialSession);
        setIsInitializing(false);
      }
    };

    initAuth();

    // 3. LISTEN for the SIGNED_IN event (Google redirect success)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log("🔒 MOMENTUM_AUTH_ENGINE:", event, !!newSession);
      
      // Once we have a session OR we definitively don't, we stop the loader
      if (newSession !== undefined) {
        setSession(newSession);
        setIsInitializing(false);
      }
    });

    return () => { if (subscription) subscription.unsubscribe(); };
  }, []);

  // Show a SOLID, heavy-duty loading screen that handles the redirect handshake
  if (isInitializing || session === undefined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950">
        <div className="w-16 h-16 border-t-4 border-blue-600 rounded-full animate-spin"></div>
        <p className="mt-8 text-blue-500 font-bold tracking-widest text-[10px] uppercase animate-pulse">Establishing Secure Connection...</p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Landing Page */}
        <Route path="/" element={<Landing />} />
        
        {/* Login: Only show if NO session. If YES session, go to Dashboard. */}
        <Route 
          path="/login" 
          element={session ? <Navigate to="/dashboard" replace /> : <Login />} 
        />
        
        {/* Dashboard: Only show IF session. If NO session, go to Login. */}
        <Route 
          path="/dashboard/*" 
          element={session ? <Dashboard /> : <Navigate to="/login" replace />} 
        />
        
        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
