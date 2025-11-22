import logger from '#config/logger.js';

/**
 * HubSpot OAuth Service
 * Handles OAuth flow for HubSpot CRM integration
 */
export class HubSpotOAuthService {
  constructor() {
    this.clientId = process.env.HUBSPOT_CLIENT_ID;
    this.clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
    this.baseRedirectUri =
      process.env.HUBSPOT_REDIRECT_URI_BASE ||
      process.env.GOOGLE_REDIRECT_URI_BASE ||
      process.env.GOOGLE_REDIRECT_URI;

    if (!this.clientId || !this.clientSecret || !this.baseRedirectUri) {
      logger.warn(
        'HubSpot OAuth credentials not fully configured. HubSpot integration will not work.'
      );
    }
  }

  /**
   * Get redirect URI for HubSpot OAuth callback
   * @returns {string} Full redirect URI
   */
  getRedirectUri() {
    // If baseRedirectUri already contains a full path, use it as-is (backward compatibility)
    if (this.baseRedirectUri.includes('/api/integrations/')) {
      return this.baseRedirectUri;
    }

    // Otherwise, append the HubSpot callback path
    const callbackPath = '/api/integrations/hubspot/callback';
    return `${this.baseRedirectUri}${callbackPath}`;
  }

  /**
   * Generate OAuth URL for browser
   * @param {number} userId - User ID for state parameter
   * @param {Object} state - Additional state data
   * @returns {string} OAuth authorization URL
   */
  getAuthUrl(userId, state = {}) {
    if (!this.clientId || !this.clientSecret || !this.baseRedirectUri) {
      throw new Error('HubSpot OAuth credentials not configured');
    }

    const redirectUri = this.getRedirectUri();

    // HubSpot OAuth2 scopes
    const scopes = [
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
      'crm.objects.companies.read',
      'crm.objects.companies.write',
      'crm.lists.read',
      'crm.lists.write',
    ];

    const stateData = JSON.stringify({
      userId,
      integrationType: 'HUBSPOT',
      ...state,
      timestamp: Date.now(),
    });

    // HubSpot OAuth2 authorization URL
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      state: stateData,
    });

    const authUrl = `https://app.hubspot.com/oauth/authorize?${params.toString()}`;

    logger.info(`Generated HubSpot OAuth URL for user ${userId}`);
    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
   * @param {string} code - Authorization code from HubSpot
   * @returns {Promise<{accessToken: string, refreshToken: string, expiresAt: Date | null}>}
   */
  async exchangeCodeForTokens(code) {
    if (!this.clientId || !this.clientSecret || !this.baseRedirectUri) {
      throw new Error('HubSpot OAuth credentials not configured');
    }

    const redirectUri = this.getRedirectUri();

    try {
      // HubSpot token exchange endpoint
      const tokenUrl = 'https://api.hubapi.com/oauth/v1/token';
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        code,
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('HubSpot token exchange failed', {
          status: response.status,
          error: errorText,
        });
        throw new Error(
          `Failed to exchange code for tokens: ${response.status} ${errorText}`
        );
      }

      const tokens = await response.json();

      logger.info('Successfully exchanged HubSpot code for tokens');

      // Calculate expiration time (HubSpot tokens typically expire in 6 hours)
      const expiresAt = tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null;

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
      };
    } catch (error) {
      logger.error('Error exchanging HubSpot code for tokens:', error);
      throw new Error(`Failed to exchange code for tokens: ${error.message}`);
    }
  }

  /**
   * Refresh Access Token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<{accessToken: string, expiresAt: Date | null}>}
   */
  async refreshAccessToken(refreshToken) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('HubSpot OAuth credentials not configured');
    }

    try {
      // HubSpot token refresh endpoint
      const tokenUrl = 'https://api.hubapi.com/oauth/v1/token';
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('HubSpot token refresh failed', {
          status: response.status,
          error: errorText,
        });
        throw new Error(
          `Failed to refresh access token: ${response.status} ${errorText}`
        );
      }

      const tokens = await response.json();

      logger.info('Successfully refreshed HubSpot access token');

      // Calculate expiration time
      const expiresAt = tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null;

      return {
        accessToken: tokens.access_token,
        expiresAt,
        // HubSpot may return a new refresh token
        refreshToken: tokens.refresh_token || refreshToken,
      };
    } catch (error) {
      logger.error('Error refreshing HubSpot access token:', error);
      throw new Error(`Failed to refresh access token: ${error.message}`);
    }
  }
}

export const hubspotOAuthService = new HubSpotOAuthService();

