import { useState, useCallback, useEffect } from 'react';
import { fetchWithCSRF } from '../../utils/csrf.utils.js';
import { ACTIVE_TRIGGERS_REFRESH_INTERVAL_MS } from './constants.js';

export function useWorkflowTriggers({
  workflowId,
  isNewWorkflow,
  autoRefreshReady = true,
}) {
  const [activeTriggers, setActiveTriggers] = useState([]);
  const [showActiveTriggers, setShowActiveTriggers] = useState(true);
  const [triggersLoading, setTriggersLoading] = useState(false);
  const [triggersError, setTriggersError] = useState(null);

  const fetchActiveTriggers = useCallback(async () => {
    if (!workflowId || isNewWorkflow || !autoRefreshReady) return;
    try {
      setTriggersLoading(true);
      setTriggersError(null);
      const response = await fetchWithCSRF(
        `/api/full-workflows/${workflowId}/triggers`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch triggers');
      }
      const data = await response.json();
      const triggers = data.data || [];
      setActiveTriggers(triggers);
      if (triggers.length > 0) {
        setShowActiveTriggers(true);
      }
      console.log('Active triggers fetched:', triggers);
    } catch (error) {
      console.error('Error fetching active triggers:', error);
      setTriggersError(error.message);
    } finally {
      setTriggersLoading(false);
    }
  }, [isNewWorkflow, autoRefreshReady, workflowId]);

  useEffect(() => {
    if (!workflowId || isNewWorkflow || !autoRefreshReady) {
      return undefined;
    }

    fetchActiveTriggers();
    const interval = setInterval(
      fetchActiveTriggers,
      ACTIVE_TRIGGERS_REFRESH_INTERVAL_MS
    );
    return () => clearInterval(interval);
  }, [autoRefreshReady, fetchActiveTriggers, isNewWorkflow, workflowId]);

  return {
    activeTriggers,
    showActiveTriggers,
    setShowActiveTriggers,
    triggersLoading,
    triggersError,
    fetchActiveTriggers,
  };
}
