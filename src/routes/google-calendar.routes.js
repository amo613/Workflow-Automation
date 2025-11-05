import express from 'express';
import { authenticateToken } from '#middleware/auth.middleware.js';
import {
  initiateAuth,
  handleCallback,
  getStatus,
  disconnect,
  updateSettings,
} from '#controllers/google-calendar.controller.js';

const router = express.Router();

// OAuth Flow
router.get('/auth', authenticateToken, initiateAuth);
router.get('/callback', handleCallback); // Kein Auth nötig, state enthält userId
router.get('/status', authenticateToken, getStatus);
router.put('/settings', authenticateToken, updateSettings);
router.delete('/', authenticateToken, disconnect);

export default router;
