import logger from '#config/logger.js';

/**
 * HubSpot Webhook Subscription Service
 * Manages webhook subscriptions for HubSpot events
 */
export class HubSpotWebhookService {
  /**
   * Get HubSpot App ID from environment
   * @returns {string} App ID
   */
  getAppId() {
    const appId = process.env.HUBSPOT_APP_ID;
    if (!appId) {
      throw new Error(
        'HUBSPOT_APP_ID not configured. Please set it in your environment variables.'
      );
    }
    return appId;
  }

  /**
   * Create a webhook subscription for HubSpot events
   * @param {string} accessToken - HubSpot access token
   * @param {string} eventType - Event type (e.g., 'contact.creation')
   * @param {string} webhookUrl - Webhook URL to receive events
   * @returns {Promise<Object>} Created subscription
   */
  async createSubscription(accessToken, eventType, webhookUrl) {
    const appId = this.getAppId();

    const url = `https://api.hubapi.com/webhooks/v3/${appId}/subscriptions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        eventType,
        propertyName: null, // For propertyChange events, this would be the property name
        active: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('HubSpot create subscription failed', {
        status: response.status,
        error: errorText,
        eventType,
      });
      throw new Error(
        `Failed to create subscription: ${response.status} ${errorText}`
      );
    }

    const result = await response.json();
    logger.info('HubSpot subscription created', {
      subscriptionId: result.id,
      eventType,
      webhookUrl, // Log for reference - must be set in HubSpot App Settings
    });

    // IMPORTANT: Webhook URL cannot be set via API for v3 subscriptions
    // The URL must be configured manually in HubSpot App Settings:
    // Settings > Integrations > Webhooks > Your App > Ziel-URL
    // The updateSubscriptionUrl method below doesn't work for setting URLs
    // We keep it for reference but it only sets active: true

    return result;
  }

  /**
   * Update subscription (NOTE: This does NOT set the webhook URL)
   * The webhook URL must be configured in HubSpot App Settings manually
   * This method only updates the subscription status (active/inactive)
   * @param {string} accessToken - HubSpot access token
   * @param {string} subscriptionId - Subscription ID
   * @param {string} webhookUrl - Webhook URL (for logging only, not used)
   * @returns {Promise<Object>} Updated subscription
   */
  async updateSubscriptionUrl(accessToken, subscriptionId, webhookUrl) {
    const appId = this.getAppId();

    // NOTE: HubSpot v3 API does not allow setting webhook URL via API
    // The URL must be set in App Settings: Settings > Integrations > Webhooks
    // This method only updates the subscription status
    const url = `https://api.hubapi.com/webhooks/v3/${appId}/subscriptions/${subscriptionId}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        active: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn('HubSpot update subscription status failed', {
        status: response.status,
        error: errorText,
        subscriptionId,
        note: 'Webhook URL must be set in HubSpot App Settings, not via API',
        webhookUrl, // Log for reference
      });
    } else {
      logger.info('HubSpot subscription status updated', {
        subscriptionId,
        webhookUrl, // Log for reference - must be set in App Settings
      });
    }

    return await response.json();
  }

  /**
   * Delete a webhook subscription
   * @param {string} accessToken - HubSpot access token
   * @param {string} subscriptionId - Subscription ID
   * @returns {Promise<void>}
   */
  async deleteSubscription(accessToken, subscriptionId) {
    const appId = this.getAppId();

    const url = `https://api.hubapi.com/webhooks/v3/${appId}/subscriptions/${subscriptionId}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('HubSpot delete subscription failed', {
        status: response.status,
        error: errorText,
        subscriptionId,
      });
      // Don't throw if subscription doesn't exist (idempotent)
      if (response.status !== 404) {
        throw new Error(
          `Failed to delete subscription: ${response.status} ${errorText}`
        );
      }
    }

    logger.info('HubSpot subscription deleted', { subscriptionId });
  }

  /**
   * Get all webhook subscriptions
   * @param {string} accessToken - HubSpot access token
   * @returns {Promise<Array>} List of subscriptions
   */
  async getSubscriptions(accessToken) {
    const appId = this.getAppId();

    const url = `https://api.hubapi.com/webhooks/v3/${appId}/subscriptions`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('HubSpot get subscriptions failed', {
        status: response.status,
        error: errorText,
      });
      throw new Error(
        `Failed to get subscriptions: ${response.status} ${errorText}`
      );
    }

    const result = await response.json();
    return result.results || [];
  }

  /**
   * Create multiple subscriptions for multiple event types
   * @param {string} accessToken - HubSpot access token
   * @param {Array<string>} eventTypes - Array of event types
   * @param {string} webhookUrl - Webhook URL
   * @returns {Promise<Array>} Created subscriptions
   */
  async createMultipleSubscriptions(accessToken, eventTypes, webhookUrl) {
    const subscriptions = [];
    const errors = [];

    for (const eventType of eventTypes) {
      try {
        const subscription = await this.createSubscription(
          accessToken,
          eventType,
          webhookUrl
        );
        subscriptions.push({
          subscriptionId: subscription.id,
          eventType,
        });
      } catch (error) {
        logger.error('Failed to create subscription for event type', {
          eventType,
          error: error.message,
        });
        errors.push({ eventType, error: error.message });
      }
    }

    if (errors.length > 0 && subscriptions.length === 0) {
      throw new Error(
        `Failed to create any subscriptions: ${errors.map(e => e.error).join(', ')}`
      );
    }

    if (errors.length > 0) {
      logger.warn('Some subscriptions failed to create', { errors });
    }

    return { subscriptions, errors };
  }

  /**
   * Delete multiple subscriptions
   * @param {string} accessToken - HubSpot access token
   * @param {Array<string>} subscriptionIds - Array of subscription IDs
   * @returns {Promise<void>}
   */
  async deleteMultipleSubscriptions(accessToken, subscriptionIds) {
    const errors = [];

    for (const subscriptionId of subscriptionIds) {
      try {
        await this.deleteSubscription(accessToken, subscriptionId);
      } catch (error) {
        logger.error('Failed to delete subscription', {
          subscriptionId,
          error: error.message,
        });
        errors.push({ subscriptionId, error: error.message });
      }
    }

    if (errors.length > 0) {
      logger.warn('Some subscriptions failed to delete', { errors });
    }
  }
}

export const hubspotWebhookService = new HubSpotWebhookService();
