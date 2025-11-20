import { requestTimingHooks } from '#middleware/fastify-helpers.js';
import logger from '#config/logger.js';
import { triggerWorkflow } from '#services/full-workflow/trigger.service.js';
import { getRedisClient } from '#config/cache.js';
import { getCustomPathConfig } from '#services/custom-webhook-path.service.js';

/**
 * Webhook Routes for Full Workflows
 * Allows external services to trigger workflows via webhooks
 */

// Rate limiter helper (similar to security.middleware.js)
const rateLimitStore = new Map();

async function checkRateLimit(identifier, limit, windowMs = 60000) {
  const redisClient = getRedisClient();
  const key = `ratelimit:${identifier}`;
  const now = Date.now();

  try {
    if (redisClient?.isReady) {
      const current = await redisClient.get(key);
      if (current) {
        const data = JSON.parse(current);
        if (data.resetAt > now) {
          if (data.count >= limit) {
            return { allowed: false, remaining: 0, resetAt: data.resetAt };
          }
          const newCount = data.count + 1;
          await redisClient.setEx(
            key,
            Math.ceil((data.resetAt - now) / 1000),
            JSON.stringify({
              count: newCount,
              resetAt: data.resetAt,
            })
          );
          return {
            allowed: true,
            remaining: limit - newCount,
            resetAt: data.resetAt,
          };
        }
      }
      const resetAt = now + windowMs;
      await redisClient.setEx(
        key,
        Math.ceil(windowMs / 1000),
        JSON.stringify({
          count: 1,
          resetAt,
        })
      );
      return { allowed: true, remaining: limit - 1, resetAt };
    }
  } catch (error) {
    logger.warn('Redis rate limit error, falling back to memory:', error.message);
  }

  // Fallback to in-memory store
  const stored = rateLimitStore.get(key);
  if (stored && stored.resetAt > now) {
    if (stored.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: stored.resetAt };
    }
    stored.count++;
    return {
      allowed: true,
      remaining: limit - stored.count,
      resetAt: stored.resetAt,
    };
  }

  const resetAt = now + windowMs;
  rateLimitStore.set(key, { count: 1, resetAt });

  // Clean up old entries periodically
  if (rateLimitStore.size > 10000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetAt <= now) {
        rateLimitStore.delete(k);
      }
    }
  }

  return { allowed: true, remaining: limit - 1, resetAt };
}

// Validate Basic Auth
function validateBasicAuth(request, nodeConfig) {
  if (!nodeConfig?.requireBasicAuth) {
    return { valid: true };
  }

  const expectedUsername = nodeConfig.basicAuthUsername;
  const expectedPassword = nodeConfig.basicAuthPassword;

  if (!expectedUsername || !expectedPassword) {
    return {
      valid: false,
      error: 'Basic Auth is enabled but username/password not configured',
    };
  }

  const authHeader = request.headers.authorization;

  if (!authHeader || typeof authHeader !== 'string') {
    return {
      valid: false,
      error:
        'Missing Authorization header. Use Basic Auth: Authorization: Basic base64(username:password)',
    };
  }

  if (!authHeader.startsWith('Basic ')) {
    return {
      valid: false,
      error: 'Invalid Authorization header. Must use Basic Auth format.',
    };
  }

  try {
    const base64Credentials = authHeader.substring(6).trim();
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    if (!username || !password) {
      return {
        valid: false,
        error: 'Invalid Basic Auth format. Expected: base64(username:password)',
      };
    }

    if (username !== expectedUsername || password !== expectedPassword) {
      return {
        valid: false,
        error: 'Invalid username or password',
      };
    }

    return { valid: true };
  } catch {
    return {
      valid: false,
      error: 'Failed to decode Basic Auth credentials',
    };
  }
}

