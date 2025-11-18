import { useState, useCallback, useEffect } from 'react';
import { fetchWithCSRF } from '../../utils/csrf.utils.js';
import { STATISTICS_REFRESH_INTERVAL_MS } from './constants.js';

export function useWorkflowStatistics({
  workflowId,
  isNewWorkflow,
  autoRefreshReady = true,
}) {
  const [statistics, setStatistics] = useState(null);
  const [statisticsLoading, setStatisticsLoading] = useState(false);
  const [statisticsError, setStatisticsError] = useState(null);
  const [showStatistics, setShowStatistics] = useState(false);

  const fetchStatistics = useCallback(async () => {
    if (!workflowId || isNewWorkflow || !autoRefreshReady) return;
    try {
      setStatisticsLoading(true);
      setStatisticsError(null);
      const response = await fetchWithCSRF(
        `/api/full-workflows/${workflowId}/statistics`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }
      const data = await response.json();
      setStatistics(data.data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
      setStatisticsError(error.message);
    } finally {
      setStatisticsLoading(false);
    }
  }, [isNewWorkflow, autoRefreshReady, workflowId]);

  useEffect(() => {
    if (!workflowId || isNewWorkflow || !autoRefreshReady) {
      return undefined;
    }

    fetchStatistics();
    const interval = setInterval(
      fetchStatistics,
      STATISTICS_REFRESH_INTERVAL_MS
    );
    return () => clearInterval(interval);
  }, [autoRefreshReady, fetchStatistics, isNewWorkflow, workflowId]);

  return {
    statistics,
    statisticsLoading,
    statisticsError,
    showStatistics,
    setShowStatistics,
    fetchStatistics,
  };
}
