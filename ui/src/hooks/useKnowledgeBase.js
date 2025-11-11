import { useState, useEffect } from 'react';
import { knowledgeBaseService } from '../services/knowledgeBase.service.js';

/**
 * Custom hook for fetching and managing knowledge base entries
 */
export function useKnowledgeBase(shouldFetch = false) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await knowledgeBaseService.fetchEntries();
      setEntries(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching knowledge base entries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (shouldFetch) {
      fetchEntries();
    }
  }, [shouldFetch]);

  return { entries, loading, error, refetch: fetchEntries };
}
