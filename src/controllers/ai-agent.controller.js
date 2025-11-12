import logger from '#config/logger.js';
import { db } from '#config/database.js';
import { userOpenAiKeys } from '#models/user-openai-keys.model.js';
import { encryptApiKey } from '#utils/encryption.utils.js';
import { eq } from 'drizzle-orm';

/**
 * Save or update user OpenAI API key
 */
export async function saveApiKeyHandler(req, reply) {
  try {
    const userId = req.user.id;
    const { apiKey } = req.body;

    if (!apiKey) {
      return reply.code(400).send({
        success: false,
        error: 'API key is required',
      });
    }

    // Encrypt API key
    const encryptedKey = encryptApiKey(apiKey);

    // Check if user already has an API key
    const [existingKey] = await db
      .select()
      .from(userOpenAiKeys)
      .where(eq(userOpenAiKeys.user_id, userId))
      .limit(1);

    if (existingKey) {
      // Update existing key
      await db
        .update(userOpenAiKeys)
        .set({
          encrypted_api_key: encryptedKey,
          updated_at: new Date(),
        })
        .where(eq(userOpenAiKeys.user_id, userId));

      logger.info('User OpenAI API key updated', { userId });
    } else {
      // Insert new key
      await db.insert(userOpenAiKeys).values({
        user_id: userId,
        encrypted_api_key: encryptedKey,
      });

      logger.info('User OpenAI API key saved', { userId });
    }

    return reply.code(200).send({
      success: true,
      message: 'API key saved successfully',
    });
  } catch (error) {
    logger.error('Error saving API key', {
      error: error.message,
      userId: req.user?.id,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to save API key',
    });
  }
}

/**
 * Delete user OpenAI API key
 */
export async function deleteApiKeyHandler(req, reply) {
  try {
    const userId = req.user.id;

    await db.delete(userOpenAiKeys).where(eq(userOpenAiKeys.user_id, userId));

    logger.info('User OpenAI API key deleted', { userId });

    return reply.code(200).send({
      success: true,
      message: 'API key deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting API key', {
      error: error.message,
      userId: req.user?.id,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to delete API key',
    });
  }
}

/**
 * Check if user has API key (without returning it)
 */
export async function checkApiKeyHandler(req, reply) {
  try {
    const userId = req.user.id;

    const [userKey] = await db
      .select()
      .from(userOpenAiKeys)
      .where(eq(userOpenAiKeys.user_id, userId))
      .limit(1);

    return reply.code(200).send({
      success: true,
      hasApiKey: !!userKey,
    });
  } catch (error) {
    logger.error('Error checking API key', {
      error: error.message,
      userId: req.user?.id,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to check API key',
    });
  }
}

/**
 * Get available OpenAI models
 */
export async function getModelsHandler(req, reply) {
  try {
    const models = [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable model' },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Fast and cost-effective',
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: 'Previous generation',
      },
      {
        id: 'o1-mini',
        name: 'O1 Mini',
        description: 'Reasoning model (if available)',
      },
    ];

    return reply.code(200).send({
      success: true,
      data: models,
    });
  } catch (error) {
    logger.error('Error getting models', {
      error: error.message,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to get models',
    });
  }
}
