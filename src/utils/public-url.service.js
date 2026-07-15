/**
 * Public URL Service
 * Manages public URL for webhooks and integrations
 * Replaces ngrok.service.js for production deployments
 */

let publicUrl = process.env.PUBLIC_URL || process.env.FRONTEND_URL || null;

// Store callSid -> configId mapping temporarily for WebSocket connections
// This is needed because Twilio might not send query params in the upgrade request
const callSidToConfigMap = new Map();

// Store callSid -> From (caller number) mapping temporarily for OpenAI metadata
// The From field is only available in the webhook, not in the WebSocket start event
const callSidToFromMap = new Map();

/**
 * Set public URL (for development with ngrok or production with Railway/custom domain)
 * @param {string} url - Public URL
 */
export function setPublicUrl(url) {
  publicUrl = url;
  console.log(`✅ Public URL stored: ${url}`);
}

/**
 * Get public URL
 * @returns {string|null} Public URL or null if not set
 */
export function getPublicUrl() {
  return publicUrl;
}

/**
 * Build webhook URL with path
 * @param {string} path - Path to append to public URL
 * @returns {string|null} Full webhook URL or null if not set
 */
export function buildWebhookUrl(path) {
  if (!publicUrl) {
    return null;
  }

  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${publicUrl}${normalizedPath}`;
}

/**
 * Store callSid -> configId mapping for WebSocket connection
 * @param {string} callSid - Twilio Call SID
 * @param {string} configId - Config ID (legacy, not used for OpenAI)
 */
export function storeCallConfig(callSid, configId) {
  callSidToConfigMap.set(callSid, configId);
}

/**
 * Get configId for callSid
 * @param {string} callSid - Twilio Call SID
 * @returns {string|null} Config ID or null if not found
 */
export function getCallConfig(callSid) {
  return callSidToConfigMap.get(callSid) || null;
}

/**
 * Store callSid -> From (caller number) mapping for OpenAI metadata
 * @param {string} callSid - Twilio Call SID
 * @param {string} from - Caller phone number
 */
export function storeCallFrom(callSid, from) {
  callSidToFromMap.set(callSid, from);
}

/**
 * Get From (caller number) for callSid
 * @param {string} callSid - Twilio Call SID
 * @returns {string|null} Caller phone number or null if not found
 */
export function getCallFrom(callSid) {
  return callSidToFromMap.get(callSid) || null;
}

/**
 * Clean up old mappings (call after WebSocket connection is established)
 * @param {string} callSid - Twilio Call SID
 */
export function cleanupCallMapping(callSid) {
  callSidToConfigMap.delete(callSid);
  callSidToFromMap.delete(callSid);
}