// Apply Rate Limiting
async function applyRateLimit(request, webhookId, nodeConfig) {
  const rateLimit = nodeConfig?.rateLimit || {};

  // Custom Rate Limiting
  if (rateLimit.custom?.enabled) {
    const identifier = `webhook:${webhookId}:${request.ip}`;
    const limit = rateLimit.custom.requestsPerMinute || 100;
    const windowMs = (rateLimit.custom.windowMinutes || 1) * 60 * 1000;

    const result = await checkRateLimit(identifier, limit, windowMs);

    if (!result.allowed) {
      return {
        allowed: false,
        error: 'Rate limit exceeded',
        message: `Too many requests. Limit: ${limit} requests per ${rateLimit.custom.windowMinutes || 1} minute(s). Try again later.`,
        resetAt: result.resetAt,
      };
    }
  }

  // Arcjet Protection (optional, wird später implementiert wenn nötig)
  if (rateLimit.arcjet?.enabled) {
    // TODO: Arcjet Integration
    // Wird in späterer Phase implementiert
  }

  return { allowed: true };
}

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
        'x-workflow-secret',
        'x-webhook-secret',
        'authorization', // Exclude Basic Auth header
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
      let selectedWebhookNode = null;
      if (webhookTriggerNodes.length > 0) {
        // If there's only one webhook trigger, use it
        if (webhookTriggerNodes.length === 1) {
          selectedWebhookNode = webhookTriggerNodes[0];
          triggerNodeId = selectedWebhookNode.id;
        } else {
          // Multiple webhook triggers: find the one matching webhookId
          // First, try to find a node with matching webhookId
          const matchingNode = webhookTriggerNodes.find(
            node => node.data?.webhookId === webhookId
          );
          if (matchingNode) {
            selectedWebhookNode = matchingNode;
            triggerNodeId = matchingNode.id;
          } else {
            // If no matching webhookId, check if any node has no webhookId (defaults to workflowId)
            const defaultNode = webhookTriggerNodes.find(
              node =>
                !node.data?.webhookId ||
                node.data?.webhookId === workflowId.toString()
            );
            if (defaultNode) {
              selectedWebhookNode = defaultNode;
              triggerNodeId = defaultNode.id;
            } else {
              // Fallback: use first webhook trigger node
              selectedWebhookNode = webhookTriggerNodes[0];
              triggerNodeId = selectedWebhookNode.id;
              logger.warn('Multiple webhook triggers found, using first one', {
                workflowId,
                webhookId,
                triggerNodeId,
              });
            }
          }
        }
      }

      // Validate Secret (Header Secret - wie bisher)
      if (selectedWebhookNode?.data?.requireSecret) {
        const configuredSecret = selectedWebhookNode.data?.webhookSecret;
        if (!configuredSecret) {
          logger.error('Webhook secret required but not configured', {
            workflowId,
            triggerNodeId: selectedWebhookNode.id,
          });
          return reply.code(500).send({
            success: false,
            error: 'Webhook secret is misconfigured for this workflow',
          });
        }

        const providedSecretHeader =
          request.headers['x-workflow-secret'] ||
          request.headers['x-webhook-secret'];
        const providedSecret = Array.isArray(providedSecretHeader)
          ? providedSecretHeader[0]
          : providedSecretHeader;

        if (!providedSecret) {
          return reply.code(401).send({
            success: false,
            error:
              'Missing webhook secret. Include X-Workflow-Secret header in the request.',
          });
        }

        if (providedSecret !== configuredSecret) {
          logger.warn('Invalid webhook secret provided', {
            workflowId,
            triggerNodeId: selectedWebhookNode.id,
          });
          return reply.code(401).send({
            success: false,
            error: 'Invalid webhook secret provided.',
          });
        }
      }

      // Validate Basic Auth (neu)
      const basicAuthValidation = validateBasicAuth(
        request,
        selectedWebhookNode?.data || {}
      );
      if (!basicAuthValidation.valid) {
        logger.warn('Basic Auth validation failed', {
          workflowId,
          triggerNodeId: selectedWebhookNode?.id,
          error: basicAuthValidation.error,
        });
        return reply.code(401).send({
          success: false,
          error: basicAuthValidation.error,
        });
      }

      // Apply Rate Limiting (neu)
      const rateLimitResult = await applyRateLimit(
        request,
        webhookId,
        selectedWebhookNode?.data || {}
      );
      if (!rateLimitResult.allowed) {
        logger.warn('Rate limit exceeded for webhook', {
          workflowId,
          triggerNodeId: selectedWebhookNode?.id,
          ip: request.ip,
        });
        return reply.code(429).send({
          success: false,
          error: rateLimitResult.error,
          message: rateLimitResult.message,
          resetAt: rateLimitResult.resetAt,
        });
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

  // Custom Path Handler - handles all custom webhook paths
  // Pattern: /api/custom/*
  const customPathHandler = async (request, reply) => {
    try {
      // Extract path without query parameters
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      const customPath = url.pathname; // Path without query params
      const method = request.method;

      logger.info('Custom webhook path request', {
        customPath,
        method,
        fullUrl: request.url,
      });

      // Get custom path configuration
      const config = await getCustomPathConfig(customPath);

      if (!config) {
        logger.warn('Custom webhook path not found in registry', {
          customPath,
          method,
          fullUrl: request.url,
        });
        return reply.code(404).send({
          success: false,
          error: 'Custom webhook path not found',
          debug: {
            requestedPath: customPath,
            fullUrl: request.url,
          },
        });
      }

      logger.info('Custom webhook path found in registry', {
        customPath,
        workflowId: config.workflowId,
        nodeId: config.nodeId,
      });

      // Use the same webhook handler logic, but with workflowId from config
      const workflowId = config.workflowId;
      const nodeId = config.nodeId;

      // Get workflow
      const { db } = await import('#config/database.js');
      const { fullWorkflows } = await import(
        '#models/full-workflow.model.js'
      );
      const { eq } = await import('drizzle-orm');

      const [workflow] = await db
        .select()
        .from(fullWorkflows)
        .where(eq(fullWorkflows.id, workflowId))
        .limit(1);

      if (!workflow) {
        return reply.code(404).send({
          success: false,
          error: 'Workflow not found',
        });
      }

      if (!workflow.is_active) {
        return reply.code(400).send({
          success: false,
          error: 'Workflow is not active',
        });
      }

      // Get the webhook trigger node
      const workflowJson = workflow.workflow_json || {};
      const nodes = workflowJson.nodes || [];
      const selectedWebhookNode = nodes.find(node => node.id === nodeId);

      if (!selectedWebhookNode || selectedWebhookNode.type !== 'webhook-trigger') {
        return reply.code(500).send({
          success: false,
          error: 'Webhook trigger node not found',
        });
      }

      // Extract payload (same logic as webhookHandler)
      let payload = {};
      if (method === 'GET' || method === 'DELETE') {
        payload = request.query || {};
      } else if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        let body = request.body || {};
        if (typeof body === 'string') {
          try {
            body = JSON.parse(body);
          } catch {
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
        'x-workflow-secret',
        'x-webhook-secret',
        'authorization',
      ];
      for (const [key, value] of Object.entries(request.headers || {})) {
        if (!excludeHeaders.includes(key.toLowerCase())) {
          headers[key] = value;
        }
      }

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

      // Validate Secret
      if (selectedWebhookNode?.data?.requireSecret) {
        const configuredSecret = selectedWebhookNode.data?.webhookSecret;
        if (!configuredSecret) {
          logger.error('Webhook secret required but not configured', {
            workflowId,
            triggerNodeId: selectedWebhookNode.id,
          });
          return reply.code(500).send({
            success: false,
            error: 'Webhook secret is misconfigured for this workflow',
          });
        }

        const providedSecretHeader =
          request.headers['x-workflow-secret'] ||
          request.headers['x-webhook-secret'];
        const providedSecret = Array.isArray(providedSecretHeader)
          ? providedSecretHeader[0]
          : providedSecretHeader;

        if (!providedSecret) {
          return reply.code(401).send({
            success: false,
            error:
              'Missing webhook secret. Include X-Workflow-Secret header in the request.',
          });
        }

        if (providedSecret !== configuredSecret) {
          logger.warn('Invalid webhook secret provided', {
            workflowId,
            triggerNodeId: selectedWebhookNode.id,
          });
          return reply.code(401).send({
            success: false,
            error: 'Invalid webhook secret provided.',
          });
        }
      }

      // Validate Basic Auth
      const basicAuthValidation = validateBasicAuth(
        request,
        selectedWebhookNode?.data || {}
      );
      if (!basicAuthValidation.valid) {
        logger.warn('Basic Auth validation failed', {
          workflowId,
          triggerNodeId: selectedWebhookNode?.id,
          error: basicAuthValidation.error,
        });
        return reply.code(401).send({
          success: false,
          error: basicAuthValidation.error,
        });
      }

      // Apply Rate Limiting
      const rateLimitResult = await applyRateLimit(
        request,
        workflowId.toString(),
        selectedWebhookNode?.data || {}
      );
      if (!rateLimitResult.allowed) {
        logger.warn('Rate limit exceeded for custom webhook path', {
          workflowId,
          triggerNodeId: selectedWebhookNode?.id,
          ip: request.ip,
          customPath,
        });
        return reply.code(429).send({
          success: false,
          error: rateLimitResult.error,
          message: rateLimitResult.message,
          resetAt: rateLimitResult.resetAt,
        });
      }

      // Trigger workflow
      const triggerInput = {
        ...webhookData,
        triggerNodeId: nodeId,
      };

      const result = await triggerWorkflow(
        workflowId,
        workflow.user_id,
        triggerInput
      );

      logger.info('Custom webhook path triggered workflow', {
        customPath,
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
      logger.error('Error handling custom webhook path', {
        error: error.message,
        stack: error.stack,
        path: request.url,
      });
      return reply.code(500).send({
        success: false,
        error: error.message || 'Failed to trigger workflow',
      });
    }
  };

  // Register custom path routes (catch-all pattern)
  // Must be registered AFTER specific routes to avoid conflicts
  fastify.get('/api/custom/*', {
    attachValidation: true,
    handler: customPathHandler,
  });

  fastify.post('/api/custom/*', {
    attachValidation: true,
    handler: customPathHandler,
  });

  fastify.put('/api/custom/*', {
    attachValidation: true,
    handler: customPathHandler,
  });

  fastify.delete('/api/custom/*', {
    attachValidation: true,
    handler: customPathHandler,
  });

  fastify.patch('/api/custom/*', {
    attachValidation: true,
    handler: customPathHandler,
  });
}

export default webhookRoutes;
