/* eslint-env browser */

import { fetchWithCSRF } from '../utils/csrf.utils.js';

const DEFAULT_ERROR_FALLBACK = 'Request failed. Please try again.';

const buildResponseError = async (response, fallbackMessage) => {
  let message = fallbackMessage || DEFAULT_ERROR_FALLBACK;

  try {
    const payload = await response.clone().json();
    message =
      payload?.error || payload?.message || payload?.data?.error || message;
  } catch {
    try {
      const textPayload = await response.text();
      if (textPayload) {
        message = textPayload.slice(0, 200);
      }
    } catch {
      // Ignore - keep fallback message
    }
  }

  const error = new Error(message);
  error.status = response.status;
  return error;
};

/**
 * Service for workflow performance data
 */
const API_BASE = '/api/full-workflows';

export const workflowPerformanceService = {
  /**
   * Get workflow performance statistics
   */
  async getPerformance(workflowId) {
    const response = await fetchWithCSRF(
      `${API_BASE}/${workflowId}/performance`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw await buildResponseError(response, 'Failed to fetch performance');
    }

    const data = await response.json();
    return data.data;
  },

  /**
   * Get node execution history for graph
   */
  async getNodeHistory(workflowId, nodeId, limit = 50) {
    const response = await fetchWithCSRF(
      `${API_BASE}/${workflowId}/nodes/${encodeURIComponent(nodeId)}/performance?limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw await buildResponseError(response, 'Failed to fetch node history');
    }

    const data = await response.json();
    return data.data || [];
  },

  /**
   * Clear performance data
   */
  async clearPerformance(workflowId) {
    const response = await fetchWithCSRF(
      `${API_BASE}/${workflowId}/performance`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw await buildResponseError(response, 'Failed to clear performance');
    }

    return { success: true };
  },
};
