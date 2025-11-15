import logger from '#config/logger.js';
import { googleOAuthService } from '#services/google-oauth.service.js';
import { googleCalendarService } from '#services/google-calendar.service.js';
import { db } from '#config/database.js';
import { integrations } from '#models/integration.model.js';
import { eq, and } from 'drizzle-orm';

// Helper: Detect if this is Fastify (has reply) or Express (has res)
const isFastify = reply =>
  reply &&
  typeof reply.send === 'function' &&
  typeof reply.status === 'function';

/**
 * GET /api/integrations/google-calendar/auth
 * Startet OAuth Flow - gibt URL zurück
 */
export const initiateAuth = async (req, res) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res; // Fastify uses 'reply', Express uses 'res'
  const isFastifyRequest = isFastify(reply);
  try {
    const userId = req.user.id;
    const state = { userId, timestamp: Date.now() };

    const authUrl = googleOAuthService.getAuthUrl(userId, state);

    logger.info(`Initiating Google Calendar OAuth for user ${userId}`);

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
    logger.error('Error initiating OAuth:', error);
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
 * GET /api/integrations/google-calendar/callback
 * OAuth Callback - speichert Tokens
 */
export const handleCallback = async (req, res) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res; // Fastify uses 'reply', Express uses 'res'
  const isFastifyRequest = isFastify(reply);

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
    const tokens = await googleOAuthService.exchangeCodeForTokens(code);

    // Get user email from Google Calendar API
    let email = 'unknown';
    try {
      email = await googleCalendarService.getUserEmail(
        tokens.accessToken,
        tokens.refreshToken
      );
    } catch (error) {
      logger.warn('Error getting user email from Google:', error);
      // Continue anyway
    }

    // Check if integration already exists
    const existingIntegration = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.user_id, userId),
          eq(integrations.integration_type, 'GOOGLE_CALENDAR')
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

      logger.info(`Updated Google Calendar integration for user ${userId}`);
    } else {
      // Create new integration
      await db.insert(integrations).values({
        user_id: userId,
        integration_type: 'GOOGLE_CALENDAR',
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_expires_at: tokens.expiresAt,
        email,
        timezone: 'Europe/Berlin', // Default, kann später geändert werden
        calendar_id: 'primary',
        mode: 'PERSONAL_ASSISTANT',
        minimum_notice_hours: 1,
        maximum_days_advance: 90,
        maximum_duration_hours: 8,
        is_complete: true,
        is_active: true,
      });

      logger.info(`Created Google Calendar integration for user ${userId}`);
    }

    // Redirect back to OpenAI test page with success flag
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const redirectUrl = `${frontendUrl}/test-openai?googleCalendar=connected`;

    if (isFastifyRequest) {
      return reply.redirect(redirectUrl);
    } else {
      return res.redirect(redirectUrl);
    }
  } catch (error) {
    logger.error('Error handling OAuth callback:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const errorRedirectUrl = `${frontendUrl}/integrations/google-calendar/error?message=${encodeURIComponent(error.message)}`;

    if (isFastifyRequest) {
      return reply.redirect(errorRedirectUrl);
    } else {
      return res.redirect(errorRedirectUrl);
    }
  }
};

/**
 * GET /api/integrations/google-calendar/status
 * Get integration status
 */
export const getStatus = async (req, res) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res; // Fastify uses 'reply', Express uses 'res'
  const isFastifyRequest = isFastify(reply);

  try {
    const userId = req.user.id;

    const integration = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.user_id, userId),
          eq(integrations.integration_type, 'GOOGLE_CALENDAR')
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
      timezone: integration[0].timezone,
      mode: integration[0].mode,
      minimumNoticeHours: integration[0].minimum_notice_hours,
      maximumDaysAdvance: integration[0].maximum_days_advance,
      maximumDurationHours: integration[0].maximum_duration_hours,
    };

    if (isFastifyRequest) {
      return reply.send(response);
    } else {
      return res.json(response);
    }
  } catch (error) {
    logger.error('Error getting integration status:', error);
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
 * DELETE /api/integrations/google-calendar
 * Disconnect Google Calendar integration
 */
export const disconnect = async (req, res) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res; // Fastify uses 'reply', Express uses 'res'
  const isFastifyRequest = isFastify(reply);

  try {
    const userId = req.user.id;

    await db
      .delete(integrations)
      .where(
        and(
          eq(integrations.user_id, userId),
          eq(integrations.integration_type, 'GOOGLE_CALENDAR')
        )
      );

    logger.info(`Disconnected Google Calendar integration for user ${userId}`);

    const response = {
      success: true,
      message: 'Google Calendar integration disconnected',
    };

    if (isFastifyRequest) {
      return reply.send(response);
    } else {
      return res.json(response);
    }
  } catch (error) {
    logger.error('Error disconnecting integration:', error);
    const errorResponse = { error: 'Failed to disconnect integration' };

    if (isFastifyRequest) {
      reply.status(500).send(errorResponse);
      throw error;
    } else {
      return res.status(500).json(errorResponse);
    }
  }
};

/**
 * PUT /api/integrations/google-calendar/settings
 * Update integration settings (timezone, notice/duration)
 */
export const updateSettings = async (req, res) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res; // Fastify uses 'reply', Express uses 'res'
  const isFastifyRequest = isFastify(reply);

  try {
    const userId = req.user.id;
    const {
      timezone,
      minimumNoticeHours,
      maximumDaysAdvance,
      maximumDurationHours,
      mode,
    } = req.body || {};

    const [existing] = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.user_id, userId),
          eq(integrations.integration_type, 'GOOGLE_CALENDAR')
        )
      )
      .limit(1);

    if (!existing) {
      const errorResponse = { error: 'Google Calendar not connected yet' };
      if (isFastifyRequest) {
        reply.status(400).send(errorResponse);
        throw new Error('Google Calendar not connected yet');
      } else {
        return res.status(400).json(errorResponse);
      }
    }

    await db
      .update(integrations)
      .set({
        timezone: timezone ?? existing.timezone,
        minimum_notice_hours:
          minimumNoticeHours ?? existing.minimum_notice_hours,
        maximum_days_advance:
          maximumDaysAdvance ?? existing.maximum_days_advance,
        maximum_duration_hours:
          maximumDurationHours ?? existing.maximum_duration_hours,
        mode: mode ?? existing.mode,
        updated_at: new Date(),
      })
      .where(eq(integrations.id, existing.id));

    const response = { success: true };

    if (isFastifyRequest) {
      return reply.send(response);
    } else {
      return res.json(response);
    }
  } catch (error) {
    logger.error('Error updating integration settings:', error);
    const errorResponse = { error: 'Failed to update settings' };

    if (isFastifyRequest) {
      reply.status(500).send(errorResponse);
      throw error;
    } else {
      return res.status(500).json(errorResponse);
    }
  }
};
