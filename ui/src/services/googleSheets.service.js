/* eslint-env browser */
import { fetchWithCSRF } from '../utils/csrf.utils.js';

/**
 * Google Sheets Service
 * Handles all API calls related to Google Sheets integration
 */
export const googleSheetsService = {
  async fetchStatus() {
    const response = await fetch('/api/integrations/google-sheets/status', {
      credentials: 'include',
      cache: 'no-cache',
    });
    if (!response.ok) {
      throw new Error('Failed to fetch status');
    }
    const data = await response.json();
    return data;
  },

  async fetchSpreadsheets() {
    const response = await fetch(
      '/api/integrations/google-sheets/spreadsheets',
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
        `Failed to fetch spreadsheets: ${response.status} ${errorText}`
      );
    }
    const data = await response.json();
    return Array.isArray(data.data)
      ? data.data
      : data.success && Array.isArray(data.data)
        ? data.data
        : [];
  },

  async fetchSheets(spreadsheetId) {
    if (!spreadsheetId) {
      return [];
    }
    const response = await fetch(
      `/api/integrations/google-sheets/spreadsheets/${spreadsheetId}/sheets`,
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
        `Failed to fetch sheets: ${response.status} ${errorText}`
      );
    }
    const data = await response.json();
    return Array.isArray(data.data)
      ? data.data
      : data.success && Array.isArray(data.data)
        ? data.data
        : [];
  },

  async authenticate() {
    const response = await fetchWithCSRF(
      '/api/integrations/google-sheets/auth',
      {
        method: 'POST',
        credentials: 'include',
      }
    );
    if (!response.ok) throw new Error('Failed to authenticate');
    const data = await response.json();
    if (data.authUrl) {
      window.location.href = data.authUrl;
    }
  },

  async disconnect() {
    const response = await fetchWithCSRF('/api/integrations/google-sheets', {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to disconnect');
    return response.json();
  },

  async fetchColumns(spreadsheetId, sheetName) {
    if (!spreadsheetId || !sheetName) {
      return [];
    }
    const response = await fetch(
      `/api/integrations/google-sheets/spreadsheets/${spreadsheetId}/sheets/${encodeURIComponent(sheetName)}/columns`,
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
        `Failed to fetch columns: ${response.status} ${errorText}`
      );
    }
    const data = await response.json();
    return Array.isArray(data.data)
      ? data.data
      : data.success && Array.isArray(data.data)
        ? data.data
        : [];
  },
};
