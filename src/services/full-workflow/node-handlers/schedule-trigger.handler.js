import logger from '#config/logger.js';

/**
 * Execute Schedule Trigger Node
 * This is a trigger node that doesn't execute anything itself
 * It's used to start workflows on a schedule (cron/time-based)
 */
export async function executeScheduleTrigger(data, context) {
  // Trigger nodes don't execute anything themselves
  // They just pass through the trigger data (schedule metadata)
  logger.info('Schedule Trigger executed', {
    schedule: data.schedule || data.cronExpression,
    workflowId: context.workflowId,
  });

  // Return schedule metadata so it's available to subsequent nodes
  return {
    success: true,
    triggerData: {
      schedule: data.schedule || data.cronExpression,
      cronExpression: data.cronExpression || null,
      preset: data.preset || null,
      event: 'schedule_triggered',
      timestamp: new Date().toISOString(),
    },
    // Make schedule metadata available
    _schedule: {
      schedule: data.schedule || data.cronExpression,
      cronExpression: data.cronExpression || null,
      preset: data.preset || null,
      timestamp: new Date().toISOString(),
    },
  };
}
