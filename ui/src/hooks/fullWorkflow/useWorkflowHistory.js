import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchWithCSRF } from '../../utils/csrf.utils.js';
import { EXECUTION_HISTORY_REFRESH_INTERVAL_MS } from './constants.js';

export function useWorkflowHistory({
  workflowId,
  isNewWorkflow,
  autoRefreshReady = true,
  activeExecutionsRef,
  activeExecutionsPollingRef,
  setNodes,
  startPollingExecution,
}) {
  const [executionHistory, setExecutionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [showExecutionHistory, setShowExecutionHistory] = useState(false);
  const [expandedExecution, setExpandedExecution] = useState(null);
  const lastExecutionTimestampRef = useRef(null);

  const fetchExecutionHistory = useCallback(async () => {
    if (!workflowId || isNewWorkflow || !autoRefreshReady) return;
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const response = await fetchWithCSRF(
        `/api/full-workflows/${workflowId}/execution-history?limit=50`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch execution history');
      }
      const data = await response.json();
      const history = data.data || [];
      setExecutionHistory(history);

      if (history.length > 0) {
        const latestExecution = history[0];
        const latestTimestamp = new Date(latestExecution.timestamp).getTime();

        if (lastExecutionTimestampRef.current === null) {
          lastExecutionTimestampRef.current = latestTimestamp;
          console.log('🔵 Initialized lastExecutionTimestampRef', {
            workflowId,
            timestamp: latestTimestamp,
          });
          return;
        }

        const newExecutions = history.filter(execution => {
          const execTimestamp = new Date(execution.timestamp).getTime();
          return (
            execution.eventId &&
            execTimestamp > (lastExecutionTimestampRef.current || 0) &&
            !activeExecutionsRef.current.has(execution.eventId) &&
            !activeExecutionsPollingRef.current.has(execution.eventId)
          );
        });

        if (newExecutions.length > 0) {
          console.log('🆕 New execution(s) detected', {
            workflowId,
            count: newExecutions.length,
            eventIds: newExecutions.map(e => e.eventId),
            lastSeen: lastExecutionTimestampRef.current,
          });

          const latestNewTimestamp = Math.max(
            ...newExecutions.map(e => new Date(e.timestamp).getTime())
          );
          lastExecutionTimestampRef.current = latestNewTimestamp;

          newExecutions.forEach(execution => {
            if (execution.eventId) {
              if (activeExecutionsRef.current.size === 0) {
                setNodes(nds =>
                  nds.map(node => ({
                    ...node,
                    data: { ...node.data, status: 'running' },
                  }))
                );
              }
              startPollingExecution(execution.eventId);
            }
          });
        } else if (latestTimestamp > (lastExecutionTimestampRef.current || 0)) {
          const fallbackExecution = history[0];
          if (
            fallbackExecution.eventId &&
            !activeExecutionsRef.current.has(fallbackExecution.eventId)
          ) {
            console.log('🆕 New execution detected (fallback)', {
              workflowId,
              eventId: fallbackExecution.eventId,
              timestamp: latestTimestamp,
            });
            lastExecutionTimestampRef.current = latestTimestamp;
            if (activeExecutionsRef.current.size === 0) {
              setNodes(nds =>
                nds.map(node => ({
                  ...node,
                  data: { ...node.data, status: 'running' },
                }))
              );
            }
            startPollingExecution(fallbackExecution.eventId);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching execution history:', error);
      setHistoryError(error.message);
    } finally {
      setHistoryLoading(false);
    }
  }, [
    activeExecutionsPollingRef,
    activeExecutionsRef,
    isNewWorkflow,
    autoRefreshReady,
    setNodes,
    startPollingExecution,
    workflowId,
  ]);

  useEffect(() => {
    if (!workflowId || isNewWorkflow || !autoRefreshReady) {
      return undefined;
    }

    fetchExecutionHistory();
    const interval = setInterval(
      fetchExecutionHistory,
      EXECUTION_HISTORY_REFRESH_INTERVAL_MS
    );
    return () => clearInterval(interval);
  }, [autoRefreshReady, fetchExecutionHistory, isNewWorkflow, workflowId]);

  return {
    executionHistory,
    historyLoading,
    historyError,
    showExecutionHistory,
    setShowExecutionHistory,
    expandedExecution,
    setExpandedExecution,
    fetchExecutionHistory,
  };
}
