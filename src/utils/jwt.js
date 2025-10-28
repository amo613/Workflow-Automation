import jwt from 'jsonwebtoken';
import logger from '#config/logger.js';
import { JWT_SECRET, JWT_EXPIRES_IN } from '#config/env.js';

const _JWT_SECRET = JWT_SECRET || 'your-secret-key-please-change-in-production';
const _JWT_EXPIRES_IN = JWT_EXPIRES_IN;

export const jwttoken = {
  sign: payload => {
    try {
      return jwt.sign(payload, _JWT_SECRET, { expiresIn: _JWT_EXPIRES_IN });
    } catch (e) {
      logger.error('Failed to auth the token', e);
      throw new Error('Failed to auth the token');
    }
  },
  verify: token => {
    try {
      return jwt.verify(token, _JWT_SECRET);
    } catch (e) {
      logger.error('Failed to verify token', e);
      throw new Error('Failed to verify token');
    }
  },
};
