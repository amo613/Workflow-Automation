import { db } from '#config/database.js';
import { integrations } from '#models/integration.model.js';
import { eq, and } from 'drizzle-orm';
import logger from '#config/logger.js';

function parseGrantedScopes(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    logger.warn('Failed to parse integration scopes');
    return [];
  }
}

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
      externalAccountId: integration.external_account_id,
      grantedScopes: parseGrantedScopes(integration.granted_scopes),
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

/**
 * Update integration for a user
 * @param {number} userId - User ID
 * @param {string} integrationType - Integration type (e.g., 'HUBSPOT', 'GOOGLE_CALENDAR')
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} - Updated integration object
 */
export async function updateIntegration(userId, integrationType, updateData) {
  try {
    // Normalize integration type
    let normalizedType = integrationType.toUpperCase();
    if (normalizedType === 'GOOGLE') {
      normalizedType = 'GOOGLE_CALENDAR';
    }

    // Build update object
    const updateFields = {
      updated_at: new Date(),
    };

    if (updateData.is_active !== undefined) {
      updateFields.is_active = updateData.is_active;
    }
    if (updateData.is_complete !== undefined) {
      updateFields.is_complete = updateData.is_complete;
    }
    if (updateData.access_token !== undefined) {
      updateFields.access_token = updateData.access_token;
    }
    if (updateData.refresh_token !== undefined) {
      updateFields.refresh_token = updateData.refresh_token;
    }
    if (updateData.token_expires_at !== undefined) {
      updateFields.token_expires_at = updateData.token_expires_at;
    }
    if (updateData.external_account_id !== undefined) {
      updateFields.external_account_id = updateData.external_account_id;
    }
    if (updateData.granted_scopes !== undefined) {
      updateFields.granted_scopes = Array.isArray(updateData.granted_scopes)
        ? JSON.stringify(updateData.granted_scopes)
        : updateData.granted_scopes;
    }
    if (updateData.email !== undefined) {
      updateFields.email = updateData.email;
    }
    if (updateData.timezone !== undefined) {
      updateFields.timezone = updateData.timezone;
    }
    if (updateData.calendar_id !== undefined) {
      updateFields.calendar_id = updateData.calendar_id;
    }
    if (updateData.mode !== undefined) {
      updateFields.mode = updateData.mode;
    }

    const [updated] = await db
      .update(integrations)
      .set(updateFields)
      .where(
        and(
          eq(integrations.user_id, userId),
          eq(integrations.integration_type, normalizedType)
        )
      )
      .returning();

    if (!updated) {
      throw new Error(
        `Integration not found for user ${userId} and type ${normalizedType}`
      );
    }

    logger.info('Integration updated', {
      userId,
      integrationType: normalizedType,
      updatedFields: Object.keys(updateFields),
    });

    return {
      id: updated.id,
      userId: updated.user_id,
      integrationType: updated.integration_type,
      accessToken: updated.access_token,
      refreshToken: updated.refresh_token,
      tokenExpiresAt: updated.token_expires_at,
      email: updated.email,
      timezone: updated.timezone,
      calendarId: updated.calendar_id,
      mode: updated.mode,
      isActive: updated.is_active,
      isComplete: updated.is_complete,
    };
  } catch (error) {
    logger.error('Error updating integration', {
      userId,
      integrationType,
      error: error.message,
    });
    throw error;
  }
}
