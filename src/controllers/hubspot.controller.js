import logger from '#config/logger.js';
import { hubspotOAuthService } from '#services/hubspot-oauth.service.js';
import { hubspotService } from '#services/hubspot.service.js';
import { hubspotWebhookService } from '#services/hubspot-webhook.service.js';
import { db } from '#config/database.js';
import { integrations } from '#models/integration.model.js';
import { eq, and } from 'drizzle-orm';
import {
  getIntegration,
  updateIntegration,
} from '#services/integration.service.js';

// Helper: Detect if this is Fastify (has reply) or Express (has res)
const isFastify = reply =>
  reply &&
  typeof reply.send === 'function' &&
  typeof reply.status === 'function';

/**
 * GET /api/integrations/hubspot/auth
 * Start OAuth Flow - returns URL
 */
export const initiateAuth = async (req, res) => {
  const reply = res;
  const isFastifyRequest = isFastify(reply);
  try {
    const user = req.user || (req.request && req.request.user) || null;
    if (!user || !user.id) {
      logger.error('Authentication failed - user not found in request');
      const errorResponse = { error: 'Authentication required' };
      if (isFastifyRequest) {
        reply.status(401).send(errorResponse);
        throw new Error('Authentication required');
      } else {
        return res.status(401).json(errorResponse);
      }
    }
    const userId = user.id;
    const returnUrl = req.query?.returnUrl || req.query?.redirectUrl || null;
    const workflowId = req.query?.workflowId || null;

    let finalReturnUrl = null;
    if (workflowId) {
      finalReturnUrl = `/fullWorkflows/${workflowId}`;
    } else if (returnUrl) {
      finalReturnUrl = returnUrl;
    } else {
      const referer = req.headers?.referer || req.headers?.referrer;
      if (referer) {
        try {
          const url = new URL(referer);
          finalReturnUrl = url.pathname;
        } catch {
          // Ignore
        }
      }
    }

    const state = {
      userId,
      timestamp: Date.now(),
      returnUrl: finalReturnUrl,
      integrationType: 'HUBSPOT',
    };

    const authUrl = hubspotOAuthService.getAuthUrl(userId, state);
    logger.info(`Initiating HubSpot OAuth for user ${userId}`);
    const response = {
      authUrl,
      message: 'Redirect user to this URL to authorize',
    };
    if (isFastifyRequest) {
      return reply.send(response);
    } else {
      return res.json(response);
    }
  } catch (error) {
    logger.error('Error initiating HubSpot OAuth:', error);
    const errorResponse = {
      error: 'Failed to initiate OAuth',
      message: error.message || 'Unknown error',
    };
    if (isFastifyRequest) {
      return reply.status(500).send(errorResponse);
    } else {
      return res.status(500).json(errorResponse);
    }
  }
};

export const handleCallback = async (req, res) => {
  const reply = res;
  try {
    const { code, state } = req.query;
    if (!code) {
      throw new Error('Authorization code not found');
    }
    const stateData = JSON.parse(state);
    const userId = stateData.userId;

    const tokens = await hubspotOAuthService.exchangeCodeForTokens(code);

    const existingIntegration = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.user_id, userId),
          eq(integrations.integration_type, 'HUBSPOT')
        )
      )
      .limit(1);

    if (existingIntegration[0]) {
      await db
        .update(integrations)
        .set({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_expires_at: tokens.expiresAt,
          is_complete: true,
          is_active: true,
          updated_at: new Date(),
        })
        .where(eq(integrations.id, existingIntegration[0].id));

      logger.info(`Updated HubSpot integration for user ${userId}`, {
        integrationId: existingIntegration[0].id,
        isActive: true,
      });
    } else {
      const [newIntegration] = await db
        .insert(integrations)
        .values({
          user_id: userId,
          integration_type: 'HUBSPOT',
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_expires_at: tokens.expiresAt,
          is_complete: true,
          is_active: true,
        })
        .returning();

      logger.info(`Created HubSpot integration for user ${userId}`, {
        integrationId: newIntegration?.id,
        isActive: true,
      });
    }

    const headers = req.headers || {};
    let origin = headers.origin;
    if (!origin && headers.referer) {
      try {
        const refererUrl = new URL(headers.referer);
        origin = refererUrl.origin;
      } catch {
        // Ignore
      }
    }
    if (!origin) {
      origin = process.env.FRONTEND_URL || 'http://localhost:5173';
    }
    const returnUrl =
      stateData.returnUrl || stateData.redirectUrl || '/fullWorkflows';
    const finalReturnUrl = returnUrl.startsWith('/')
      ? returnUrl
      : `/${returnUrl}`;
    const redirectUrl = `${origin}${finalReturnUrl}?hubspot=connected`;
    logger.info(`Redirecting user ${userId} to ${redirectUrl}`);
    return reply.redirect(redirectUrl);
  } catch (error) {
    logger.error('Error in HubSpot OAuth callback:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const returnUrl = req.query?.returnUrl || '/fullWorkflows';
    return reply.redirect(
      `${frontendUrl}${returnUrl}?hubspot=error&error=${encodeURIComponent(error.message || 'OAuth callback failed')}`
    );
  }
};

