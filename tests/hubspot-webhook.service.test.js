import crypto from 'node:crypto';
import {
  normalizeHubSpotEvent,
  normalizeHubSpotEventType,
  validateHubSpotSignature,
} from '#services/hubspot-webhook.service.js';

describe('HubSpot webhook service', () => {
  it('maps new object event types to the workflow event format', () => {
    expect(
      normalizeHubSpotEventType({
        subscriptionType: 'object.propertyChange',
        objectTypeId: '0-1',
      })
    ).toBe('contact.propertyChange');

    expect(
      normalizeHubSpotEventType({
        subscriptionType: 'object.creation',
        objectTypeId: '0-2',
      })
    ).toBe('company.creation');
  });

  it('normalizes portal and event metadata', () => {
    expect(
      normalizeHubSpotEvent({
        portalId: 123,
        eventId: 456,
        objectId: 789,
        subscriptionType: 'object.creation',
        objectTypeId: '0-1',
      })
    ).toMatchObject({
      portalId: 123,
      eventId: 456,
      objectId: 789,
      subscriptionType: 'contact.creation',
      originalSubscriptionType: 'object.creation',
    });
  });

  it('validates an unexpired v3 signature', () => {
    const clientSecret = 'client-secret';
    const method = 'POST';
    const requestUrl =
      'https://app-production-7047.up.railway.app/api/integrations/hubspot/webhook';
    const rawBody = '[{"portalId":123}]';
    const timestamp = '1773655200000';
    const signature = crypto
      .createHmac('sha256', clientSecret)
      .update(`${method}${requestUrl}${rawBody}${timestamp}`)
      .digest('base64');

    expect(
      validateHubSpotSignature({
        clientSecret,
        method,
        requestUrl,
        rawBody,
        timestamp,
        signature,
        now: Number(timestamp),
      })
    ).toBe(true);
  });

  it('rejects expired signatures', () => {
    expect(
      validateHubSpotSignature({
        clientSecret: 'client-secret',
        method: 'POST',
        requestUrl: 'https://example.com/webhook',
        rawBody: '[]',
        timestamp: '1',
        signature: 'invalid',
        now: 600000,
      })
    ).toBe(false);
  });
});
