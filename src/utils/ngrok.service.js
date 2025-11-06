/**
 * Ngrok Service
 * Manages ngrok tunnel URL for dynamic webhook generation
 */

let ngrokUrl = null;

// Store callSid -> configId mapping temporarily for WebSocket connections
// This is needed because Twilio might not send query params in the upgrade request
const callSidToConfigMap = new Map();

// Store callSid -> From (caller number) mapping temporarily for OpenAI metadata
// The From field is only available in the webhook, not in the WebSocket start event
const callSidToFromMap = new Map();

/**
 * Set ngrok public URL
 * @param {string} url - Ngrok public URL
 */
export function setNgrokUrl(url) {
  ngrokUrl = url;
  console.log(`✅ Ngrok URL stored: ${url}`);
}

/**
 * Get ngrok public URL
 * @returns {string|null} Ngrok public URL or null if not set
 */
export function getNgrokUrl() {
  return ngrokUrl;
}

/**
 * Build webhook URL with path
 * @param {string} path - Path to append to ngrok URL
 * @returns {string|null} Full webhook URL or null if ngrok URL not set
 */
export function buildWebhookUrl(path) {
  if (!ngrokUrl) {
    return null;
  }

  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${ngrokUrl}${normalizedPath}`;
}

/**
 * Store callSid -> configId mapping for WebSocket connection
 * @param {string} callSid - Twilio Call SID
 * @param {string} configId - Config ID (legacy, not used for OpenAI)
 */
export function storeCallConfig(callSid, configId) {
  callSidToConfigMap.set(callSid, configId);
  // Clean up after 5 minutes (calls shouldn't take longer)
  setTimeout(
    () => {
      callSidToConfigMap.delete(callSid);
    },
    5 * 60 * 1000
  );
}

/**
 * Get config ID for a call SID
 * @param {string} callSid - Twilio Call SID
 * @returns {string|null} Config ID or null if not found
 */
export function getCallConfig(callSid) {
  return callSidToConfigMap.get(callSid) || null;
}

/**
 * Store callSid -> From (caller number) mapping for OpenAI metadata
 * @param {string} callSid - Twilio Call SID
 * @param {string} fromNumber - Twilio caller number (From field)
 */
export function storeCallFrom(callSid, fromNumber) {
  callSidToFromMap.set(callSid, fromNumber);
  // Clean up after 5 minutes (calls shouldn't take longer)
  setTimeout(
    () => {
      callSidToFromMap.delete(callSid);
    },
    5 * 60 * 1000
  );
}

/**
 * Get caller number (From) for a call SID
 * @param {string} callSid - Twilio Call SID
 * @returns {string|null} Caller number or null if not found
 */
export function getCallFrom(callSid) {
  return callSidToFromMap.get(callSid) || null;
}
