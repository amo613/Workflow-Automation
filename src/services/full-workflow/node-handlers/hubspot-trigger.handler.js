import logger from '#config/logger.js';

/**
 * Execute HubSpot Trigger Node
 * This is a trigger node that doesn't execute anything itself
 * It's used to start workflows when a HubSpot webhook is received
 */
export async function executeHubspotTrigger(data, context) {
  // Trigger nodes don't execute anything themselves
  // They just pass through the trigger data (webhook payload)
  const subscriptionId = data.subscriptionId || null;
  const eventTypes = data.eventTypes || [];

  logger.info('HubSpot Trigger executed', {
    subscriptionId,
    eventTypes,
    hasWorkflowInput: !!context.workflowInput,
  });

  // The webhook payload is passed through the workflow input
  const workflowInput = context.workflowInput || {};
  const hubspotEvent = workflowInput._hubspot || workflowInput;

  // Extract HubSpot event data
  const {
    subscriptionId: eventSubscriptionId,
    subscriptionType,
    objectId,
    properties,
    occurredAt,
    portalId,
    changeFlag,
    changeSource,
    eventId,
  } = hubspotEvent;

  // Return structured data
  return {
    success: true,
    triggerData: {
      subscriptionId: eventSubscriptionId || subscriptionId,
      eventType: subscriptionType || 'unknown',
      objectId: objectId || null,
      occurredAt: occurredAt || new Date().toISOString(),
      portalId: portalId || null,
      changeFlag: changeFlag || null,
      changeSource: changeSource || null,
      eventId: eventId || null,
    },
    // Include properties directly in output for easy access
    ...(properties || {}),
    // Make full event data available
    _hubspot: {
      subscriptionId: eventSubscriptionId,
      subscriptionType,
      objectId,
      properties,
      occurredAt,
      portalId,
      changeFlag,
      changeSource,
      eventId,
    },
  };
}

