/* eslint-env browser */

import { fetchWithCSRF } from '../utils/csrf.utils.js';

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
      const error = await response
        .json()
        .catch(() => ({ error: 'Failed to fetch performance' }));
      throw new Error(error.error || 'Failed to fetch performance');
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
      const error = await response
        .json()
        .catch(() => ({ error: 'Failed to fetch node history' }));
      throw new Error(error.error || 'Failed to fetch node history');
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
      const error = await response
        .json()
        .catch(() => ({ error: 'Failed to clear performance' }));
      throw new Error(error.error || 'Failed to clear performance');
    }

    return { success: true };
  },
};
