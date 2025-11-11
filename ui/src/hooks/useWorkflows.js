import { useState, useEffect } from 'react';
import { workflowService } from '../services/workflow.service.js';

/**
 * Custom hook for fetching and managing workflows
 */
export function useWorkflows(shouldFetch = false) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchWorkflows = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await workflowService.fetchWorkflows();
      setWorkflows(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (shouldFetch) {
      fetchWorkflows();
    }
  }, [shouldFetch]);

  return { workflows, loading, error, refetch: fetchWorkflows };
}
