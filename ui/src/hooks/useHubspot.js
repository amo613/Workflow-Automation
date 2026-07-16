import { useState, useEffect } from 'react';
import { hubspotService } from '../services/hubspot.service.js';

/**
 * Custom hook for managing HubSpot CRM integration
 */
export function useHubspot(shouldFetch = false) {
  const [status, setStatus] = useState(null);
  const [lists, setLists] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await hubspotService.fetchStatus();
      setStatus(data);
      if (data && data.connected) {
        // Fetch lists when connected
        try {
          const listsData = await hubspotService.fetchLists();
          setLists(listsData || []);
        } catch (listsErr) {
          console.error('Error fetching lists after status check:', listsErr);
          setLists([]);
        }
      } else {
        setLists([]);
      }
    } catch (err) {
      setError(err.message);
      setStatus({ connected: false });
      setLists([]);
      console.error('Error fetching HubSpot status:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLists = async () => {
    try {
      const data = await hubspotService.fetchLists();
      setLists(data);
    } catch (err) {
      setError(err.message);
      setLists([]);
      console.error('Error fetching lists:', err);
    }
  };

  const fetchContacts = async (limit = 100) => {
    try {
      const data = await hubspotService.fetchContacts(limit);
      setContacts(data);
    } catch (err) {
      setError(err.message);
      setContacts([]);
      console.error('Error fetching contacts:', err);
    }
  };

  const fetchCompanies = async (limit = 100) => {
    try {
      const data = await hubspotService.fetchCompanies(limit);
      setCompanies(data);
    } catch (err) {
      setError(err.message);
      setCompanies([]);
      console.error('Error fetching companies:', err);
    }
  };

  const authenticate = async (returnUrl, workflowId) => {
    try {
      await hubspotService.authenticate(returnUrl, workflowId);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const disconnect = async () => {
    try {
      await hubspotService.disconnect();
      setStatus({ connected: false });
      setLists([]);
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
    lists,
    contacts,
    companies,
    loading,
    error,
    fetchStatus,
    fetchLists,
    fetchContacts,
    fetchCompanies,
    authenticate,
    disconnect,
  };
}
