import crypto from 'crypto';
import { JWT_SECRET } from '#config/env.js';
import logger from '#config/logger.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;

/**
 * Derive encryption key from secret
 */
function deriveKey(secret, salt) {
  return crypto.pbkdf2Sync(secret, salt, 100000, KEY_LENGTH, 'sha512');
}

/**
 * Encrypt API key
 * @param {string} apiKey - API key to encrypt
 * @param {string} secret - Encryption secret (defaults to JWT_SECRET)
 * @returns {string} - Encrypted key (format: salt:iv:tag:encrypted)
 */
export function encryptApiKey(apiKey, secret = JWT_SECRET) {
  try {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    if (!secret) {
      throw new Error('Encryption secret is required');
    }

    // Generate salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive key from secret
    const key = deriveKey(secret, salt);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get auth tag
    const tag = cipher.getAuthTag();

    // Combine: salt:iv:tag:encrypted
    return `${salt.toString('hex')}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  } catch (error) {
    logger.error('Error encrypting API key', {
      error: error.message,
      stack: error.stack,
    });
    throw new Error('Failed to encrypt API key');
  }
}

/**
 * Decrypt API key
 * @param {string} encryptedKey - Encrypted key (format: salt:iv:tag:encrypted)
 * @param {string} secret - Encryption secret (defaults to JWT_SECRET)
 * @returns {string} - Decrypted API key
 */
export function decryptApiKey(encryptedKey, secret = JWT_SECRET) {
  try {
    if (!encryptedKey) {
      throw new Error('Encrypted key is required');
    }

    if (!secret) {
      throw new Error('Encryption secret is required');
    }

    // Split encrypted key
    const parts = encryptedKey.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted key format');
    }

    const [saltHex, ivHex, tagHex, encrypted] = parts;

    // Convert hex to buffers
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    // Derive key from secret
    const key = deriveKey(secret, salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    // Decrypt
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('Error decrypting API key', {
      error: error.message,
      stack: error.stack,
    });
    throw new Error('Failed to decrypt API key');
  }
}
