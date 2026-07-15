import logger from '#config/logger.js';
import { google } from 'googleapis';
import { googleOAuthService } from '#services/google-oauth.service.js';
import { googleSheetsService } from '#services/google-sheets.service.js';
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
 * GET /api/integrations/google-sheets/auth
 * Startet OAuth Flow - gibt URL zurück
 */
export const initiateAuth = async (req, res) => {
  const reply = res;
  const isFastifyRequest = isFastify(reply);
  try {
    // Support both Fastify (request.user) and Express (req.user)
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

    // Get return URL from query params or use current workflow ID
    const returnUrl = req.query?.returnUrl || req.query?.redirectUrl || null;
    const workflowId = req.query?.workflowId || null;

    // Build return URL for redirect after OAuth
    let finalReturnUrl = null;
    if (workflowId) {
      finalReturnUrl = `/fullWorkflows/${workflowId}`;
    } else if (returnUrl) {
      finalReturnUrl = returnUrl;
    } else {
      // Try to get from referer header
      const referer = req.headers?.referer || req.headers?.referrer;
      if (referer) {
        try {
          const url = new URL(referer);
          finalReturnUrl = url.pathname;
        } catch {
          // Ignore invalid URL
        }
      }
    }

    const state = {
      userId,
      timestamp: Date.now(),
      returnUrl: finalReturnUrl,
      integrationType: 'GOOGLE_SHEETS',
    };

    const authUrl = googleOAuthService.getAuthUrl(
      userId,
      state,
      'GOOGLE_SHEETS'
    );

    logger.info(`Initiating Google Sheets OAuth for user ${userId}`);

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

/**
 * GET /api/integrations/google-sheets/callback
 * OAuth Callback - speichert Tokens
 */
export const handleCallback = async (req, res) => {
  const reply = res;
  const isFastifyRequest = isFastify(reply);
  const appUrl = getRequiredAppUrl();

  try {
    // Support both Fastify (request.query) and Express (req.query)
    // Fastify uses request.query directly, Express uses req.query
    const query = req.query || (req.request && req.request.query) || {};
    const { code, state } = query;

    logger.info('OAuth callback received', {
      hasCode: !!code,
      hasState: !!state,
      queryKeys: Object.keys(query),
    });

    if (!code) {
      const errorResponse = { error: 'Authorization code missing' };
      if (isFastifyRequest) {
        return reply.status(400).send(errorResponse);
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
        return reply.status(400).send(errorResponse);
      } else {
        return res.status(400).json(errorResponse);
      }
    }

    const userId = stateData.userId;

    if (!userId) {
      const errorResponse = { error: 'User ID missing in state' };
      if (isFastifyRequest) {
        return reply.status(400).send(errorResponse);
      } else {
        return res.status(400).json(errorResponse);
      }
    }

    // Exchange code for tokens
    const tokens = await googleOAuthService.exchangeCodeForTokens(
      code,
      'GOOGLE_SHEETS'
    );

    // Get user email from Google Sheets API (use Drive API)
    let email = 'unknown';
    const redirectUri = googleOAuthService.getRedirectUri('GOOGLE_SHEETS');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );
    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });

    try {
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      const about = await drive.about.get({ fields: 'user' });
      email = about.data.user?.emailAddress || 'unknown';
      logger.info(`Retrieved email for Google Sheets integration: ${email}`, {
        userId,
        hasEmail: !!about.data.user?.emailAddress,
        userData: about.data.user,
      });
    } catch (error) {
      logger.error('Error getting user email from Google Drive API:', {
        error: error.message,
        code: error.code,
        userId,
        stack: error.stack,
      });
      // Try to get email from token info if available
      try {
        const tokenInfo = await oauth2Client.getTokenInfo(tokens.accessToken);
        logger.info('Token info:', tokenInfo);
        if (tokenInfo.email) {
          email = tokenInfo.email;
          logger.info(`Retrieved email from token info: ${email}`);
        }
      } catch (tokenError) {
        logger.warn('Could not get email from token info:', {
          error: tokenError.message,
          code: tokenError.code,
        });
      }
    }

    // Log final email value
    logger.info(`Final email value for user ${userId}: ${email}`);

    // Check if integration already exists
    const existingIntegration = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.user_id, userId),
          eq(integrations.integration_type, 'GOOGLE_SHEETS')
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
          is_active: true, // Ensure it's active
          updated_at: new Date(),
        })
        .where(eq(integrations.id, existingIntegration[0].id));

      logger.info(`Updated Google Sheets integration for user ${userId}`, {
        integrationId: existingIntegration[0].id,
        email,
        isActive: true,
      });
    } else {
      // Create new integration
      const [newIntegration] = await db
        .insert(integrations)
        .values({
          user_id: userId,
          integration_type: 'GOOGLE_SHEETS',
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_expires_at: tokens.expiresAt,
          email,
          is_complete: true,
          is_active: true,
        })
        .returning();

      logger.info(`Created Google Sheets integration for user ${userId}`, {
        integrationId: newIntegration?.id,
        email,
        isActive: true,
      });
    }

    const returnUrl =
      stateData.returnUrl || stateData.redirectUrl || '/fullWorkflows';

    // Build full URL for redirect - go directly to the workflow editor
    // Ensure returnUrl starts with /
    const finalReturnUrl = returnUrl.startsWith('/')
      ? returnUrl
      : `/${returnUrl}`;
    const redirectUrl = `${appUrl}${finalReturnUrl}?googleSheets=connected`;

    logger.info('Redirecting OAuth callback', {
      redirectUrl,
      appUrl,
      returnUrl: finalReturnUrl,
      userId,
      email,
    });

    if (isFastifyRequest) {
      return reply.redirect(redirectUrl);
    } else {
      return res.redirect(redirectUrl);
    }
  } catch (error) {
    logger.error('Error handling OAuth callback:', error);
    // Try to get returnUrl from state if available, otherwise use default
    let returnUrl = '/fullWorkflows';
    try {
      const query = req.query || (req.request && req.request.query) || {};
      if (query.state) {
        const stateData = JSON.parse(query.state);
        returnUrl =
          stateData?.returnUrl || stateData?.redirectUrl || '/fullWorkflows';
      }
    } catch {
      // If state parsing fails, use default
    }

    const finalReturnUrl = returnUrl.startsWith('/')
      ? returnUrl
      : `/${returnUrl}`;
    const errorRedirectUrl = `${appUrl}${finalReturnUrl}?googleSheets=error&error=${encodeURIComponent(error.message || 'OAuth failed')}`;

    logger.error('Redirecting to error URL', {
      errorRedirectUrl,
      appUrl,
      returnUrl: finalReturnUrl,
      error: error.message,
    });

    if (isFastifyRequest) {
      return reply.redirect(errorRedirectUrl);
    } else {
      return res.redirect(errorRedirectUrl);
    }
  }
};

