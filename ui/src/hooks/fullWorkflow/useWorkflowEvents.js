/* global EventSource */
import { useEffect, useRef } from 'react';

export function useWorkflowEvents({
  workflowId,
  isNewWorkflow,
  autoRefreshReady = true,
  activeExecutionsRef,
  startPollingExecution,
  pollExecution,
  fetchExecutionHistory,
}) {
  const eventSourceRef = useRef(null);
  const eventStreamReconnectTimeoutRef = useRef(null);
  const reconnectAttemptRef = useRef(0);

  useEffect(() => {
    if (!workflowId || isNewWorkflow || !autoRefreshReady) {
      return undefined;
    }

    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      console.warn(
        '⚠️ EventSource not available in this environment, skipping workflow events stream.'
      );
      return undefined;
    }

    let isMounted = true;

    const connectToEventStream = () => {
      if (!isMounted) return;

      if (eventSourceRef.current) {
        console.log(
          '🔌 Closing existing workflow events stream before reconnecting',
          {
            workflowId,
          }
        );
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      const eventsUrl = `/api/full-workflows/events?workflowId=${encodeURIComponent(
        workflowId
      )}`;
      console.log('🔌 Connecting to workflow events stream', {
        workflowId,
        eventsUrl,
      });

      const source = new EventSource(eventsUrl, { withCredentials: true });
      eventSourceRef.current = source;

      const scheduleReconnect = () => {
        if (!isMounted) {
          return;
        }
        if (eventStreamReconnectTimeoutRef.current) {
          clearTimeout(eventStreamReconnectTimeoutRef.current);
        }
        const attempt = Math.min(
          reconnectAttemptRef.current + 1,
          6 // cap to avoid giant values (~2min max)
        );
        reconnectAttemptRef.current = attempt;
        const delay = Math.min(60000, 2000 * 2 ** (attempt - 1));
        console.warn('⚠️ Workflow events stream error, will retry', {
          workflowId,
          attempt,
          delayMs: delay,
        });
        eventStreamReconnectTimeoutRef.current = setTimeout(() => {
          if (!isMounted) {
            return;
          }
          console.log('♻️ Attempting to reconnect to workflow events stream', {
            workflowId,
            attempt,
          });
          connectToEventStream();
        }, delay);
      };

      const parsePayload = event => {
        if (!event?.data) {
          console.warn('⚠️ Received workflow event without data payload', {
            workflowId,
            eventType: event?.type,
          });
          return null;
        }
        try {
          return JSON.parse(event.data);
        } catch (error) {
          console.warn('⚠️ Failed to parse workflow event payload', {
            workflowId,
            eventType: event?.type,
            rawData: event.data,
            error: error.message,
          });
          return null;
        }
      };

      const handleCompletionLikeEvent = (payload, eventType) => {
        if (!payload?.eventId) {
          console.warn('⚠️ Workflow completion event missing eventId', {
            workflowId,
            eventType,
            payload,
          });
          return;
        }
        console.log('🏁 Workflow completion-type event received', {
          workflowId,
          eventType,
          payload,
        });
        pollExecution(payload.eventId).catch(error => {
          console.warn('⚠️ Failed to poll execution after completion event', {
            workflowId,
            eventType,
            eventId: payload.eventId,
            error: error.message,
          });
        });
        fetchExecutionHistory().catch(error => {
          console.warn(
            '⚠️ Failed to refresh execution history after completion event',
            {
              workflowId,
              eventType,
              error: error.message,
            }
          );
        });
      };

      source.onopen = () => {
        reconnectAttemptRef.current = 0;
        console.log('🟢 Workflow events stream connected', {
          workflowId,
        });
      };

      source.onerror = error => {
        console.warn('⚠️ Workflow events stream error', {
          workflowId,
          error,
        });
        source.close();
        eventSourceRef.current = null;
        scheduleReconnect();
      };

      source.addEventListener('ready', event => {
        const payload = parsePayload(event);
        console.log('✅ Workflow events stream ready', {
          workflowId,
          payload,
        });
      });

      source.addEventListener('heartbeat', event => {
        const payload = parsePayload(event);
        console.log('💓 Workflow events heartbeat', {
          workflowId,
          payload,
        });
      });

      source.addEventListener('workflow.pending', event => {
        const payload = parsePayload(event);
        if (!payload) return;
        if (
          payload.workflowId &&
          Number(payload.workflowId) !== Number(workflowId)
        ) {
          console.log(
            '⏭️ Ignoring workflow.pending event for different workflow',
            {
              currentWorkflowId: workflowId,
              payloadWorkflowId: payload.workflowId,
            }
          );
          return;
        }
        console.log('📨 workflow.pending event received', {
          workflowId,
          payload,
        });
        if (
          payload.eventId &&
          !activeExecutionsRef.current.has(payload.eventId)
        ) {
          startPollingExecution(payload.eventId);
        }
      });

      source.addEventListener('workflow.running', event => {
        const payload = parsePayload(event);
        if (!payload) return;
        if (
          payload.workflowId &&
          Number(payload.workflowId) !== Number(workflowId)
        ) {
          return;
        }
        console.log('🏃 workflow.running event received', {
          workflowId,
          payload,
        });
      });

      source.addEventListener('workflow.completed', event => {
        const payload = parsePayload(event);
        if (!payload) return;
        if (
          payload.workflowId &&
          Number(payload.workflowId) !== Number(workflowId)
        ) {
          return;
        }
        handleCompletionLikeEvent(payload, 'workflow.completed');
      });

      source.addEventListener('workflow.failed', event => {
        const payload = parsePayload(event);
        if (!payload) return;
        if (
          payload.workflowId &&
          Number(payload.workflowId) !== Number(workflowId)
        ) {
          return;
        }
        handleCompletionLikeEvent(payload, 'workflow.failed');
      });
    };

    connectToEventStream();

    return () => {
      isMounted = false;
      reconnectAttemptRef.current = 0;
      if (eventStreamReconnectTimeoutRef.current) {
        clearTimeout(eventStreamReconnectTimeoutRef.current);
        eventStreamReconnectTimeoutRef.current = null;
      }
      if (eventSourceRef.current) {
        console.log('🔌 Closing workflow events stream', { workflowId });
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [
    activeExecutionsRef,
    fetchExecutionHistory,
    isNewWorkflow,
    autoRefreshReady,
    pollExecution,
    startPollingExecution,
    workflowId,
  ]);
}
