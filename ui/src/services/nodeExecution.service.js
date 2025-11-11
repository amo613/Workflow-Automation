/* eslint-env browser */
/**
 * Node Execution Service
 * Handles single node execution for testing
 */
export const nodeExecutionService = {
  async executeNode(node, edges, input) {
    const response = await fetch('/api/full-workflows/execute-node', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ node, edges, input }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to execute node');
    }
    return response.json();
  },
};
