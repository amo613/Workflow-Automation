import { requestTimingHooks } from '#middleware/fastify-helpers.js';
import logger from '#config/logger.js';
import { triggerWorkflow } from '#services/full-workflow/trigger.service.js';

/**
 * Webhook Routes for Full Workflows
 * Allows external services to trigger workflows via webhooks
 */
async function webhookRoutes(fastify) {
  // Apply timing hooks (but not onRequest to avoid body reading issues)
  const timingHooks = requestTimingHooks('Webhook');
  // Skip onRequest hook for webhooks to avoid body reading conflicts
  fastify.addHook('onResponse', timingHooks.onResponse);

  // Webhook endpoint - NO authentication required (webhooks are public)
  // But we validate the webhook ID to ensure it's a valid workflow
  fastify.post('/api/webhooks/:webhookId', {
    schema: {
      params: {
        type: 'object',
        required: ['webhookId'],
        properties: {
          webhookId: { type: 'string', minLength: 1 },
        },
      },
    },
    // Disable schema validation for body to avoid body reading conflicts
    attachValidation: true,
    handler: async (request, reply) => {
      try {
        const { webhookId } = request.params;
        // Fastify automatically parses JSON body
        // Access request.body directly - it's already parsed by Fastify
        // If body is not parsed yet, parse it manually
        let payload = request.body || {};

        // If body is a string (not parsed), try to parse it
        if (typeof payload === 'string') {
          try {
            payload = JSON.parse(payload);
          } catch {
            payload = {};
          }
        }

        // Find workflow by webhook ID
        // For now, webhookId is the workflow ID
        // TODO: Add dedicated webhook_id field to full_workflows table
        const workflowId = parseInt(webhookId, 10);

        if (isNaN(workflowId)) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid webhook ID',
          });
        }

        // Get workflow (we need userId, but webhooks are public)
        // For now, we'll need to find the workflow by ID without userId check
        // TODO: Add webhook authentication (e.g., secret key)
        let workflow;
        try {
          // Webhook workflow trigger
          // For now, we'll use a workaround: get workflow without userId check
          const { db } = await import('#config/database.js');
          const { fullWorkflows } = await import(
            '#models/full-workflow.model.js'
          );
          const { eq } = await import('drizzle-orm');

          const [found] = await db
            .select()
            .from(fullWorkflows)
            .where(eq(fullWorkflows.id, workflowId))
            .limit(1);

          if (!found) {
            return reply.code(404).send({
              success: false,
              error: 'Workflow not found',
            });
          }

          workflow = found;
        } catch (error) {
          logger.error('Error finding workflow for webhook', {
            error: error.message,
            webhookId,
          });
          return reply.code(500).send({
            success: false,
            error: 'Failed to find workflow',
          });
        }

        // Check if workflow is active
        if (!workflow.is_active) {
          return reply.code(400).send({
            success: false,
            error: 'Workflow is not active',
          });
        }

        // Trigger workflow with webhook payload as input
        const result = await triggerWorkflow(
          workflowId,
          workflow.user_id,
          payload
        );

        logger.info('Webhook triggered workflow', {
          webhookId,
          workflowId,
          userId: workflow.user_id,
        });

        return reply.code(200).send({
          success: true,
          message: 'Workflow triggered successfully',
          data: {
            workflowId,
            executionId: result?.id || null,
          },
        });
      } catch (error) {
        logger.error('Error handling webhook', {
          error: error.message,
          stack: error.stack,
          webhookId: request.params?.webhookId,
        });
        return reply.code(500).send({
          success: false,
          error: error.message || 'Failed to trigger workflow',
        });
      }
    },
  });
}

export default webhookRoutes;
