import { google } from 'googleapis';
import logger from '#config/logger.js';

/**
 * Google OAuth Service
 * Handles OAuth flow for Google Calendar integration
 */
export class GoogleOAuthService {
  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID;
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    // Base URL for redirects - we'll append the specific callback path
    this.baseRedirectUri = process.env.GOOGLE_REDIRECT_URI_BASE || process.env.GOOGLE_REDIRECT_URI;

    if (!this.clientId || !this.clientSecret || !this.baseRedirectUri) {
      logger.warn(
        'Google OAuth credentials not fully configured. Google integrations will not work.'
      );
    }
  }

  /**
   * Get redirect URI for a specific integration type
   * @param {string} integrationType - 'GOOGLE_CALENDAR' or 'GOOGLE_SHEETS'
   * @returns {string} Full redirect URI
   */
  getRedirectUri(integrationType = 'GOOGLE_CALENDAR') {
    // If baseRedirectUri already contains a full path, use it as-is (backward compatibility)
    if (this.baseRedirectUri.includes('/api/integrations/')) {
      return this.baseRedirectUri;
    }

    // Otherwise, append the appropriate callback path
    const callbackPath = integrationType === 'GOOGLE_SHEETS'
      ? '/api/integrations/google-sheets/callback'
      : '/api/integrations/google-calendar/callback';

    return `${this.baseRedirectUri}${callbackPath}`;
  }

  /**
   * Generiere OAuth URL für Browser
   * @param {number} userId - User ID for state parameter
   * @param {string} state - Additional state data
   * @param {string} integrationType - Integration type ('GOOGLE_CALENDAR' or 'GOOGLE_SHEETS')
   * @returns {string} OAuth authorization URL
   */
  getAuthUrl(userId, state = {}, integrationType = 'GOOGLE_CALENDAR') {
    if (!this.clientId || !this.clientSecret || !this.baseRedirectUri) {
      throw new Error('Google OAuth credentials not configured');
    }

    const redirectUri = this.getRedirectUri(integrationType);

    const oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      redirectUri
    );

    // Set scopes based on integration type
    let scopes = [];
    if (integrationType === 'GOOGLE_SHEETS') {
      scopes = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.readonly', // For listing spreadsheets
      ];
    } else {
      // Default: Google Calendar
      scopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ];
    }

    const stateData = JSON.stringify({
      userId,
      integrationType,
      ...state,
      timestamp: Date.now(),
    });

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force consent screen to get refresh token
      state: stateData,
    });

    logger.info(`Generated OAuth URL for user ${userId} (${integrationType})`);
    return authUrl;
  }

  /**
   * Exchange authorization code für Tokens
   * @param {string} code - Authorization code from Google
   * @returns {Promise<{accessToken: string, refreshToken: string, expiresAt: Date | null}>}
   */
  async exchangeCodeForTokens(code, integrationType = 'GOOGLE_CALENDAR') {
    if (!this.clientId || !this.clientSecret || !this.baseRedirectUri) {
      throw new Error('Google OAuth credentials not configured');
    }

    const redirectUri = this.getRedirectUri(integrationType);

    const oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      redirectUri
    );

    try {
      const { tokens } = await oauth2Client.getToken(code);

      logger.info('Successfully exchanged code for tokens');

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      };
    } catch (error) {
      logger.error('Error exchanging code for tokens:', error);
      throw new Error(`Failed to exchange code for tokens: ${error.message}`);
    }
  }

  /**
   * Refresh Access Token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<{accessToken: string, expiresAt: Date | null}>}
   */
  async refreshAccessToken(refreshToken, integrationType = 'GOOGLE_CALENDAR') {
    if (!this.clientId || !this.clientSecret || !this.baseRedirectUri) {
      throw new Error('Google OAuth credentials not configured');
    }

    const redirectUri = this.getRedirectUri(integrationType);

    const oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      redirectUri
    );

    oauth2Client.setCredentials({ refresh_token: refreshToken });

    try {
      const { credentials } = await oauth2Client.refreshAccessToken();

      logger.info('Successfully refreshed access token');

      return {
        accessToken: credentials.access_token,
        expiresAt: credentials.expiry_date
          ? new Date(credentials.expiry_date)
          : null,
      };
    } catch (error) {
      logger.error('Error refreshing access token:', error);
      throw new Error(`Failed to refresh access token: ${error.message}`);
    }
  }
}

export const googleOAuthService = new GoogleOAuthService();
