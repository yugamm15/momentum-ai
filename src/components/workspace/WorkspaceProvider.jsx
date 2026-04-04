import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { fetchWorkspaceSnapshot } from '../../lib/workspace-data';
import { WorkspaceContext } from './context';

const POLL_INTERVAL_MS = 12000;

export function WorkspaceProvider({ children }) {
  const [snapshot, setSnapshot] = useState({
    meetings: [],
    tasks: [],
    liveMeetings: [],
    liveTasks: [],
    analytics: {
      metrics: [],
      scoreTrend: [],
      topRisks: [],
      ownerLoad: [],
      meetingDebt: 0,
      unassignedTasks: 0,
      missingDeadlines: 0,
    },
    source: 'loading',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshWorkspace = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const nextSnapshot = await fetchWorkspaceSnapshot();
      setError(nextSnapshot.error || '');
      startTransition(() => {
        setSnapshot(nextSnapshot);
      });
    } catch (refreshError) {
      setError(refreshError.message || 'Momentum could not refresh the workspace.');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    refreshWorkspace();

    const pollHandle = window.setInterval(() => {
      refreshWorkspace({ silent: true });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(pollHandle);
  }, [refreshWorkspace]);

  const value = useMemo(
    () => ({
      snapshot,
      loading,
      error,
      refresh: refreshWorkspace,
    }),
    [error, loading, refreshWorkspace, snapshot]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
