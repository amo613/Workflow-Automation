import { EventEmitter } from 'node:events';
import logger from '#config/logger.js';

const workflowEventsEmitter = new EventEmitter();
workflowEventsEmitter.setMaxListeners(0);

export function broadcastWorkflowEvent(event) {
  const enrichedEvent = {
    ...event,
    sentAt: new Date().toISOString(),
  };

  try {
    logger.info('Broadcasting workflow event', enrichedEvent);
    workflowEventsEmitter.emit('workflow-event', enrichedEvent);
  } catch (error) {
    logger.error('Failed to broadcast workflow event', {
      error: error.message,
      event,
    });
  }
}

export function subscribeToWorkflowEvents(reply, context = {}) {
  const { workflowId, userId } = context;

  logger.info('Subscribing client to workflow events', {
    workflowId,
    userId,
  });

  const writeEvent = (event) => {
    if (workflowId && Number(event.workflowId) !== Number(workflowId)) {
      return;
    }

    try {
      reply.raw.write(`event: ${event.type}\n`);
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch (error) {
      logger.warn('Failed to write workflow event to SSE stream', {
        error: error.message,
        event,
      });
    }
  };

  const sendHeartbeat = () => {
    const heartbeatPayload = {
      type: 'heartbeat',
      workflowId: workflowId ? Number(workflowId) : null,
      timestamp: new Date().toISOString(),
    };
    try {
      reply.raw.write(`event: heartbeat\n`);
      reply.raw.write(`data: ${JSON.stringify(heartbeatPayload)}\n\n`);
    } catch (error) {
      logger.warn('Failed to write heartbeat to SSE stream', {
        error: error.message,
        workflowId,
      });
    }
  };

  workflowEventsEmitter.on('workflow-event', writeEvent);
  const heartbeatInterval = setInterval(sendHeartbeat, 30000);
  sendHeartbeat();

  reply.raw.on('close', () => {
    logger.info('SSE client disconnected from workflow events', {
      workflowId,
      userId,
    });
    clearInterval(heartbeatInterval);
    workflowEventsEmitter.off('workflow-event', writeEvent);
  });

  // Initial ready event
  const readyPayload = {
    type: 'ready',
    workflowId: workflowId ? Number(workflowId) : null,
    userId: userId || null,
    timestamp: new Date().toISOString(),
  };
  reply.raw.write(`event: ready\n`);
  reply.raw.write(`data: ${JSON.stringify(readyPayload)}\n\n`);
}

