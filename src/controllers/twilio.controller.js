import logger from '#config/logger.js';
import { db } from '#config/database.js';
import { userTwilioCredentials } from '#models/user-twilio-credentials.model.js';
import { encryptApiKey } from '#utils/encryption.utils.js';
import { eq } from 'drizzle-orm';

/**
 * Save or update user Twilio credentials
 */
export async function saveTwilioCredentialsHandler(req, reply) {
  try {
    const userId = req.user.id;
    const { accountSid, authToken } = req.body;

    if (!accountSid || !authToken) {
      return reply.code(400).send({
        success: false,
        error: 'All required fields must be provided',
      });
    }

    // Encrypt credentials
    const encryptedCredentials = {
      encrypted_account_sid: encryptApiKey(accountSid),
      encrypted_auth_token: encryptApiKey(authToken),
    };

    // Check if user already has credentials
    const [existing] = await db
      .select()
      .from(userTwilioCredentials)
      .where(eq(userTwilioCredentials.user_id, userId))
      .limit(1);

    if (existing) {
      // Update existing credentials
      await db
        .update(userTwilioCredentials)
        .set({
          ...encryptedCredentials,
          updated_at: new Date(),
        })
        .where(eq(userTwilioCredentials.user_id, userId));

      logger.info('User Twilio credentials updated', { userId });
    } else {
      // Insert new credentials
      await db.insert(userTwilioCredentials).values({
        user_id: userId,
        ...encryptedCredentials,
      });

      logger.info('User Twilio credentials saved', { userId });
    }

    return reply.code(200).send({
      success: true,
      message: 'Twilio credentials saved successfully',
    });
  } catch (error) {
    logger.error('Error saving Twilio credentials', {
      error: error.message,
      stack: error.stack,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to save Twilio credentials',
    });
  }
}

/**
 * Delete user Twilio credentials
 */
export async function deleteTwilioCredentialsHandler(req, reply) {
  try {
    const userId = req.user.id;

    await db
      .delete(userTwilioCredentials)
      .where(eq(userTwilioCredentials.user_id, userId));

    logger.info('User Twilio credentials deleted', { userId });

    return reply.code(200).send({
      success: true,
      message: 'Twilio credentials deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting Twilio credentials', {
      error: error.message,
      stack: error.stack,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to delete Twilio credentials',
    });
  }
}

/**
 * Check if user has Twilio credentials
 */
export async function checkTwilioCredentialsHandler(req, reply) {
  try {
    const userId = req.user.id;

    const [credentials] = await db
      .select()
      .from(userTwilioCredentials)
      .where(eq(userTwilioCredentials.user_id, userId))
      .limit(1);

    return reply.code(200).send({
      success: true,
      hasCredentials: !!credentials,
    });
  } catch (error) {
    logger.error('Error checking Twilio credentials', {
      error: error.message,
      stack: error.stack,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to check Twilio credentials',
    });
  }
}
