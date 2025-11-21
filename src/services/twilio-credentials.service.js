import { db } from '#config/database.js';
import { userTwilioCredentials } from '#models/user-twilio-credentials.model.js';
import { decryptApiKey } from '#utils/encryption.utils.js';
import { eq } from 'drizzle-orm';
import logger from '#config/logger.js';

/**
 * Get user Twilio credentials (from database)
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>} - Decrypted credentials or null if not found
 * @throws {Error} - If decryption fails
 */
export async function getUserTwilioCredentials(userId) {
  try {
    const [credentials] = await db
      .select()
      .from(userTwilioCredentials)
      .where(eq(userTwilioCredentials.user_id, userId))
      .limit(1);

    if (!credentials) {
      logger.debug('No Twilio credentials found in database', { userId });
      return null;
    }

    // Try to decrypt - if this fails, throw the error instead of returning null
    try {
      return decryptTwilioCredentials(credentials);
    } catch (decryptError) {
      logger.error('Failed to decrypt Twilio credentials', {
        userId,
        error: decryptError.message,
        stack: decryptError.stack,
      });
      // Re-throw decryption errors so they can be handled properly
      throw decryptError;
    }
  } catch (error) {
    // Only catch database errors, not decryption errors
    if (error.message && error.message.includes('decrypt')) {
      throw error; // Re-throw decryption errors
    }
    logger.error('Error getting user Twilio credentials from database', {
      userId,
      error: error.message,
      stack: error.stack,
    });
    throw error; // Re-throw database errors too
  }
}

/**
 * Decrypt Twilio credentials
 * @param {Object} encryptedCredentials - Encrypted credentials from database
 * @returns {Object} - Decrypted credentials
 */
export function decryptTwilioCredentials(encryptedCredentials) {
  try {
    return {
      accountSid: decryptApiKey(encryptedCredentials.encrypted_account_sid),
      authToken: decryptApiKey(encryptedCredentials.encrypted_auth_token),
    };
  } catch (error) {
    logger.error('Error decrypting Twilio credentials', {
      error: error.message,
    });
    throw new Error('Failed to decrypt Twilio credentials');
  }
}
