import logger from '#config/logger.js';
import { HUBSPOT_CLIENT_SECRET } from '#config/env.js';
import { db } from '#config/database.js';
import { integrations } from '#models/integration.model.js';
import { fullWorkflows } from '#models/full-workflow.model.js';
import { and, eq, inArray } from 'drizzle-orm';
import { hubspotOAuthService } from '#services/hubspot-oauth.service.js';
import { hubspotService } from '#services/hubspot.service.js';
import {
  claimHubSpotEvent,
  normalizeHubSpotEvent,
  validateHubSpotSignature,
} from '#services/hubspot-webhook.service.js';
import {
  getIntegration,
  updateIntegration,
} from '#services/integration.service.js';
import { triggerWorkflow } from '#services/full-workflow/trigger.service.js';
import { getRequiredAppUrl } from '#utils/app-url.utils.js';

const isFastify = reply =>
  reply &&
  typeof reply.send === 'function' &&
  typeof reply.status === 'function';

function send(reply, statusCode, payload) {
  if (isFastify(reply)) {
    return reply.status(statusCode).send(payload);
  }
  return reply.status(statusCode).json(payload);
}

function getAuthenticatedUser(req) {
  return req.user || req.request?.user || null;
}

function normalizeReturnUrl(returnUrl) {
  if (
    !returnUrl ||
    typeof returnUrl !== 'string' ||
    !returnUrl.startsWith('/') ||
    returnUrl.startsWith('//')
  ) {
    return '/fullWorkflows';
  }
  return returnUrl;
}

export const initiateAuth = async (req, res) => {
  try {
    const user = getAuthenticatedUser(req);
    if (!user?.id) {
      return send(res, 401, { error: 'Authentication required' });
    }

    const workflowId = req.query?.workflowId;
    const returnUrl = workflowId
      ? `/fullWorkflows/${workflowId}`
      : normalizeReturnUrl(
          req.query?.returnUrl || req.query?.redirectUrl || '/fullWorkflows'
        );

    const authUrl = hubspotOAuthService.getAuthUrl(user.id, { returnUrl });
    logger.info('Initiating HubSpot OAuth', { userId: user.id });

    return send(res, 200, {
      authUrl,
      message: 'Redirect user to this URL to authorize',
    });
  } catch (error) {
    logger.error('Error initiating HubSpot OAuth', {
      error: error.message,
    });
    return send(res, 500, {
      error: 'Failed to initiate OAuth',
      message: error.message,
    });
  }
};

export const handleCallback = async (req, res) => {
  const appUrl = getRequiredAppUrl();
  let returnUrl = '/fullWorkflows';

  try {
    const {
      code,
      state,
      error,
      error_description: errorDescription,
    } = req.query || {};

    if (error) {
      throw new Error(errorDescription || error);
    }

    const stateData = hubspotOAuthService.verifyState(state);
    returnUrl = normalizeReturnUrl(stateData.returnUrl);

    if (!code) {
      throw new Error('HubSpot authorization code is missing');
    }

    const tokens = await hubspotOAuthService.exchangeCodeForTokens(code);
    if (!tokens.externalAccountId) {
      throw new Error('HubSpot OAuth response did not include a portal ID');
    }

    const existingIntegration = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.user_id, stateData.userId),
          eq(integrations.integration_type, 'HUBSPOT')
        )
      )
      .limit(1);

    const integrationData = {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_expires_at: tokens.expiresAt,
      external_account_id: tokens.externalAccountId,
      granted_scopes: JSON.stringify(tokens.grantedScopes),
      is_complete: true,
      is_active: true,
      updated_at: new Date(),
    };

    if (existingIntegration[0]) {
      await db
        .update(integrations)
        .set(integrationData)
        .where(eq(integrations.id, existingIntegration[0].id));
    } else {
      await db.insert(integrations).values({
        user_id: stateData.userId,
        integration_type: 'HUBSPOT',
        ...integrationData,
      });
    }

    hubspotService.clearCachedToken(stateData.userId);
    logger.info('HubSpot OAuth connection saved', {
      userId: stateData.userId,
      portalId: tokens.externalAccountId,
    });

    return res.redirect(`${appUrl}${returnUrl}?hubspot=connected`);
  } catch (error) {
    logger.error('Error in HubSpot OAuth callback', {
      error: error.message,
    });
    return res.redirect(
      `${appUrl}${returnUrl}?hubspot=error&error=${encodeURIComponent(error.message || 'OAuth callback failed')}`
    );
  }
};

