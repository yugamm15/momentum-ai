import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Initial lookup
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("Supabase initial session check:", session ? "Session Active" : "No Session");
      setSession(session);
      setLoading(false);
    });

    // 2. Continuous listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log("Auth State Changed Event:", event, "New Session:", newSession ? "Active" : "None");
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-500 font-bold tracking-widest uppercase text-xs">Authenticating...</p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/dashboard" replace />} />
        
        {/* Private Routes (Protected) */}
        <Route 
          path="/dashboard/*" 
          element={session ? <Dashboard /> : <Navigate to="/login" state={{ error: "Session Expired" }} replace />} 
        />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
