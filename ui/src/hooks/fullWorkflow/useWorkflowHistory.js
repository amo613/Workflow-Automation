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
  const historyFetchInProgressRef = useRef(false);

  const fetchExecutionHistory = useCallback(async () => {
    if (!workflowId || isNewWorkflow || !autoRefreshReady) return;
    if (historyFetchInProgressRef.current) {
      return;
    }
    historyFetchInProgressRef.current = true;
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

        // Update timestamp FIRST to prevent duplicate detection
        // This ensures that if we've already seen this execution (via workflow.pending),
        // we won't detect it as "new" when history refreshes
        const previousTimestamp = lastExecutionTimestampRef.current;
        if (latestTimestamp > previousTimestamp) {
          lastExecutionTimestampRef.current = latestTimestamp;
        }

        const newExecutions = history.filter(execution => {
          const execTimestamp = new Date(execution.timestamp).getTime();
          return (
            execution.eventId &&
            execTimestamp > previousTimestamp && // Use previousTimestamp, not current
            !activeExecutionsRef.current.has(execution.eventId) &&
            !activeExecutionsPollingRef.current.has(execution.eventId)
          );
        });

        if (newExecutions.length > 0) {
          console.log('🆕 New execution(s) detected', {
            workflowId,
            count: newExecutions.length,
            eventIds: newExecutions.map(e => e.eventId),
            lastSeen: previousTimestamp,
          });

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
        } else if (latestTimestamp > previousTimestamp) {
          // Fallback: if timestamp was updated but no new executions found,
          // it means the execution was already being tracked
          const fallbackExecution = history[0];
          if (
            fallbackExecution.eventId &&
            !activeExecutionsRef.current.has(fallbackExecution.eventId) &&
            !activeExecutionsPollingRef.current.has(fallbackExecution.eventId)
          ) {
            console.log('🆕 New execution detected (fallback)', {
              workflowId,
              eventId: fallbackExecution.eventId,
              timestamp: latestTimestamp,
            });
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
      historyFetchInProgressRef.current = false;
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

  useEffect(() => {
    historyFetchInProgressRef.current = false;
  }, [workflowId]);

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
