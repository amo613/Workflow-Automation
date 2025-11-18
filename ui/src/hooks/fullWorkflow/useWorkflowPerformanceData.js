import { useState, useCallback, useEffect } from 'react';
import { workflowPerformanceService } from '../../services/workflowPerformance.service.js';
import { PERFORMANCE_REFRESH_INTERVAL_MS } from './constants.js';

export function useWorkflowPerformanceData({
  workflowId,
  isNewWorkflow,
  autoRefreshReady = true,
  selectedNodeForGraph,
}) {
  const [performance, setPerformance] = useState(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [performanceError, setPerformanceError] = useState(null);
  const [showPerformance, setShowPerformance] = useState(false);
  const [nodeHistory, setNodeHistory] = useState([]);

  const fetchPerformance = useCallback(async () => {
    if (!workflowId || isNewWorkflow || !autoRefreshReady) return;
    try {
      setPerformanceLoading(true);
      setPerformanceError(null);
      const data = await workflowPerformanceService.getPerformance(
        parseInt(workflowId, 10)
      );
      setPerformance(data);
    } catch (error) {
      console.error('Error fetching performance:', error);
      setPerformanceError(error.message);
    } finally {
      setPerformanceLoading(false);
    }
  }, [isNewWorkflow, autoRefreshReady, workflowId]);

  useEffect(() => {
    if (!workflowId || isNewWorkflow || !autoRefreshReady) {
      return undefined;
    }

    fetchPerformance();
    const interval = setInterval(
      fetchPerformance,
      PERFORMANCE_REFRESH_INTERVAL_MS
    );
    return () => clearInterval(interval);
  }, [autoRefreshReady, fetchPerformance, isNewWorkflow, workflowId]);

  useEffect(() => {
    if (
      !selectedNodeForGraph ||
      !workflowId ||
      isNewWorkflow ||
      !autoRefreshReady
    ) {
      return;
    }
    workflowPerformanceService
      .getNodeHistory(parseInt(workflowId, 10), selectedNodeForGraph, 50)
      .then(setNodeHistory)
      .catch(err => {
        console.error('Error fetching node history:', err);
        setNodeHistory([]);
      });
  }, [isNewWorkflow, autoRefreshReady, selectedNodeForGraph, workflowId]);

  return {
    performance,
    performanceLoading,
    performanceError,
    showPerformance,
    setShowPerformance,
    nodeHistory,
    fetchPerformance,
  };
}
