import { db } from '#config/database.js';
import { integrations } from '#models/integration.model.js';
import { eq, and } from 'drizzle-orm';
import logger from '#config/logger.js';

/**
 * Get integration for a user
 * @param {number} userId - User ID
 * @param {string} integrationType - Integration type (e.g., 'GOOGLE_CALENDAR', 'google')
 * @returns {Promise<Object|null>} - Integration object or null
 */
export async function getIntegration(userId, integrationType) {
  try {
    // Normalize integration type
    let normalizedType = integrationType.toUpperCase();
    if (normalizedType === 'GOOGLE') {
      normalizedType = 'GOOGLE_CALENDAR'; // Default to calendar for backward compatibility
    }

    const [integration] = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.user_id, userId),
          eq(integrations.integration_type, normalizedType),
          eq(integrations.is_active, true)
        )
      )
      .limit(1);

    if (!integration) {
      logger.debug('Integration not found', {
        userId,
        integrationType: normalizedType,
      });
      return null;
    }

    return {
      id: integration.id,
      userId: integration.user_id,
      integrationType: integration.integration_type,
      accessToken: integration.access_token,
      refreshToken: integration.refresh_token,
      tokenExpiresAt: integration.token_expires_at,
      email: integration.email,
      timezone: integration.timezone,
      calendarId: integration.calendar_id,
      mode: integration.mode,
      isActive: integration.is_active,
      isComplete: integration.is_complete,
    };
  } catch (error) {
    logger.error('Error getting integration', {
      userId,
      integrationType,
      error: error.message,
    });
    throw error;
  }
}
