import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';

// WE ARE IN EMERGENCY MODE: AUTH IS STRIPPED.
export default function App() {
  return (
    <Router>
      <Routes>
        {/* Force everyone straight to the dashboard. No Login. No Sign up. No Auth. */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard/*" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