export const getStatus = async (req, res) => {
  try {
    const user = getAuthenticatedUser(req);
    if (!user?.id) {
      return send(res, 401, { error: 'Authentication required' });
    }

    const integration = await getIntegration(user.id, 'HUBSPOT');
    return send(res, 200, {
      connected: !!integration?.isActive,
      portalId: integration?.externalAccountId || null,
      scopes: integration?.grantedScopes || [],
    });
  } catch (error) {
    logger.error('Error getting HubSpot status', { error: error.message });
    return send(res, 500, {
      error: 'Failed to get HubSpot status',
      message: error.message,
    });
  }
};

export const disconnect = async (req, res) => {
  try {
    const user = getAuthenticatedUser(req);
    if (!user?.id) {
      return send(res, 401, { error: 'Authentication required' });
    }

    await updateIntegration(user.id, 'HUBSPOT', {
      is_active: false,
      is_complete: false,
    });
    hubspotService.clearCachedToken(user.id);

    return send(res, 200, {
      success: true,
      message: 'HubSpot disconnected',
    });
  } catch (error) {
    logger.error('Error disconnecting HubSpot', { error: error.message });
    return send(res, 500, {
      success: false,
      error: 'Failed to disconnect',
      message: error.message,
    });
  }
};

async function requireHubSpotAccessToken(req, res) {
  const user = getAuthenticatedUser(req);
  if (!user?.id) {
    send(res, 401, { error: 'Authentication required' });
    return null;
  }

  const integration = await getIntegration(user.id, 'HUBSPOT');
  if (!integration) {
    send(res, 400, { error: 'HubSpot not connected' });
    return null;
  }

  const { accessToken } = await hubspotService.getAuthenticatedClient(user.id);
  return { accessToken, userId: user.id };
}

export const getLists = async (req, res) => {
  try {
    const auth = await requireHubSpotAccessToken(req, res);
    if (!auth) return;

    const lists = await hubspotService.getLists(auth.accessToken);
    return send(res, 200, {
      success: true,
      data: lists.map(list => ({
        id: String(list.listId || list.id),
        name: list.name,
      })),
    });
  } catch (error) {
    logger.error('Error getting HubSpot lists', { error: error.message });
    return send(res, 500, {
      success: false,
      error: error.message || 'Failed to get lists',
    });
  }
};

export const getContacts = async (req, res) => {
  try {
    const auth = await requireHubSpotAccessToken(req, res);
    if (!auth) return;

    const limit = Math.min(
      Math.max(Number.parseInt(req.query?.limit || '100', 10), 1),
      100
    );
    const contacts = await hubspotService.getContacts(auth.accessToken, limit);

    return send(res, 200, {
      success: true,
      data: contacts.map(contact => {
        const properties = contact.properties || {};
        return {
          id: contact.id,
          email: properties.email || '',
          firstName: properties.firstname || '',
          lastName: properties.lastname || '',
          phone: properties.phone || '',
          company: properties.company || '',
          displayName:
            `${properties.firstname || ''} ${properties.lastname || ''}`.trim() ||
            properties.email ||
            contact.id,
        };
      }),
    });
  } catch (error) {
    logger.error('Error getting HubSpot contacts', { error: error.message });
    return send(res, 500, {
      success: false,
      error: error.message || 'Failed to get contacts',
    });
  }
};

export const getCompanies = async (req, res) => {
  try {
    const auth = await requireHubSpotAccessToken(req, res);
    if (!auth) return;

    const limit = Math.min(
      Math.max(Number.parseInt(req.query?.limit || '100', 10), 1),
      100
    );
    const companies = await hubspotService.getCompanies(
      auth.accessToken,
      limit
    );

    return send(res, 200, {
      success: true,
      data: companies.map(company => ({
        id: company.id,
        name: company.properties?.name || '',
        domain: company.properties?.domain || '',
        phone: company.properties?.phone || '',
        city: company.properties?.city || '',
        country: company.properties?.country || '',
        industry: company.properties?.industry || '',
        displayName: company.properties?.name || company.id,
      })),
    });
  } catch (error) {
    logger.error('Error getting HubSpot companies', { error: error.message });
    return send(res, 500, {
      success: false,
      error: error.message || 'Failed to get companies',
    });
  }
};

