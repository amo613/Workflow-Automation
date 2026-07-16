import crypto from 'node:crypto';
import logger from '#config/logger.js';
import { getRedisClient, memoryCache } from '#config/cache.js';

const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;
const EVENT_DEDUPE_TTL_SECONDS = 24 * 60 * 60;

const OBJECT_TYPE_BY_ID = {
  '0-1': 'contact',
  '0-2': 'company',
};

const HUBSPOT_URI_DECODE_MAP = {
  '%3A': ':',
  '%2F': '/',
  '%3F': '?',
  '%40': '@',
  '%21': '!',
  '%24': '$',
  '%27': "'",
  '%28': '(',
  '%29': ')',
  '%2A': '*',
  '%2C': ',',
  '%3B': ';',
};

function decodeHubSpotUri(uri) {
  return Object.entries(HUBSPOT_URI_DECODE_MAP).reduce(
    (decoded, [encoded, value]) =>
      decoded.replace(new RegExp(encoded, 'gi'), value),
    uri
  );
}

export function normalizeHubSpotEventType(event) {
  const subscriptionType =
    event.subscriptionType || event.eventType || event.type;

  if (!subscriptionType) {
    return null;
  }

  if (!subscriptionType.startsWith('object.')) {
    return subscriptionType;
  }

  const objectType =
    event.objectType ||
    event.objectName ||
    OBJECT_TYPE_BY_ID[String(event.objectTypeId)];

  if (!objectType) {
    return subscriptionType;
  }

  return `${objectType}.${subscriptionType.slice('object.'.length)}`;
}

export function normalizeHubSpotEvent(event) {
  const subscriptionType = normalizeHubSpotEventType(event);

  return {
    ...event,
    subscriptionId: event.subscriptionId || event.subscription?.id,
    subscriptionType,
    originalSubscriptionType:
      event.subscriptionType || event.eventType || event.type || null,
    objectId: event.objectId || event.object?.id,
    properties: event.properties || event.object?.properties || {},
    occurredAt: event.occurredAt || event.timestamp || new Date().toISOString(),
    portalId: event.portalId || event.hubId || event.portal?.id,
    eventId: event.eventId || event.id,
  };
}

export function validateHubSpotSignature({
  clientSecret,
  method,
  requestUrl,
  rawBody,
  timestamp,
  signature,
  now = Date.now(),
}) {
  if (
    !clientSecret ||
    !method ||
    !requestUrl ||
    rawBody === undefined ||
    !timestamp ||
    !signature
  ) {
    return false;
  }

  const numericTimestamp = Number(timestamp);
  if (
    !Number.isFinite(numericTimestamp) ||
    Math.abs(now - numericTimestamp) > MAX_SIGNATURE_AGE_MS
  ) {
    return false;
  }

  const source = `${method.toUpperCase()}${decodeHubSpotUri(requestUrl)}${rawBody}${timestamp}`;
  const expectedSignature = crypto
    .createHmac('sha256', clientSecret)
    .update(source, 'utf8')
    .digest('base64');

  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(signature);

  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

function buildEventDedupeKey(event) {
  const identity = [
    event.portalId,
    event.eventId,
    event.subscriptionId,
    event.objectId,
    event.occurredAt,
  ].join(':');

  return `hubspot-event:${crypto.createHash('sha256').update(identity).digest('hex')}`;
}

export async function claimHubSpotEvent(event) {
  const key = buildEventDedupeKey(event);
  const redisClient = getRedisClient();

  if (redisClient?.isReady) {
    try {
      const result = await redisClient.set(key, '1', {
        EX: EVENT_DEDUPE_TTL_SECONDS,
        NX: true,
      });
      return result === 'OK';
    } catch (error) {
      logger.warn('HubSpot webhook Redis deduplication failed', {
        error: error.message,
      });
    }
  }

  if (memoryCache.has(key)) {
    return false;
  }

  memoryCache.set(key, true, EVENT_DEDUPE_TTL_SECONDS);
  return true;
}
