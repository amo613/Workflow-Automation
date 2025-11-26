/* eslint-env browser */
import { fetchWithCSRF } from '../utils/csrf.utils.js';

/**
 * Node Execution Service
 * Handles single node execution for testing
 */
export const nodeExecutionService = {
  async executeNode(node, edges, input, nodes = [], nodeOutputsMap = {}) {
    const response = await fetchWithCSRF('/api/full-workflows/execute-node', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ node, edges, input, nodes, nodeOutputsMap }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to execute node');
    }
    return response.json();
  },
};