function getRequestUrl(req) {
  const rawUrl =
    req.rawUrl || req.url || req.request?.raw?.url || req.request?.url;
  if (!rawUrl) {
    throw new Error('HubSpot webhook request URL is unavailable');
  }
  return new URL(rawUrl, getRequiredAppUrl()).toString();
}

async function loadWebhookTargets(portalIds) {
  if (portalIds.length === 0) {
    return { connectedIntegrations: [], workflows: [] };
  }

  const connectedIntegrations = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.integration_type, 'HUBSPOT'),
        eq(integrations.is_active, true),
        inArray(integrations.external_account_id, portalIds)
      )
    );

  const userIds = [
    ...new Set(connectedIntegrations.map(integration => integration.user_id)),
  ];
  if (userIds.length === 0) {
    return { connectedIntegrations, workflows: [] };
  }

  const workflows = await db
    .select()
    .from(fullWorkflows)
    .where(
      and(
        eq(fullWorkflows.is_active, true),
        inArray(fullWorkflows.user_id, userIds)
      )
    );

  return { connectedIntegrations, workflows };
}

export const handleWebhook = async (req, res) => {
  try {
    const webhookPayload = req.body || [];
    const rawBody = req.rawBody || JSON.stringify(webhookPayload);
    const signature = req.headers?.['x-hubspot-signature-v3'];
    const timestamp = req.headers?.['x-hubspot-request-timestamp'];

    const signatureIsValid = validateHubSpotSignature({
      clientSecret: HUBSPOT_CLIENT_SECRET,
      method: req.method || 'POST',
      requestUrl: getRequestUrl(req),
      rawBody,
      timestamp,
      signature,
    });

    if (!signatureIsValid) {
      logger.warn('Rejected HubSpot webhook with invalid signature');
      return send(res, 401, {
        success: false,
        error: 'Invalid HubSpot webhook signature',
      });
    }

    const rawEvents = Array.isArray(webhookPayload)
      ? webhookPayload
      : [webhookPayload];
    const events = rawEvents.map(normalizeHubSpotEvent);
    const portalIds = [
      ...new Set(
        events
          .map(event => event.portalId)
          .filter(Boolean)
          .map(portalId => String(portalId))
      ),
    ];

    const { connectedIntegrations, workflows } =
      await loadWebhookTargets(portalIds);
    const triggerJobs = [];

    for (const event of events) {
      if (!event.portalId || !event.subscriptionType) {
        logger.warn('Skipping incomplete HubSpot webhook event', {
          hasPortalId: !!event.portalId,
          hasSubscriptionType: !!event.subscriptionType,
        });
        continue;
      }

      if (!(await claimHubSpotEvent(event))) {
        logger.info('Skipping duplicate HubSpot webhook event', {
          portalId: event.portalId,
          eventId: event.eventId,
        });
        continue;
      }

      const portalIntegrations = connectedIntegrations.filter(
        integration =>
          String(integration.external_account_id) === String(event.portalId)
      );

      for (const integration of portalIntegrations) {
        const userWorkflows = workflows.filter(
          workflow => workflow.user_id === integration.user_id
        );

        for (const workflow of userWorkflows) {
          const nodes = workflow.workflow_json?.nodes || [];
          const matchingTriggers = nodes.filter(
            node =>
              node.type === 'hubspot-trigger' &&
              (node.data?.eventTypes || []).includes(event.subscriptionType)
          );

          for (const triggerNode of matchingTriggers) {
            triggerJobs.push(
              triggerWorkflow(workflow.id, workflow.user_id, {
                triggerNodeId: triggerNode.id,
                _hubspot: event,
                ...event,
              })
            );
          }
        }
      }
    }

    const results = await Promise.allSettled(triggerJobs);
    const failed = results.filter(result => result.status === 'rejected');
    if (failed.length > 0) {
      logger.error('Some HubSpot webhook workflow triggers failed', {
        failed: failed.length,
        total: results.length,
      });
    }

    return send(res, 200, {
      success: true,
      eventsReceived: events.length,
      workflowsTriggered: results.length - failed.length,
    });
  } catch (error) {
    logger.error('Error handling HubSpot webhook', {
      error: error.message,
      stack: error.stack,
    });
    return send(res, 500, {
      success: false,
      error: 'Failed to process HubSpot webhook',
    });
  }
};
