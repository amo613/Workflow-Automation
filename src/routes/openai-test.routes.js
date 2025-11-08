import express from 'express';
import { join, dirname } from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import {
  getConfig,
  validateConfig,
  makeOutboundCall,
  twilioWebhook,
} from '#controllers/openai-realtime.controller.js';
import logger from '#config/logger.js';
import { authenticateToken } from '#middleware/auth.middleware.js';
import securityMiddleware from '#middleware/security.middleware.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

router.get('/test-openai', authenticateToken, (req, res) => {
  try {
    const htmlPath = join(__dirname, '../../ui/openai-test.html');
    const html = readFileSync(htmlPath, 'utf-8');

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    logger.error('Error serving OpenAI test UI', { error: error.message });
    res.status(500).send('Error loading test UI');
  }
});

router.get(
  '/test-openai/config',
  authenticateToken,
  securityMiddleware,
  getConfig
);

router.post(
  '/test-openai/config/validate',
  authenticateToken,
  securityMiddleware,
  validateConfig
);

/**
 * POST /api/test-openai/call
 * Creates a phone call job (all calls are jobs, used by BullMQ, but it's also good, to have a direct route for testing)
 * @body {string|string[]} toNumber - Phone number(s) in E.164 format (string for single, array for bulk)
 * @body {Object} [config] - Optional OpenAI Realtime API configuration
 * @body {Object} [options] - Optional job options (maxAttempts, timeout, priority)
 */
router.post(
  '/test-openai/call',
  authenticateToken,
  securityMiddleware,
  makeOutboundCall
);

/**
 * POST /api/test-openai/twilio-webhook
 * Twilio webhook endpoint - returns TwiML to start media stream via our OpenAI proxy
 * Note: No middleware needed - Twilio webhooks are only called by our own jobs
 * - Jobs already have authentication (authenticateToken when creating)
 * - Rate limiting is handled by job queue (BullMQ)
 * - Bot detection would block legitimate Twilio requests
 * - Concurrent calls are expected and handled by job queue
 * @query {string} [config] - Optional base64 encoded config parameters
 */
router.post('/test-openai/twilio-webhook', twilioWebhook);

export default router;
