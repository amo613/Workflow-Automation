import { db } from '#config/database.js';
import { userTwilioCredentials } from '#models/user-twilio-credentials.model.js';
import { decryptApiKey } from '#utils/encryption.utils.js';
import { eq } from 'drizzle-orm';
import logger from '#config/logger.js';

/**
 * Get user Twilio credentials (from database)
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>} - Decrypted credentials or null
 */
export async function getUserTwilioCredentials(userId) {
  try {
    const [credentials] = await db
      .select()
      .from(userTwilioCredentials)
      .where(eq(userTwilioCredentials.user_id, userId))
      .limit(1);

    if (!credentials) {
      return null;
    }

    return decryptTwilioCredentials(credentials);
  } catch (error) {
    logger.error('Error getting user Twilio credentials', {
      userId,
      error: error.message,
    });
    return null;
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
