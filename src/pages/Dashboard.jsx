import { Navigate, Route, Routes } from 'react-router-dom';
import WorkspaceShell from '../components/layout/WorkspaceShell';
import { WorkspaceProvider } from '../components/workspace/WorkspaceProvider';
import DashboardHome from './DashboardHome';
import Meetings from './Meetings';
import MeetingDetail from './MeetingDetail';
import Tasks from './Tasks';
import Analytics from './Analytics';
import UploadHub from './UploadHub';
import Settings from './Settings';

export default function Dashboard({ session }) {
  return (
    <WorkspaceProvider>
      <Routes>
        <Route element={<WorkspaceShell session={session} />}>
          <Route index element={<DashboardHome />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="meetings/:meetingId" element={<MeetingDetail />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="upload" element={<UploadHub />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </WorkspaceProvider>
  );
}
