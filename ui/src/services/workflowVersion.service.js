/* eslint-env browser */
import { fetchWithCSRF } from '../utils/csrf.utils.js';

/**
 * Service for workflow version management
 */
const API_BASE = '/api/full-workflows';

export const workflowVersionService = {
  /**
   * Get all versions for a workflow with pagination
   */
  async getVersions(workflowId, options = {}) {
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    const response = await fetch(
      `${API_BASE}/${workflowId}/versions?${params.toString()}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: 'Failed to fetch versions' }));
      throw new Error(error.error || 'Failed to fetch versions');
    }

    const data = await response.json();
    return {
      versions: data.data || [],
      total: data.total || 0,
      hasMore: data.hasMore || false,
    };
  },

  /**
   * Get a specific version
   */
  async getVersion(workflowId, versionId) {
    const response = await fetch(
      `${API_BASE}/${workflowId}/versions/${versionId}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: 'Failed to fetch version' }));
      throw new Error(error.error || 'Failed to fetch version');
    }

    const data = await response.json();
    return data.data;
  },

  /**
   * Restore workflow to a version
   */
  async restoreVersion(workflowId, versionId) {
    const response = await fetchWithCSRF(
      `${API_BASE}/${workflowId}/versions/${versionId}/restore`,
      {
        method: 'POST',
        credentials: 'include',
      }
    );

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: 'Failed to restore version' }));
      throw new Error(error.error || 'Failed to restore version');
    }

    const data = await response.json();
    return data.data;
  },

  /**
   * Delete a version
   */
  async deleteVersion(workflowId, versionId) {
    const response = await fetchWithCSRF(
      `${API_BASE}/${workflowId}/versions/${versionId}`,
      {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: 'Failed to delete version' }));
      throw new Error(error.error || 'Failed to delete version');
    }

    return { success: true };
  },
};
