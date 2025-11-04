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

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

router.get('/test-openai', (req, res) => {
  try {
    const htmlPath = join(__dirname, '../views/openai-test.html');
    const html = readFileSync(htmlPath, 'utf-8');

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    logger.error('Error serving OpenAI test UI', { error: error.message });
    res.status(500).send('Error loading test UI');
  }
});

router.get('/test-openai/config', getConfig);

router.post('/test-openai/config/validate', validateConfig);

/**
 * POST /api/test-openai/call
 * Creates a phone call job (all calls are jobs, used by BullMQ)
 * @body {string|string[]} toNumber - Phone number(s) in E.164 format (string for single, array for bulk)
 * @body {Object} [config] - Optional OpenAI Realtime API configuration
 * @body {Object} [options] - Optional job options (maxAttempts, timeout, priority)
 */
router.post('/test-openai/call', makeOutboundCall);

/**
 * POST /api/test-openai/twilio-webhook
 * Twilio webhook endpoint - returns TwiML to start media stream via our OpenAI proxy
 * @query {string} [config] - Optional base64 encoded config parameters
 */
router.post('/test-openai/twilio-webhook', twilioWebhook);

export default router;
