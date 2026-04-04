import DashboardOverview from '../components/dashboard/DashboardOverview';
import { useWorkspace } from '../components/workspace/useWorkspace';

export default function DashboardHome() {
  const { snapshot, loading, error } = useWorkspace();

  return <DashboardOverview snapshot={snapshot} loading={loading} error={error} />;
}
