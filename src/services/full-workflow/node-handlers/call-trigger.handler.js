import logger from '#config/logger.js';

/**
 * Execute Call Trigger Node
 * This is a trigger node that doesn't execute anything itself
 * It's used to start workflows when an inbound call is received
 */
export async function executeCallTrigger(data, context) {
  // Trigger nodes don't execute anything themselves
  // They just pass through the trigger data (call data)
  const { CallSid, From, To, Direction } = context.workflowInput || {};

  logger.info('Call Trigger executed', {
    callSid: CallSid,
    from: From,
    to: To,
    direction: Direction,
    hasWorkflowInput: !!context.workflowInput,
  });

  // The call data is passed through the workflow input
  // Extract call metadata if present
  const workflowInput = context.workflowInput || {};
  const callMeta = workflowInput._call || {};
  const payload = { ...workflowInput };
  delete payload._call; // Remove metadata from main payload

  // Return it as trigger data so it's available to subsequent nodes
  return {
    success: true,
    triggerData: {
      callSid: CallSid || 'unknown',
      fromNumber: From || 'unknown',
      toNumber: To || 'unknown',
      direction: Direction || 'inbound',
      event: 'call_received',
      timestamp: callMeta.timestamp || new Date().toISOString(),
    },
    // Also merge the payload directly into the output for easy access
    ...payload,
    // Make call metadata available under _call key
    _call: callMeta,
    // Make call data available as individual variables
    callSid: CallSid,
    fromNumber: From,
    toNumber: To,
  };
}
