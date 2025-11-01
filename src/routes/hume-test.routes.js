import express from 'express';
import { join, dirname } from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import {
  getConfig,
  validateConfig,
  createConfig,
  makeOutboundCall,
  twilioWebhook,
} from '#controllers/hume-evi.controller.js';
import logger from '#config/logger.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

router.get('/test-hume', (req, res) => {
  try {
    const htmlPath = join(__dirname, '../views/hume-test.html');
    const html = readFileSync(htmlPath, 'utf-8');

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    logger.error('Error serving Hume test UI', { error: error.message });
    res.status(500).send('Error loading test UI');
  }
});

router.get('/test-hume/config', getConfig);

router.post('/test-hume/config/validate', validateConfig);

/**
 * POST /api/test-hume/config/create
 * Create a new Hume EVI configuration and return the config ID
 * @body {Object} config - Configuration parameters from frontend
 */
router.post('/test-hume/config/create', createConfig);

/**
 * POST /api/test-hume/call
 * Creates a phone call job (all calls are jobs, used by BullMQ)
 * @body {string|string[]} toNumber - Phone number(s) in E.164 format (string for single, array for bulk)
 * @body {Object} [config] - Optional Hume EVI configuration
 * @body {string} [configId] - Optional existing config ID
 * @body {Object} [options] - Optional job options (maxAttempts, timeout, priority)
 */
router.post('/test-hume/call', makeOutboundCall);

router.post('/test-hume/twilio-webhook', twilioWebhook);

export default router;
