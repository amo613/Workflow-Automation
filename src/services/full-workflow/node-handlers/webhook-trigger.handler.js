import logger from '#config/logger.js';

/**
 * Execute Webhook Trigger Node
 * This is a trigger node that doesn't execute anything itself
 * It's used to start workflows when a webhook is received
 */
export async function executeWebhookTrigger(data, context) {
  // Trigger nodes don't execute anything themselves
  // They just pass through the trigger data (webhook payload)
  logger.info('Webhook Trigger executed', {
    webhookId: data.webhookId || context.workflowId,
  });

  // The webhook payload is passed through the workflow input
  // Extract webhook metadata if present
  const workflowInput = context.workflowInput || {};
  const webhookMeta = workflowInput._webhook || {};
  const payload = { ...workflowInput };
  delete payload._webhook; // Remove metadata from main payload

  // Return it as trigger data so it's available to subsequent nodes
  return {
    success: true,
    triggerData: {
      webhookId: data.webhookId || context.workflowId,
      method: webhookMeta.method || 'POST',
      headers: webhookMeta.headers || {},
      query: webhookMeta.query || {},
      path: webhookMeta.path || '',
      event: 'webhook_received',
      timestamp: webhookMeta.timestamp || new Date().toISOString(),
    },
    // Also merge the payload directly into the output for easy access
    ...payload,
    // Make webhook metadata available under _webhook key
    _webhook: webhookMeta,
  };
}
