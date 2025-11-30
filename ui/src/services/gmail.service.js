/* eslint-env browser */
import { fetchWithCSRF } from '../utils/csrf.utils.js';

/**
 * Gmail Service
 * Handles all API calls related to Gmail integration
 */
export const gmailService = {
  async fetchStatus() {
    const response = await fetch('/api/integrations/gmail/status', {
      credentials: 'include',
      cache: 'no-cache',
    });
    if (!response.ok) {
      throw new Error('Failed to fetch status');
    }
    const data = await response.json();
    return data;
  },

  async authenticate() {
    const response = await fetchWithCSRF('/api/integrations/gmail/auth', {
      method: 'GET',
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to authenticate');
    const data = await response.json();
    if (data.authUrl) {
      window.location.href = data.authUrl;
    }
  },

  async disconnect() {
    const response = await fetchWithCSRF('/api/integrations/gmail', {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to disconnect');
    return response.json();
  },
};

