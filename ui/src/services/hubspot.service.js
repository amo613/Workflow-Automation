/* eslint-env browser */
import { fetchWithCSRF } from '../utils/csrf.utils.js';

/**
 * HubSpot Service
 * Handles all API calls related to HubSpot CRM integration
 */
export const hubspotService = {
  async fetchStatus() {
    const response = await fetch('/api/integrations/hubspot/status', {
      credentials: 'include',
      cache: 'no-cache',
    });
    if (!response.ok) {
      throw new Error('Failed to fetch status');
    }
    const data = await response.json();
    return data;
  },

  async fetchLists() {
    const response = await fetch('/api/integrations/hubspot/lists', {
      credentials: 'include',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch lists: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    return Array.isArray(data.data)
      ? data.data
      : data.success && Array.isArray(data.data)
        ? data.data
        : [];
  },

  async fetchContacts(limit = 100) {
    const response = await fetch(
      `/api/integrations/hubspot/contacts?limit=${limit}`,
      {
        credentials: 'include',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch contacts: ${response.status} ${errorText}`
      );
    }
    const data = await response.json();
    return Array.isArray(data.data)
      ? data.data
      : data.success && Array.isArray(data.data)
        ? data.data
        : [];
  },

  async fetchCompanies(limit = 100) {
    const response = await fetch(
      `/api/integrations/hubspot/companies?limit=${limit}`,
      {
        credentials: 'include',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch companies: ${response.status} ${errorText}`
      );
    }
    const data = await response.json();
    return Array.isArray(data.data)
      ? data.data
      : data.success && Array.isArray(data.data)
        ? data.data
        : [];
  },

  async authenticate(returnUrl, workflowId) {
    const url = `/api/integrations/hubspot/auth?returnUrl=${encodeURIComponent(returnUrl || '/fullWorkflows')}${workflowId ? `&workflowId=${workflowId}` : ''}`;
    const response = await fetchWithCSRF(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to initiate authentication: ${response.status} ${errorText}`
      );
    }
    const data = await response.json();
    if (data.authUrl) {
      window.location.href = data.authUrl;
    } else {
      throw new Error('No auth URL received');
    }
  },

  async disconnect() {
    const response = await fetchWithCSRF('/api/integrations/hubspot', {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to disconnect: ${response.status} ${errorText}`);
    }
    return await response.json();
  },

  async createWebhookSubscriptions(eventTypes, webhookUrl) {
    const response = await fetchWithCSRF(
      '/api/integrations/hubspot/webhooks/subscriptions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ eventTypes, webhookUrl }),
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to create subscriptions: ${response.status} ${errorText}`
      );
    }
    return await response.json();
  },

  async deleteWebhookSubscriptions(subscriptionIds) {
    const response = await fetchWithCSRF(
      '/api/integrations/hubspot/webhooks/subscriptions',
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ subscriptionIds }),
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to delete subscriptions: ${response.status} ${errorText}`
      );
    }
    return await response.json();
  },

  async getWebhookSubscriptions() {
    const response = await fetch(
      '/api/integrations/hubspot/webhooks/subscriptions',
      {
        credentials: 'include',
        cache: 'no-cache',
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch subscriptions: ${response.status} ${errorText}`
      );
    }
    const data = await response.json();
    return Array.isArray(data.data) ? data.data : [];
  },
};