export const getStatus = async (req, res) => {
  const reply = res;
  const isFastifyRequest = isFastify(reply);
  try {
    const user = req.user || (req.request && req.request.user) || null;
    if (!user || !user.id) {
      logger.error('Authentication failed - user not found in request');
      const errorResponse = { error: 'Authentication required' };
      if (isFastifyRequest) {
        return reply.status(401).send(errorResponse);
      } else {
        return res.status(401).json(errorResponse);
      }
    }
    const userId = user.id;
    const integration = await getIntegration(userId, 'HUBSPOT');
    const connected = !!integration?.isActive;
    const response = {
      connected,
      email: integration?.email || null, // HubSpot doesn't directly provide email in OAuth, might need separate API call
    };
    if (isFastifyRequest) {
      return reply.send(response);
    } else {
      return res.json(response);
    }
  } catch (error) {
    logger.error('Error getting HubSpot status:', error);
    const errorResponse = {
      connected: false,
      error: 'Failed to get status',
      message: error.message || 'Unknown error',
    };
    if (isFastifyRequest) {
      return reply.status(500).send(errorResponse);
    } else {
      return res.status(500).json(errorResponse);
    }
  }
};

export const disconnect = async (req, res) => {
  const reply = res;
  const isFastifyRequest = isFastify(reply);
  try {
    const user = req.user || (req.request && req.request.user) || null;
    if (!user || !user.id) {
      logger.error('Authentication failed - user not found in request');
      const errorResponse = { error: 'Authentication required' };
      if (isFastifyRequest) {
        return reply.status(401).send(errorResponse);
      } else {
        return res.status(401).json(errorResponse);
      }
    }
    const userId = user.id;
    await updateIntegration(userId, 'HUBSPOT', { is_active: false });
    logger.info(`Disconnected HubSpot integration for user ${userId}`);
    const response = { success: true, message: 'HubSpot disconnected' };
    if (isFastifyRequest) {
      return reply.send(response);
    } else {
      return res.json(response);
    }
  } catch (error) {
    logger.error('Error disconnecting HubSpot:', error);
    const errorResponse = {
      success: false,
      error: 'Failed to disconnect',
      message: error.message || 'Unknown error',
    };
    if (isFastifyRequest) {
      return reply.status(500).send(errorResponse);
    } else {
      return res.status(500).json(errorResponse);
    }
  }
};

export const getLists = async (req, res) => {
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    const user = req.user || (req.request && req.request.user) || null;

    if (!user || !user.id) {
      const errorResponse = { error: 'Authentication required' };
      if (isFastifyRequest) {
        return reply.status(401).send(errorResponse);
      } else {
        return res.status(401).json(errorResponse);
      }
    }

    const userId = user.id;

    const integration = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.user_id, userId),
          eq(integrations.integration_type, 'HUBSPOT'),
          eq(integrations.is_active, true)
        )
      )
      .limit(1);

    if (!integration[0]) {
      const errorResponse = { error: 'HubSpot not connected' };
      if (isFastifyRequest) {
        return reply.status(400).send(errorResponse);
      } else {
        return res.status(400).json(errorResponse);
      }
    }

    try {
      const { accessToken } =
        await hubspotService.getAuthenticatedClient(userId);
      const lists = await hubspotService.getLists(accessToken);

      logger.info('HubSpot lists retrieved', {
        userId,
        count: lists.length,
      });

      const result = {
        success: true,
        data: lists.map(list => ({
          id: list.listId,
          name: list.name,
        })),
      };

      if (isFastifyRequest) {
        return reply.send(result);
      } else {
        return res.json(result);
      }
    } catch (error) {
      logger.error('Error in getLists controller:', error);
      const errorResponse = {
        success: false,
        error: error.message || 'Failed to get lists',
      };
      if (isFastifyRequest) {
        return reply.status(500).send(errorResponse);
      } else {
        return res.status(500).json(errorResponse);
      }
    }
  } catch (error) {
    logger.error('Error getting HubSpot lists:', error);
    const errorResponse = {
      error: 'Failed to get lists',
      message: error.message || 'Unknown error',
    };

    if (isFastifyRequest) {
      return reply.status(500).send(errorResponse);
    } else {
      return res.status(500).json(errorResponse);
    }
  }
};