/**
 * GET /api/integrations/google-sheets/status
 * Get integration status
 */
export const getStatus = async (req, res) => {
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    // Support both Fastify (request.user) and Express (req.user)
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

    const integration = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.user_id, userId),
          eq(integrations.integration_type, 'GOOGLE_SHEETS')
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
      isComplete: integration[0].is_complete || false,
      email: integration[0].email || 'unknown',
    };

    logger.info('Google Sheets status response', {
      userId,
      connected: response.connected,
      email: response.email,
      isComplete: response.isComplete,
      integrationId: integration[0].id,
      hasEmail: !!integration[0].email,
    });

    if (isFastifyRequest) {
      return reply.send(response);
    } else {
      return res.json(response);
    }
  } catch (error) {
    logger.error('Error getting integration status:', error);
    const errorResponse = {
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

/**
 * DELETE /api/integrations/google-sheets
 * Disconnect Google Sheets integration
 */
export const disconnect = async (req, res) => {
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    // Support both Fastify (request.user) and Express (req.user)
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
          eq(integrations.integration_type, 'GOOGLE_SHEETS')
        )
      );

    logger.info(`Disconnected Google Sheets integration for user ${userId}`);

    const response = {
      success: true,
      message: 'Google Sheets integration disconnected',
    };

    if (isFastifyRequest) {
      return reply.send(response);
    } else {
      return res.json(response);
    }
  } catch (error) {
    logger.error('Error disconnecting integration:', error);
    const errorResponse = {
      error: 'Failed to disconnect integration',
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
 * GET /api/integrations/google-sheets/spreadsheets
 * List all spreadsheets for the user
 */
export const listSpreadsheets = async (req, res) => {
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    // Support both Fastify (request.user) and Express (req.user)
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

    const integration = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.user_id, userId),
          eq(integrations.integration_type, 'GOOGLE_SHEETS'),
          eq(integrations.is_active, true)
        )
      )
      .limit(1);

    if (!integration[0]) {
      const errorResponse = { error: 'Google Sheets not connected' };
      if (isFastifyRequest) {
        return reply.status(400).send(errorResponse);
      } else {
        return res.status(400).json(errorResponse);
      }
    }

    try {
      const result = await googleSheetsService.listSpreadsheets(
        integration[0].access_token,
        integration[0].refresh_token
      );

      logger.info('List spreadsheets result', {
        userId,
        success: result.success,
        count: result.data?.length || 0,
      });

      if (isFastifyRequest) {
        return reply.send(result);
      } else {
        return res.json(result);
      }
    } catch (error) {
      logger.error('Error in listSpreadsheets controller:', error);
      const errorResponse = {
        success: false,
        error: error.message || 'Failed to list spreadsheets',
      };
      if (isFastifyRequest) {
        return reply.status(500).send(errorResponse);
      } else {
        return res.status(500).json(errorResponse);
      }
    }
  } catch (error) {
    logger.error('Error listing spreadsheets:', error);
    const errorResponse = {
      error: 'Failed to list spreadsheets',
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
 * GET /api/integrations/google-sheets/spreadsheets/:spreadsheetId/sheets
 * Get sheets in a spreadsheet
 */
export const getSheets = async (req, res) => {
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    // Support both Fastify (request.user) and Express (req.user)
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
    const { spreadsheetId } = req.params;

    const integration = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.user_id, userId),
          eq(integrations.integration_type, 'GOOGLE_SHEETS'),
          eq(integrations.is_active, true)
        )
      )
      .limit(1);

    if (!integration[0]) {
      const errorResponse = { error: 'Google Sheets not connected' };
      if (isFastifyRequest) {
        reply.status(400).send(errorResponse);
        throw new Error('Google Sheets not connected');
      } else {
        return res.status(400).json(errorResponse);
      }
    }

    try {
      logger.info('Getting sheets for spreadsheet', {
        userId,
        spreadsheetId,
        integrationId: integration[0].id,
      });

      const result = await googleSheetsService.getSheets(
        integration[0].access_token,
        integration[0].refresh_token,
        spreadsheetId
      );

      logger.info('Get sheets result', {
        userId,
        spreadsheetId,
        success: result.success,
        count: result.data?.length || 0,
      });

      if (isFastifyRequest) {
        return reply.send(result);
      } else {
        return res.json(result);
      }
    } catch (error) {
      logger.error('Error in getSheets controller:', error);
      const errorResponse = {
        success: false,
        error: error.message || 'Failed to get sheets',
      };
      if (isFastifyRequest) {
        return reply.status(500).send(errorResponse);
      } else {
        return res.status(500).json(errorResponse);
      }
    }
  } catch (error) {
    logger.error('Error getting sheets:', error);
    const errorResponse = {
      error: 'Failed to get sheets',
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
 * GET /api/integrations/google-sheets/spreadsheets/:spreadsheetId/sheets/:sheetName/columns
 * Get columns (headers) from a sheet
 */
export const getColumns = async (req, res) => {
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    // Support both Fastify (request.user) and Express (req.user)
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
    const { spreadsheetId, sheetName } = req.params;

    const integration = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.user_id, userId),
          eq(integrations.integration_type, 'GOOGLE_SHEETS'),
          eq(integrations.is_active, true)
        )
      )
      .limit(1);

    if (!integration[0]) {
      const errorResponse = { error: 'Google Sheets not connected' };
      if (isFastifyRequest) {
        reply.status(400).send(errorResponse);
        throw new Error('Google Sheets not connected');
      } else {
        return res.status(400).json(errorResponse);
      }
    }

    try {
      logger.info('Getting columns for sheet', {
        userId,
        spreadsheetId,
        sheetName,
        integrationId: integration[0].id,
      });

      const result = await googleSheetsService.getColumns(
        integration[0].access_token,
        integration[0].refresh_token,
        spreadsheetId,
        sheetName
      );

      logger.info('Get columns result', {
        userId,
        spreadsheetId,
        sheetName,
        success: result.success,
        count: result.data?.length || 0,
      });

      if (isFastifyRequest) {
        return reply.send(result);
      } else {
        return res.json(result);
      }
    } catch (error) {
      logger.error('Error in getColumns controller:', error);
      const errorResponse = {
        success: false,
        error: error.message || 'Failed to get columns',
      };
      if (isFastifyRequest) {
        return reply.status(500).send(errorResponse);
      } else {
        return res.status(500).json(errorResponse);
      }
    }
  } catch (error) {
    logger.error('Error getting columns:', error);
    const errorResponse = {
      error: 'Failed to get columns',
      message: error.message || 'Unknown error',
    };

    if (isFastifyRequest) {
      return reply.status(500).send(errorResponse);
    } else {
      return res.status(500).json(errorResponse);
    }
  }
};
