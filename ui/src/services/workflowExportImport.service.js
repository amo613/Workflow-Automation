/* eslint-env browser */

/**
 * Service for workflow export/import
 */
const API_BASE = '/api/full-workflows';

export const workflowExportImportService = {
  /**
   * Export workflow as JSON file
   */
  async exportWorkflow(workflowId) {
    const response = await fetch(`${API_BASE}/${workflowId}/export`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: 'Failed to export workflow' }));
      throw new Error(error.error || 'Failed to export workflow');
    }

    // Get filename from Content-Disposition header or use default
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `workflow-${workflowId}.json`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    // Get blob and create download link
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    return { success: true, filename };
  },

  /**
   * Import workflow from JSON file
   */
  async importWorkflow(workflowData, name = null) {
    const response = await fetch(`${API_BASE}/import`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflowData,
        name,
      }),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: 'Failed to import workflow' }));
      throw new Error(error.error || 'Failed to import workflow');
    }

    const data = await response.json();
    return data.data;
  },
};
