import { useState, useEffect } from 'react';
import { gmailService } from '../services/gmail.service.js';

/**
 * Custom hook for managing Gmail integration
 */
export function useGmail(shouldFetch = false) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await gmailService.fetchStatus();
      setStatus(data);
    } catch (err) {
      setError(err.message);
      setStatus({ connected: false });
      console.error('Error fetching Gmail status:', err);
    } finally {
      setLoading(false);
    }
  };

  const authenticate = async () => {
    try {
      await gmailService.authenticate();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const disconnect = async () => {
    try {
      await gmailService.disconnect();
      setStatus({ connected: false });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    if (shouldFetch) {
      fetchStatus();
    }
  }, [shouldFetch]);

  return {
    status,
    loading,
    error,
    fetchStatus,
    authenticate,
    disconnect,
  };
}

