import logger from '#config/logger.js';
import { googleOAuthService } from '#services/google-oauth.service.js';
import { gmailService } from '#services/gmail.service.js';
import { db } from '#config/database.js';
import { integrations } from '#models/integration.model.js';
import { eq, and } from 'drizzle-orm';
import { getRequiredAppUrl } from '#utils/app-url.utils.js';

// Helper: Detect if this is Fastify (has reply) or Express (has res)
const isFastify = reply =>
  reply &&
  typeof reply.send === 'function' &&
  typeof reply.status === 'function';

/**
 * GET /api/integrations/gmail/auth
 * Startet OAuth Flow - gibt URL zurück
 */
export const initiateAuth = async (req, res) => {
  const reply = res;
  const isFastifyRequest = isFastify(reply);
  try {
    const userId = req.user.id;
    const state = { userId, timestamp: Date.now() };

    const authUrl = googleOAuthService.getAuthUrl(
      userId,
      state,
      'GOOGLE_GMAIL'
    );

    logger.info(`Initiating Gmail OAuth for user ${userId}`);

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
    logger.error('Error initiating Gmail OAuth:', error);
    const errorResponse = { error: 'Failed to initiate OAuth' };

    if (isFastifyRequest) {
      reply.status(500).send(errorResponse);
      throw error;
    } else {
      return res.status(500).json(errorResponse);
    }
  }
};

/**
 * GET /api/integrations/gmail/callback
 * OAuth Callback - speichert Tokens
 */
export const handleCallback = async (req, res) => {
  const reply = res;
  const isFastifyRequest = isFastify(reply);
  const appUrl = getRequiredAppUrl();

  try {
    const { code, state } = req.query;

    if (!code) {
      const errorResponse = { error: 'Authorization code missing' };
      if (isFastifyRequest) {
        reply.status(400).send(errorResponse);
        throw new Error('Authorization code missing');
      } else {
        return res.status(400).json(errorResponse);
      }
    }

    let stateData;
    try {
      stateData = JSON.parse(state);
    } catch (error) {
      logger.error('Error parsing state:', error);
      const errorResponse = { error: 'Invalid state parameter' };
      if (isFastifyRequest) {
        reply.status(400).send(errorResponse);
        throw error;
      } else {
        return res.status(400).json(errorResponse);
      }
    }

    const userId = stateData.userId;

    if (!userId) {
      const errorResponse = { error: 'User ID missing in state' };
      if (isFastifyRequest) {
        reply.status(400).send(errorResponse);
        throw new Error('User ID missing in state');
      } else {
        return res.status(400).json(errorResponse);
      }
    }

    // Exchange code for tokens
    const tokens = await googleOAuthService.exchangeCodeForTokens(
      code,
      'GOOGLE_GMAIL'
    );

    // Get user email from Gmail API
    let email = 'unknown';
    try {
      email = await gmailService.getUserEmail(
        tokens.accessToken,
        tokens.refreshToken
      );
    } catch (error) {
      logger.warn('Error getting user email from Gmail:', error);
      // Continue anyway
    }

    // Check if integration already exists
    const existingIntegration = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.user_id, userId),
          eq(integrations.integration_type, 'GOOGLE_GMAIL')
        )
      )
      .limit(1);

    if (existingIntegration[0]) {
      // Update existing integration
      await db
        .update(integrations)
        .set({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_expires_at: tokens.expiresAt,
          email,
          is_complete: true,
          updated_at: new Date(),
        })
        .where(eq(integrations.id, existingIntegration[0].id));

      logger.info(`Updated Gmail integration for user ${userId}`);
    } else {
      // Create new integration
      await db.insert(integrations).values({
        user_id: userId,
        integration_type: 'GOOGLE_GMAIL',
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_expires_at: tokens.expiresAt,
        email,
        is_complete: true,
        is_active: true,
      });

      logger.info(`Created Gmail integration for user ${userId}`);
    }

    // Redirect back to workflow editor settings tab
    const redirectUrl = `${appUrl}/workflows?gmail=connected`;

    if (isFastifyRequest) {
      return reply.redirect(redirectUrl);
    } else {
      return res.redirect(redirectUrl);
    }
  } catch (error) {
    logger.error('Error handling Gmail OAuth callback:', error);
    const errorRedirectUrl = `${appUrl}/workflows?gmail=error&message=${encodeURIComponent(error.message)}`;

    if (isFastifyRequest) {
      return reply.redirect(errorRedirectUrl);
    } else {
      return res.redirect(errorRedirectUrl);
    }
  }
};

/**
 * GET /api/integrations/gmail/status
 * Get integration status
 */
export const getStatus = async (req, res) => {
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    const userId = req.user.id;

    const integration = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.user_id, userId),
          eq(integrations.integration_type, 'GOOGLE_GMAIL')
        )
      )
      .limit(1);

    if (!integration[0]) {
      const response = {
        connected: false,
        isComplete: false,
      };
      if (isFastifyRequest) {
        return reply.send(response);
      } else {
        return res.json(response);
      }
    }

    const response = {
      connected: true,
      isComplete: integration[0].is_complete,
      email: integration[0].email,
    };

    if (isFastifyRequest) {
      return reply.send(response);
    } else {
      return res.json(response);
    }
  } catch (error) {
    logger.error('Error getting Gmail integration status:', error);
    const errorResponse = { error: 'Failed to get status' };

    if (isFastifyRequest) {
      reply.status(500).send(errorResponse);
      throw error;
    } else {
      return res.status(500).json(errorResponse);
    }
  }
};

/**
 * DELETE /api/integrations/gmail
 * Disconnect Gmail integration
 */
export const disconnect = async (req, res) => {
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

    await db
      .delete(integrations)
      .where(
        and(
          eq(integrations.user_id, userId),
          eq(integrations.integration_type, 'GOOGLE_GMAIL')
        )
      );

    logger.info(`Disconnected Gmail integration for user ${userId}`);

    const response = {
      success: true,
      message: 'Gmail integration disconnected',
    };

    if (isFastifyRequest) {
      return reply.send(response);
    } else {
      return res.json(response);
    }
  } catch (error) {
    logger.error('Error disconnecting Gmail integration:', error);
    const errorResponse = {
      error: 'Failed to disconnect integration',
      message: error.message || 'Unknown error',
    };

    if (isFastifyRequest) {
      reply.status(500).send(errorResponse);
      throw error;
    } else {
      return res.status(500).json(errorResponse);
    }
  }
};
