/* eslint-env browser */
/**
 * Workflow Service
 * Handles all API calls related to workflows
 */
export const workflowService = {
  async fetchWorkflows() {
    const response = await fetch('/api/workflows', {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to fetch workflows');
    const data = await response.json();
    return data.data || [];
  },
};
