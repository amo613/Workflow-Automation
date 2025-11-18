import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchWithCSRF } from '../../utils/csrf.utils.js';
import { EXECUTION_POLL_INTERVAL_MS } from './constants.js';

export function useExecutionTracking({
  workflowId,
  setNodes,
  pollIntervalMs = EXECUTION_POLL_INTERVAL_MS,
}) {
  const activeExecutionsRef = useRef(new Map()); // Map<eventId, executionData>
  const activeExecutionsPollingRef = useRef(new Map()); // Map<eventId, intervalId>
  const [executedEdges, setExecutedEdgesInternal] = useState([]);

  const updateVisualizationFromActiveExecutions = useCallback(() => {
    const activeExecutions = activeExecutionsRef.current;
    if (activeExecutions.size === 0) return;

    const allExecutedEdges = new Set();
    const nodeStatusMap = new Map();
    const nodeOutputsMap = new Map();

    activeExecutions.forEach(executionData => {
      if (executionData.executedEdges) {
        executionData.executedEdges.forEach(edge => {
          allExecutedEdges.add(edge);
        });
      }

      if (executionData.executionLog) {
        executionData.executionLog.forEach(logEntry => {
          const existing = nodeStatusMap.get(logEntry.nodeId);
          const logTimestamp = new Date(logEntry.timestamp || 0).getTime();
          if (!existing || logTimestamp > existing.timestamp) {
            nodeStatusMap.set(logEntry.nodeId, {
              status: logEntry.status === 'failed' ? 'failed' : 'success',
              timestamp: logTimestamp,
            });
          }
        });
      }

      if (executionData.nodeOutputs) {
        Object.entries(executionData.nodeOutputs).forEach(
          ([nodeId, output]) => {
            const existing = nodeOutputsMap.get(nodeId);
            const executionTimestamp = executionData.timestamp || 0;
            if (!existing || executionTimestamp > existing.timestamp) {
              nodeOutputsMap.set(nodeId, {
                output,
                timestamp: executionTimestamp,
              });
            }
          }
        );
      }
    });

    setExecutedEdgesInternal(Array.from(allExecutedEdges));

    setNodes(nds =>
      nds.map(node => {
        const statusInfo = nodeStatusMap.get(node.id);
        const outputInfo = nodeOutputsMap.get(node.id);

        if (statusInfo || outputInfo) {
          return {
            ...node,
            data: {
              ...node.data,
              status: statusInfo?.status || node.data.status || 'running',
              output:
                outputInfo?.output !== undefined
                  ? outputInfo.output
                  : node.data.output,
            },
          };
        }

        return {
          ...node,
          data: {
            ...node.data,
            status:
              node.data.status === 'success' || node.data.status === 'failed'
                ? node.data.status
                : 'running',
          },
        };
      })
    );
  }, [setNodes]);

  const pollExecution = useCallback(
    async eventId => {
      try {
        const resultsResponse = await fetchWithCSRF(
          `/api/full-workflows/execution-results?eventId=${encodeURIComponent(
            eventId
          )}`
        );

        if (resultsResponse.ok) {
          const resultsData = await resultsResponse.json();
          const status = resultsData.data?.status;

          const executionData = {
            status,
            executedEdges: resultsData.data?.executedEdges || [],
            nodeOutputs: resultsData.data?.nodeOutputs || {},
            executionLog: resultsData.data?.executionLog || [],
            timestamp: resultsData.data?.startedAt || Date.now(),
          };
          activeExecutionsRef.current.set(eventId, executionData);

          updateVisualizationFromActiveExecutions();

          if (status === 'pending' || status === 'running') {
            return true;
          }

          console.log('✅ Execution completed', {
            workflowId,
            eventId,
            status,
            nodeOutputsCount: Object.keys(executionData.nodeOutputs || {})
              .length,
            executedEdgesCount: executionData.executedEdges?.length || 0,
          });

          const intervalId = activeExecutionsPollingRef.current.get(eventId);
          if (intervalId) {
            clearInterval(intervalId);
            activeExecutionsPollingRef.current.delete(eventId);
          }

          setTimeout(() => {
            activeExecutionsRef.current.delete(eventId);
            updateVisualizationFromActiveExecutions();
          }, 3000);
          return false;
        } else if (resultsResponse.status === 404) {
          return true;
        } else {
          console.warn('Error polling execution', {
            workflowId,
            eventId,
            status: resultsResponse.status,
          });
          return false;
        }
      } catch (error) {
        console.warn('Error polling execution', {
          workflowId,
          eventId,
          error: error.message,
        });
        return false;
      }
    },
    [updateVisualizationFromActiveExecutions, workflowId]
  );

  const startPollingExecution = useCallback(
    eventId => {
      if (!eventId) return;
      if (activeExecutionsPollingRef.current.has(eventId)) {
        return;
      }

      console.log('🔄 Starting polling for execution', { workflowId, eventId });

      pollExecution(eventId).then(shouldContinue => {
        if (shouldContinue) {
          const intervalId = setInterval(async () => {
            const stillRunning = await pollExecution(eventId);
            if (!stillRunning) {
              clearInterval(intervalId);
              activeExecutionsPollingRef.current.delete(eventId);
            }
          }, pollIntervalMs);
          activeExecutionsPollingRef.current.set(eventId, intervalId);
        }
      });
    },
    [pollExecution, pollIntervalMs, workflowId]
  );

  useEffect(() => {
    return () => {
      activeExecutionsPollingRef.current.forEach(intervalId => {
        clearInterval(intervalId);
      });
      activeExecutionsPollingRef.current.clear();
      activeExecutionsRef.current.clear();
    };
  }, []);

  return {
    executedEdges,
    setExecutedEdges: setExecutedEdgesInternal,
    activeExecutionsRef,
    activeExecutionsPollingRef,
    pollExecution,
    startPollingExecution,
  };
}
