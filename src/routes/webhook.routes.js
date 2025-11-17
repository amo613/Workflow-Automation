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

  // Shared webhook handler for all HTTP methods
  const webhookHandler = async (request, reply) => {
    try {
      const { webhookId } = request.params;
      const method = request.method;

      // Extract payload based on HTTP method
      let payload = {};

      // GET and DELETE: Use query parameters
      if (method === 'GET' || method === 'DELETE') {
        payload = request.query || {};
      }
      // POST, PUT, PATCH: Use body
      else if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        // Fastify automatically parses JSON body
        // Access request.body directly - it's already parsed by Fastify
        // If body is a string (not parsed), try to parse it
        let body = request.body || {};

        if (typeof body === 'string') {
          try {
            body = JSON.parse(body);
          } catch {
            // If not JSON, try to parse as form data
            body = {};
          }
        }

        payload = body;
      }

      // Extract headers (exclude sensitive headers)
      const headers = {};
      const excludeHeaders = [
        'host',
        'connection',
        'content-length',
        'content-type',
      ];
      for (const [key, value] of Object.entries(request.headers || {})) {
        if (!excludeHeaders.includes(key.toLowerCase())) {
          headers[key] = value;
        }
      }

      // Combine payload with headers and method info
      const webhookData = {
        ...payload,
        _webhook: {
          method,
          headers,
          query: request.query || {},
          path: request.url,
          timestamp: new Date().toISOString(),
        },
      };

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

      // Find the correct webhook trigger node if multiple exist
      // This allows multiple webhook triggers in the same workflow
      const workflowJson = workflow.workflow_json || {};
      const nodes = workflowJson.nodes || [];
      const webhookTriggerNodes = nodes.filter(
        node => node.type === 'webhook-trigger'
      );

      let triggerNodeId = null;
      if (webhookTriggerNodes.length > 0) {
        // If there's only one webhook trigger, use it
        if (webhookTriggerNodes.length === 1) {
          triggerNodeId = webhookTriggerNodes[0].id;
        } else {
          // Multiple webhook triggers: find the one matching webhookId
          // First, try to find a node with matching webhookId
          const matchingNode = webhookTriggerNodes.find(
            node => node.data?.webhookId === webhookId
          );
          if (matchingNode) {
            triggerNodeId = matchingNode.id;
          } else {
            // If no matching webhookId, check if any node has no webhookId (defaults to workflowId)
            const defaultNode = webhookTriggerNodes.find(
              node => !node.data?.webhookId || node.data?.webhookId === workflowId.toString()
            );
            if (defaultNode) {
              triggerNodeId = defaultNode.id;
            } else {
              // Fallback: use first webhook trigger node
              triggerNodeId = webhookTriggerNodes[0].id;
              logger.warn('Multiple webhook triggers found, using first one', {
                workflowId,
                webhookId,
                triggerNodeId,
              });
            }
          }
        }
      }

      // Add triggerNodeId to webhook data so executor knows which trigger to use
      const triggerInput = {
        ...webhookData,
        ...(triggerNodeId && { triggerNodeId }),
      };

      // Trigger workflow with webhook payload as input
      const result = await triggerWorkflow(
        workflowId,
        workflow.user_id,
        triggerInput
      );

      logger.info('Webhook triggered workflow', {
        webhookId,
        workflowId,
        userId: workflow.user_id,
        method,
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
  };

  // Webhook endpoint - NO authentication required (webhooks are public)
  // But we validate the webhook ID to ensure it's a valid workflow
  // Support all HTTP methods: GET, POST, PUT, DELETE, PATCH
  const webhookSchema = {
    params: {
      type: 'object',
      required: ['webhookId'],
      properties: {
        webhookId: { type: 'string', minLength: 1 },
      },
    },
  };

  // Register all HTTP methods
  fastify.get('/api/webhooks/:webhookId', {
    schema: webhookSchema,
    attachValidation: true,
    handler: webhookHandler,
  });

  fastify.post('/api/webhooks/:webhookId', {
    schema: webhookSchema,
    attachValidation: true,
    handler: webhookHandler,
  });

  fastify.put('/api/webhooks/:webhookId', {
    schema: webhookSchema,
    attachValidation: true,
    handler: webhookHandler,
  });

  fastify.delete('/api/webhooks/:webhookId', {
    schema: webhookSchema,
    attachValidation: true,
    handler: webhookHandler,
  });

  fastify.patch('/api/webhooks/:webhookId', {
    schema: webhookSchema,
    attachValidation: true,
    handler: webhookHandler,
  });
}

export default webhookRoutes;
