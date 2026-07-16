import jwt from 'jsonwebtoken';
import logger from '#config/logger.js';
import {
  HUBSPOT_CLIENT_ID,
  HUBSPOT_CLIENT_SECRET,
  HUBSPOT_REDIRECT_URI,
  JWT_SECRET,
} from '#config/env.js';
import { getRequiredAppUrl } from '#utils/app-url.utils.js';

const HUBSPOT_AUTHORIZE_URL = 'https://app.hubspot.com/oauth/authorize';
const HUBSPOT_TOKEN_URL = 'https://api.hubspot.com/oauth/2026-03/token';
const STATE_ISSUER = 'workflow-automation';
const STATE_AUDIENCE = 'hubspot-oauth';

export const HUBSPOT_REQUIRED_SCOPES = [
  'oauth',
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.companies.read',
  'crm.objects.companies.write',
  'crm.lists.read',
  'crm.lists.write',
];

function ensureLocalReturnUrl(value) {
  if (!value) {
    return '/fullWorkflows';
  }

  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//')
  ) {
    throw new Error('Invalid OAuth return URL');
  }

  return value;
}

/**
 * HubSpot OAuth service for developer platform 2026.03 apps.
 */
export class HubSpotOAuthService {
  getClientId() {
    if (!HUBSPOT_CLIENT_ID) {
      throw new Error('HUBSPOT_CLIENT_ID must be configured');
    }
    return HUBSPOT_CLIENT_ID;
  }

  getClientSecret() {
    if (!HUBSPOT_CLIENT_SECRET) {
      throw new Error('HUBSPOT_CLIENT_SECRET must be configured');
    }
    return HUBSPOT_CLIENT_SECRET;
  }

  getRedirectUri() {
    const redirectUri =
      HUBSPOT_REDIRECT_URI ||
      `${getRequiredAppUrl()}/api/integrations/hubspot/callback`;

    let parsedUri;
    try {
      parsedUri = new URL(redirectUri);
    } catch {
      throw new Error('HUBSPOT_REDIRECT_URI must be a valid absolute URL');
    }

    if (parsedUri.protocol !== 'https:') {
      throw new Error('HUBSPOT_REDIRECT_URI must use HTTPS');
    }

    return redirectUri.replace(/\/+$/, '');
  }

  getStateSecret() {
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET must be configured for HubSpot OAuth state');
    }
    return JWT_SECRET;
  }

  createState(userId, state = {}) {
    return jwt.sign(
      {
        userId,
        integrationType: 'HUBSPOT',
        returnUrl: ensureLocalReturnUrl(
          state.returnUrl || state.redirectUrl || '/fullWorkflows'
        ),
      },
      this.getStateSecret(),
      {
        expiresIn: '10m',
        issuer: STATE_ISSUER,
        audience: STATE_AUDIENCE,
      }
    );
  }

  verifyState(stateToken) {
    if (!stateToken) {
      throw new Error('HubSpot OAuth state is missing');
    }

    try {
      const state = jwt.verify(stateToken, this.getStateSecret(), {
        issuer: STATE_ISSUER,
        audience: STATE_AUDIENCE,
      });

      if (
        !state.userId ||
        state.integrationType !== 'HUBSPOT' ||
        typeof state.returnUrl !== 'string'
      ) {
        throw new Error('HubSpot OAuth state is invalid');
      }

      return {
        userId: state.userId,
        returnUrl: ensureLocalReturnUrl(state.returnUrl),
      };
    } catch (error) {
      if (error.message === 'HubSpot OAuth state is invalid') {
        throw error;
      }
      throw new Error('HubSpot OAuth state is invalid or expired');
    }
  }

  getAuthUrl(userId, state = {}) {
    const params = new URLSearchParams({
      client_id: this.getClientId(),
      redirect_uri: this.getRedirectUri(),
      scope: HUBSPOT_REQUIRED_SCOPES.join(' '),
      state: this.createState(userId, state),
    });

    logger.info('Generated HubSpot OAuth URL', { userId });
    return `${HUBSPOT_AUTHORIZE_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code) {
    if (!code) {
      throw new Error('HubSpot authorization code is required');
    }

    return this.requestTokens({
      grant_type: 'authorization_code',
      client_id: this.getClientId(),
      client_secret: this.getClientSecret(),
      redirect_uri: this.getRedirectUri(),
      code,
    });
  }

  async refreshAccessToken(refreshToken) {
    if (!refreshToken) {
      throw new Error('HubSpot refresh token is required');
    }

    return this.requestTokens({
      grant_type: 'refresh_token',
      client_id: this.getClientId(),
      client_secret: this.getClientSecret(),
      refresh_token: refreshToken,
    });
  }

  async requestTokens(tokenParams) {
    const response = await fetch(HUBSPOT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenParams).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('HubSpot OAuth token request failed', {
        status: response.status,
        grantType: tokenParams.grant_type,
        error: errorText,
      });
      throw new Error(
        `HubSpot OAuth token request failed: ${response.status} ${errorText}`
      );
    }

    const tokens = await response.json();
    if (!tokens.access_token) {
      throw new Error('HubSpot OAuth response did not include an access token');
    }

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || tokenParams.refresh_token || null,
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + Number(tokens.expires_in) * 1000)
        : null,
      externalAccountId: tokens.hub_id ? String(tokens.hub_id) : null,
      grantedScopes: Array.isArray(tokens.scopes) ? tokens.scopes : [],
    };
  }
}

export const hubspotOAuthService = new HubSpotOAuthService();