export const getContacts = async (req, res) => {
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    const user = req.user || (req.request && req.request.user) || null;

    if (!user || !user.id) {
      const errorResponse = { error: 'Authentication required' };
      if (isFastifyRequest) {
        return reply.status(401).send(errorResponse);
      } else {
        return res.status(401).json(errorResponse);
      }
    }

    const userId = user.id;
    const limit = parseInt(req.query?.limit || '100', 10);

    const integration = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.user_id, userId),
          eq(integrations.integration_type, 'HUBSPOT'),
          eq(integrations.is_active, true)
        )
      )
      .limit(1);

    if (!integration[0]) {
      const errorResponse = { error: 'HubSpot not connected' };
      if (isFastifyRequest) {
        return reply.status(400).send(errorResponse);
      } else {
        return res.status(400).json(errorResponse);
      }
    }

    try {
      const { accessToken } =
        await hubspotService.getAuthenticatedClient(userId);
      const contacts = await hubspotService.getContacts(accessToken, limit);

      logger.info('HubSpot contacts retrieved', {
        userId,
        count: contacts.length,
      });

      const result = {
        success: true,
        data: contacts.map(contact => ({
          id: contact.id,
          email: contact.properties.email,
          displayName:
            `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim() ||
            contact.properties.email,
        })),
      };

      if (isFastifyRequest) {
        return reply.send(result);
      } else {
        return res.json(result);
      }
    } catch (error) {
      logger.error('Error in getContacts controller:', error);
      const errorResponse = {
        success: false,
        error: error.message || 'Failed to get contacts',
      };
      if (isFastifyRequest) {
        return reply.status(500).send(errorResponse);
      } else {
        return res.status(500).json(errorResponse);
      }
    }
  } catch (error) {
    logger.error('Error getting HubSpot contacts:', error);
    const errorResponse = {
      error: 'Failed to get contacts',
      message: error.message || 'Unknown error',
    };

    if (isFastifyRequest) {
      return reply.status(500).send(errorResponse);
    } else {
      return res.status(500).json(errorResponse);
    }
  }
};

/**
 * GET /api/integrations/hubspot/companies
 * Get all companies from HubSpot
 */
export const getCompanies = async (req, res) => {
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    const user = req.user || (req.request && req.request.user) || null;

    if (!user || !user.id) {
      const errorResponse = { error: 'Authentication required' };
      if (isFastifyRequest) {
        return reply.status(401).send(errorResponse);
      } else {
        return res.status(401).json(errorResponse);
      }
    }

    const userId = user.id;
    const limit = parseInt(req.query?.limit || '100', 10);

    const integration = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.user_id, userId),
          eq(integrations.integration_type, 'HUBSPOT'),
          eq(integrations.is_active, true)
        )
      )
      .limit(1);

    if (!integration[0]) {
      const errorResponse = { error: 'HubSpot not connected' };
      if (isFastifyRequest) {
        return reply.status(400).send(errorResponse);
      } else {
        return res.status(400).json(errorResponse);
      }
    }

    try {
      const { accessToken } =
        await hubspotService.getAuthenticatedClient(userId);
      const companies = await hubspotService.getCompanies(accessToken, limit);

      logger.info('HubSpot companies retrieved', {
        userId,
        count: companies.length,
      });

      const result = {
        success: true,
        data: companies.map(company => ({
          id: company.id,
          name: company.properties?.name || '',
          domain: company.properties?.domain || '',
          phone: company.properties?.phone || '',
          city: company.properties?.city || '',
          country: company.properties?.country || '',
          industry: company.properties?.industry || '',
          displayName: company.properties?.name || 'Unknown',
        })),
      };

      if (isFastifyRequest) {
        return reply.send(result);
      } else {
        return res.json(result);
      }
    } catch (error) {
      logger.error('Error in getCompanies controller:', error);
      const errorResponse = {
        success: false,
        error: error.message || 'Failed to get companies',
      };
      if (isFastifyRequest) {
        return reply.status(500).send(errorResponse);
      } else {
        return res.status(500).json(errorResponse);
      }
    }
  } catch (error) {
    logger.error('Error getting HubSpot companies:', error);
    const errorResponse = {
      error: 'Failed to get companies',
      message: error.message || 'Unknown error',
    };

    if (isFastifyRequest) {
      return reply.status(500).send(errorResponse);
    } else {
      return res.status(500).json(errorResponse);
    }
  }
};

/**
 * POST /api/integrations/hubspot/webhook
 * Handle incoming HubSpot webhook events
 * NO AUTH - HubSpot sends webhooks
 */
export const handleWebhook = async (req, res) => {
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    const { workflowId } = req.query || {};
    const webhookPayload = req.body || {};

    // ENHANCED LOGGING - Log everything to debug
    logger.info('HubSpot webhook received - FULL DETAILS', {
      workflowId,
      method: req.method || 'POST',
      url: req.url,
      headers: {
        'content-type': req.headers?.['content-type'],
        'user-agent': req.headers?.['user-agent'],
        'x-hubspot-signature': req.headers?.['x-hubspot-signature'],
        'x-hubspot-request-timestamp':
          req.headers?.['x-hubspot-request-timestamp'],
      },
      query: req.query || {},
      bodyType: Array.isArray(webhookPayload) ? 'array' : typeof webhookPayload,
      bodyIsArray: Array.isArray(webhookPayload),
      bodyLength: Array.isArray(webhookPayload)
        ? webhookPayload.length
        : Object.keys(webhookPayload).length,
      bodyPreview: JSON.stringify(webhookPayload).substring(0, 1000),
    });

    if (!workflowId) {
      logger.warn('HubSpot webhook called without workflowId');
      const errorResponse = {
        success: false,
        error: 'workflowId is required',
      };
      if (isFastifyRequest) {
        return reply.status(400).send(errorResponse);
      } else {
        return res.status(400).json(errorResponse);
      }
    }

    // Handle HubSpot webhook format - it might be an array of events
    let events = [];
    if (Array.isArray(webhookPayload)) {
      events = webhookPayload;
      logger.info('HubSpot webhook contains array of events', {
        eventCount: events.length,
        workflowId,
      });
    } else if (
      webhookPayload.subscriptionId ||
      webhookPayload.subscriptionType ||
      webhookPayload.eventType
    ) {
      // Single event object
      events = [webhookPayload];
      logger.info('HubSpot webhook contains single event', {
        workflowId,
        subscriptionId: webhookPayload.subscriptionId,
        subscriptionType:
          webhookPayload.subscriptionType || webhookPayload.eventType,
      });
    } else {
      // Try to find events in nested structure
      events = webhookPayload.events || webhookPayload.data || [webhookPayload];
      logger.info('HubSpot webhook - extracted events from nested structure', {
        eventCount: events.length,
        payloadKeys: Object.keys(webhookPayload),
        workflowId,
      });
    }

    if (events.length === 0) {
      logger.warn('HubSpot webhook received but no events found', {
        workflowId,
        payload: webhookPayload,
      });
      // Still return 200 to acknowledge receipt
      const response = {
        success: true,
        message: 'Webhook received but no events found',
      };
      if (isFastifyRequest) {
        return reply.status(200).send(response);
      } else {
        return res.status(200).json(response);
      }
    }

    // Load workflow
    const { getFullWorkflow } = await import(
      '#services/full-workflow.service.js'
    );
    const { triggerWorkflow } = await import(
      '#services/full-workflow/trigger.service.js'
    );

    let workflow;
    try {
      workflow = await getFullWorkflow(parseInt(workflowId, 10), null);
    } catch (error) {
      logger.error('Failed to load workflow for HubSpot webhook', {
        workflowId,
        error: error.message,
      });
      const errorResponse = {
        success: false,
        error: 'Workflow not found',
      };
      if (isFastifyRequest) {
        return reply.status(404).send(errorResponse);
      } else {
        return res.status(404).json(errorResponse);
      }
    }

    if (!workflow || !workflow.is_active) {
      logger.warn('Workflow not found or not active for HubSpot webhook', {
        workflowId,
        isActive: workflow?.is_active,
      });
      const errorResponse = {
        success: false,
        error: 'Workflow not found or not active',
      };
      if (isFastifyRequest) {
        return reply.status(404).send(errorResponse);
      } else {
        return res.status(404).json(errorResponse);
      }
    }

    // Find HubSpot trigger node
    const workflowJson = workflow.workflow_json || {};
    const nodes = workflowJson.nodes || [];
    const hubspotTriggerNodes = nodes.filter(
      node => node.type === 'hubspot-trigger'
    );

    if (hubspotTriggerNodes.length === 0) {
      logger.error('No HubSpot trigger node found in workflow', {
        workflowId,
      });
      const errorResponse = {
        success: false,
        error: 'No HubSpot trigger node found',
      };
      if (isFastifyRequest) {
        return reply.status(500).send(errorResponse);
      } else {
        return res.status(500).json(errorResponse);
      }
    }

    // Use first HubSpot trigger node (if multiple exist)
    const hubspotTriggerNode = hubspotTriggerNodes[0];

    // Trigger workflow for each event
    const userId = workflow.user_id;
    const triggerPromises = events.map((event, index) => {
      // Normalize event structure - HubSpot might send different formats
      const normalizedEvent = {
        subscriptionId: event.subscriptionId || event.subscription?.id,
        subscriptionType:
          event.subscriptionType || event.eventType || event.type,
        objectId: event.objectId || event.object?.id,
        properties: event.properties || event.object?.properties || {},
        occurredAt:
          event.occurredAt || event.timestamp || new Date().toISOString(),
        portalId: event.portalId || event.portal?.id,
        changeFlag: event.changeFlag,
        changeSource: event.changeSource,
        eventId: event.eventId || event.id,
        appId: event.appId,
        attemptNumber: event.attemptNumber,
        sourceId: event.sourceId,
        // Include all original event data
        ...event,
      };

      const triggerInput = {
        triggerNodeId: hubspotTriggerNode.id,
        _hubspot: normalizedEvent,
        ...normalizedEvent, // Also spread properties directly for easy access
      };

      logger.info('Triggering workflow for HubSpot event', {
        workflowId,
        eventIndex: index,
        totalEvents: events.length,
        triggerNodeId: hubspotTriggerNode.id,
        subscriptionId: normalizedEvent.subscriptionId,
        subscriptionType: normalizedEvent.subscriptionType,
        objectId: normalizedEvent.objectId,
      });

      return triggerWorkflow(
        parseInt(workflowId, 10),
        userId,
        triggerInput
      ).catch(error => {
        logger.error('Error triggering workflow from HubSpot webhook', {
          workflowId,
          eventIndex: index,
          error: error.message,
          errorStack: error.stack,
        });
      });
    });

    // Wait for all triggers (but don't block the response)
    Promise.all(triggerPromises).then(results => {
      logger.info('All HubSpot webhook events processed', {
        workflowId,
        eventCount: events.length,
        results: results.map(r => ({
          success: r?.success,
          eventId: r?.eventId,
        })),
      });
    });

    logger.info('HubSpot webhook processed, workflow triggered', {
      workflowId,
      eventCount: events.length,
    });

    // Always return 200 to HubSpot (webhook acknowledged)
    const response = {
      success: true,
      message: 'Webhook received and processed',
      eventsProcessed: events.length,
    };
    if (isFastifyRequest) {
      return reply.status(200).send(response);
    } else {
      return res.status(200).json(response);
    }
  } catch (error) {
    logger.error('Error handling HubSpot webhook', {
      error: error.message,
      stack: error.stack,
      body: req.body,
    });
    // Always return 200 to HubSpot (even on error, to prevent retries)
    const response = {
      success: false,
      error: error.message || 'Unknown error',
    };
    if (isFastifyRequest) {
      return reply.status(200).send(response);
    } else {
      return res.status(200).json(response);
    }
  }
};

/**
 * POST /api/integrations/hubspot/webhooks/subscriptions
 * Create webhook subscriptions for HubSpot events
 */
export const createWebhookSubscription = async (req, res) => {
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    const user = req.user || (req.request && req.request.user) || null;

    if (!user || !user.id) {
      const errorResponse = { error: 'Authentication required' };
      if (isFastifyRequest) {
        return reply.status(401).send(errorResponse);
      } else {
        return res.status(401).json(errorResponse);
      }
    }

    const userId = user.id;
    const { eventTypes, webhookUrl } = req.body || {};

    if (!eventTypes || !Array.isArray(eventTypes) || eventTypes.length === 0) {
      const errorResponse = {
        error: 'eventTypes array is required',
      };
      if (isFastifyRequest) {
        return reply.status(400).send(errorResponse);
      } else {
        return res.status(400).json(errorResponse);
      }
    }

    if (!webhookUrl) {
      const errorResponse = {
        error: 'webhookUrl is required',
      };
      if (isFastifyRequest) {
        return reply.status(400).send(errorResponse);
      } else {
        return res.status(400).json(errorResponse);
      }
    }

    // Get authenticated client
    const { accessToken } = await hubspotService.getAuthenticatedClient(userId);

    // Create subscriptions
    const result = await hubspotWebhookService.createMultipleSubscriptions(
      accessToken,
      eventTypes,
      webhookUrl
    );

    logger.info('HubSpot webhook subscriptions created', {
      userId,
      eventTypes,
      subscriptionCount: result.subscriptions.length,
    });

    const response = {
      success: true,
      subscriptions: result.subscriptions,
      errors: result.errors || [],
    };

    if (isFastifyRequest) {
      return reply.send(response);
    } else {
      return res.json(response);
    }
  } catch (error) {
    logger.error('Error creating HubSpot webhook subscriptions:', error);
    const errorResponse = {
      success: false,
      error: 'Failed to create subscriptions',
      message: error.message || 'Unknown error',
    };
    if (isFastifyRequest) {
      return reply.status(500).send(errorResponse);
    } else {
      return res.status(500).json(errorResponse);
    }
  }
};

/**
 * DELETE /api/integrations/hubspot/webhooks/subscriptions
 * Delete webhook subscriptions
 */
export const deleteWebhookSubscription = async (req, res) => {
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    const user = req.user || (req.request && req.request.user) || null;

    if (!user || !user.id) {
      const errorResponse = { error: 'Authentication required' };
      if (isFastifyRequest) {
        return reply.status(401).send(errorResponse);
      } else {
        return res.status(401).json(errorResponse);
      }
    }

    const userId = user.id;
    const { subscriptionIds } = req.body || {};

    if (
      !subscriptionIds ||
      !Array.isArray(subscriptionIds) ||
      subscriptionIds.length === 0
    ) {
      const errorResponse = {
        error: 'subscriptionIds array is required',
      };
      if (isFastifyRequest) {
        return reply.status(400).send(errorResponse);
      } else {
        return res.status(400).json(errorResponse);
      }
    }

    // Get authenticated client
    const { accessToken } = await hubspotService.getAuthenticatedClient(userId);

    // Delete subscriptions
    await hubspotWebhookService.deleteMultipleSubscriptions(
      accessToken,
      subscriptionIds
    );

    logger.info('HubSpot webhook subscriptions deleted', {
      userId,
      subscriptionIds,
    });

    const response = {
      success: true,
      message: 'Subscriptions deleted successfully',
    };

    if (isFastifyRequest) {
      return reply.send(response);
    } else {
      return res.json(response);
    }
  } catch (error) {
    logger.error('Error deleting HubSpot webhook subscriptions:', error);
    const errorResponse = {
      success: false,
      error: 'Failed to delete subscriptions',
      message: error.message || 'Unknown error',
    };
    if (isFastifyRequest) {
      return reply.status(500).send(errorResponse);
    } else {
      return res.status(500).json(errorResponse);
    }
  }
};

/**
 * GET /api/integrations/hubspot/webhooks/subscriptions
 * Get all webhook subscriptions
 */
export const getWebhookSubscriptions = async (req, res) => {
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    const user = req.user || (req.request && req.request.user) || null;

    if (!user || !user.id) {
      const errorResponse = { error: 'Authentication required' };
      if (isFastifyRequest) {
        return reply.status(401).send(errorResponse);
      } else {
        return res.status(401).json(errorResponse);
      }
    }

    const userId = user.id;

    // Get authenticated client
    const { accessToken } = await hubspotService.getAuthenticatedClient(userId);

    // Get subscriptions
    const subscriptions =
      await hubspotWebhookService.getSubscriptions(accessToken);

    logger.info('HubSpot webhook subscriptions retrieved', {
      userId,
      count: subscriptions.length,
    });

    const response = {
      success: true,
      data: subscriptions.map(sub => ({
        id: sub.id,
        eventType: sub.eventType,
        active: sub.active,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
      })),
    };

    if (isFastifyRequest) {
      return reply.send(response);
    } else {
      return res.json(response);
    }
  } catch (error) {
    logger.error('Error getting HubSpot webhook subscriptions:', error);
    const errorResponse = {
      success: false,
      error: 'Failed to get subscriptions',
      message: error.message || 'Unknown error',
    };
    if (isFastifyRequest) {
      return reply.status(500).send(errorResponse);
    } else {
      return res.status(500).json(errorResponse);
    }
  }
};
