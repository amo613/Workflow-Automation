import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'hubspot-oauth-test-secret';
const TEST_REDIRECT =
  'https://app-production-7047.up.railway.app/api/integrations/hubspot/callback';

jest.unstable_mockModule('#config/env.js', () => ({
  HUBSPOT_CLIENT_ID: 'test-client-id',
  HUBSPOT_CLIENT_SECRET: 'test-client-secret',
  HUBSPOT_REDIRECT_URI: TEST_REDIRECT,
  JWT_SECRET: TEST_SECRET,
}));

jest.unstable_mockModule('#config/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const { HubSpotOAuthService } = await import(
  '#services/hubspot-oauth.service.js'
);

describe('HubSpot OAuth 2026 service', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('generates a production OAuth URL with signed state', () => {
    const service = new HubSpotOAuthService();
    const authUrl = new URL(
      service.getAuthUrl(42, { returnUrl: '/fullWorkflows/7' })
    );

    expect(authUrl.origin + authUrl.pathname).toBe(
      'https://app.hubspot.com/oauth/authorize'
    );
    expect(authUrl.searchParams.get('client_id')).toBe('test-client-id');
    expect(authUrl.searchParams.get('redirect_uri')).toBe(TEST_REDIRECT);
    expect(authUrl.searchParams.get('scope')).toContain('oauth');
    expect(authUrl.searchParams.get('scope')).toContain(
      'crm.objects.contacts.read'
    );

    const state = jwt.verify(authUrl.searchParams.get('state'), TEST_SECRET, {
      issuer: 'workflow-automation',
      audience: 'hubspot-oauth',
    });
    expect(state).toMatchObject({
      userId: 42,
      integrationType: 'HUBSPOT',
      returnUrl: '/fullWorkflows/7',
    });
  });

  it('rejects external return URLs', () => {
    const service = new HubSpotOAuthService();

    expect(() =>
      service.getAuthUrl(42, { returnUrl: 'https://evil.example' })
    ).toThrow('Invalid OAuth return URL');
  });

  it('uses the 2026-03 token endpoint and returns portal metadata', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      new globalThis.Response(
        JSON.stringify({
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 1800,
          hub_id: 123456,
          scopes: ['oauth', 'crm.objects.contacts.read'],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const service = new HubSpotOAuthService();
    const tokens = await service.exchangeCodeForTokens('authorization-code');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.hubspot.com/oauth/2026-03/token',
      expect.objectContaining({ method: 'POST' })
    );
    expect(tokens).toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      externalAccountId: '123456',
      grantedScopes: ['oauth', 'crm.objects.contacts.read'],
    });
  });
});
