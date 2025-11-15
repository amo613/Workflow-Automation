import logger from '#config/logger.js';
import { db } from '#config/database.js';
import { userEmailCredentials } from '#models/user-email-credentials.model.js';
import { encryptApiKey } from '#utils/encryption.utils.js';
import { eq } from 'drizzle-orm';

/**
 * Save or update user email credentials
 */
export async function saveEmailCredentialsHandler(req, reply) {
  try {
    const userId = req.user.id;
    const {
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword,
      fromEmail,
      fromName,
      useTls = true,
    } = req.body;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword || !fromEmail) {
      return reply.code(400).send({
        success: false,
        error: 'All required fields must be provided',
      });
    }

    // Encrypt credentials
    const encryptedCredentials = {
      encrypted_smtp_host: encryptApiKey(smtpHost),
      encrypted_smtp_port: encryptApiKey(smtpPort),
      encrypted_smtp_user: encryptApiKey(smtpUser),
      encrypted_smtp_password: encryptApiKey(smtpPassword),
      encrypted_from_email: encryptApiKey(fromEmail),
      encrypted_from_name: fromName ? encryptApiKey(fromName) : null,
      use_tls: useTls ? 1 : 0,
    };

    // Check if user already has credentials
    const [existing] = await db
      .select()
      .from(userEmailCredentials)
      .where(eq(userEmailCredentials.user_id, userId))
      .limit(1);

    if (existing) {
      // Update existing credentials
      await db
        .update(userEmailCredentials)
        .set({
          ...encryptedCredentials,
          updated_at: new Date(),
        })
        .where(eq(userEmailCredentials.user_id, userId));

      logger.info('User email credentials updated', { userId });
    } else {
      // Insert new credentials
      await db.insert(userEmailCredentials).values({
        user_id: userId,
        ...encryptedCredentials,
      });

      logger.info('User email credentials saved', { userId });
    }

    return reply.code(200).send({
      success: true,
      message: 'Email credentials saved successfully',
    });
  } catch (error) {
    logger.error('Error saving email credentials', {
      error: error.message,
      userId: req.user?.id,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to save email credentials',
    });
  }
}

/**
 * Delete user email credentials
 */
export async function deleteEmailCredentialsHandler(req, reply) {
  try {
    const userId = req.user.id;

    await db
      .delete(userEmailCredentials)
      .where(eq(userEmailCredentials.user_id, userId));

    logger.info('User email credentials deleted', { userId });

    return reply.code(200).send({
      success: true,
      message: 'Email credentials deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting email credentials', {
      error: error.message,
      userId: req.user?.id,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to delete email credentials',
    });
  }
}

/**
 * Check if user has email credentials
 */
export async function checkEmailCredentialsHandler(req, reply) {
  try {
    const userId = req.user.id;

    const [credentials] = await db
      .select()
      .from(userEmailCredentials)
      .where(eq(userEmailCredentials.user_id, userId))
      .limit(1);

    return reply.code(200).send({
      success: true,
      hasCredentials: !!credentials,
    });
  } catch (error) {
    logger.error('Error checking email credentials', {
      error: error.message,
      userId: req.user?.id,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to check email credentials',
    });
  }
}
