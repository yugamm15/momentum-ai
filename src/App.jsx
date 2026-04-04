import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { getCurrentSession, subscribeToAuthChanges } from './lib/auth';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import Login from './pages/Login';

export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    let mounted = true;

    getCurrentSession()
      .then((nextSession) => {
        if (mounted) {
          setSession(nextSession);
        }
      })
      .catch(() => {});

    const unsubscribe = subscribeToAuthChanges((nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing session={session} />} />
        <Route path="/login" element={<Login session={session} />} />
        <Route path="/dashboard/*" element={<Dashboard session={session} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
