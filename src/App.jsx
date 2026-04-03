import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [session, setSession] = useState(undefined); // undefined means "Still Checking"

  useEffect(() => {
    // 1. Initial lookup
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("INITIAL_FETCH:", session ? "Session Active" : "No Session");
      setSession(session);
    });

    // 2. Continuous listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log("AUTH_EVENT:", event, !!newSession);
      // We use a small timeout to let the URL fragment be processed before updating UI
      setTimeout(() => setSession(newSession), 0);
    });

    return () => { if (subscription) subscription.unsubscribe(); };
  }, []);

  // Show nothing or a spinner while WE DON'T KNOW if you're logged in yet
  if (session === undefined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-6 text-blue-400 font-bold tracking-widest text-xs uppercase animate-pulse">Initializing Momentum Session...</p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        
        {/* If logged in, go to dashboard. If not, show login. */}
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/dashboard" replace />} />
        
        {/* Protect the dashboard route */}
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
