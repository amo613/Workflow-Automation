import { inngest } from '#config/inngest.js';
import logger from '#config/logger.js';

/**
 * Trigger Service for Full Workflows
 * Handles triggering workflows via Inngest
 */

/**
 * Trigger a full workflow execution
 * @param {number} workflowId - Workflow ID
 * @param {number} userId - User ID
 * @param {Object} input - Workflow input data
 * @returns {Promise<Object>} - Event ID from Inngest
 */
export async function triggerWorkflow(workflowId, userId, input = {}) {
  try {
    logger.info('Triggering workflow via Inngest', {
      workflowId,
      userId,
      hasInput: !!input,
    });

    const event = await inngest.send({
      name: 'workflow/triggered',
      data: {
        workflowId,
        userId,
        input,
      },
    });

    logger.info('Workflow triggered successfully', {
      workflowId,
      eventId: event.ids?.[0],
    });

    if (!event?.ids?.length) {
      logger.warn(
        'Inngest send returned no event IDs; run may not appear in dashboard',
        {
          workflowId,
          userId,
        }
      );
    }

    return {
      success: true,
      eventId: event.ids?.[0],
      workflowId,
    };
  } catch (error) {
    logger.error('Failed to trigger workflow', {
      workflowId,
      userId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Trigger workflow by webhook
 * @param {string} webhookId - Webhook ID (can be workflow ID or custom ID)
 * @param {Object} payload - Webhook payload
 * @returns {Promise<Object>} - Event ID from Inngest
 */
export async function triggerByWebhook(webhookId, payload = {}) {
  try {
    logger.info('Triggering workflow via webhook', {
      webhookId,
      payloadKeys: Object.keys(payload),
    });

    const event = await inngest.send({
      name: 'workflow/webhook',
      data: {
        webhookId,
        payload,
      },
    });

    logger.info('Webhook workflow triggered successfully', {
      webhookId,
      eventId: event.ids?.[0],
    });
    if (!event?.ids?.length) {
      logger.warn(
        'Inngest send (webhook) returned no event IDs; run may not appear in dashboard',
        {
          webhookId,
        }
      );
    }

    return {
      success: true,
      eventId: event.ids?.[0],
      webhookId,
    };
  } catch (error) {
    logger.error('Failed to trigger workflow via webhook', {
      webhookId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Trigger workflow by schedule (cron)
 * Note: This requires setting up a scheduled function in Inngest
 * @param {number} workflowId - Workflow ID
 * @param {string} cron - Cron expression
 * @returns {Promise<Object>} - Schedule ID
 */
export async function triggerBySchedule(workflowId, cron) {
  try {
    logger.info('Scheduling workflow', {
      workflowId,
      cron,
    });

    // Note: Scheduled workflows are typically defined in Inngest functions
    // This is a placeholder for future implementation
    // You would create a scheduled function in inngest-functions.js

    return {
      success: true,
      workflowId,
      cron,
      message: 'Schedule will be set up in Inngest function definition',
    };
  } catch (error) {
    logger.error('Failed to schedule workflow', {
      workflowId,
      cron,
      error: error.message,
    });
    throw error;
  }
}
