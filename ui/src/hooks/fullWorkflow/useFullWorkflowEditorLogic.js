/* global alert, confirm, URLSearchParams */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { addEdge, useNodesState, useEdgesState } from 'reactflow';
import { workflowExportImportService } from '../../services/workflowExportImport.service.js';
import { workflowPerformanceService } from '../../services/workflowPerformance.service.js';
import { fetchWithCSRF } from '../../utils/csrf.utils.js';
import { useExecutionTracking } from './useExecutionTracking.js';
import { useWorkflowEvents } from './useWorkflowEvents.js';
import { useWorkflowStatistics } from './useWorkflowStatistics.js';
import { useWorkflowPerformanceData } from './useWorkflowPerformanceData.js';
import { useWorkflowTriggers } from './useWorkflowTriggers.js';
import { useWorkflowHistory } from './useWorkflowHistory.js';
import { EXECUTION_POLL_INTERVAL_MS } from './constants.js';
import {
  getLastCallFlowId,
  setLastFullWorkflowId,
  clearLastFullWorkflowId,
} from '../../utils/callFlowStorage.js';

export function useFullWorkflowEditorLogic() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isNew = !id;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('automation');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
  const [autoRefreshReady, setAutoRefreshReady] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executionStatus, setExecutionStatus] = useState(null);
  const pollingIntervalRef = useRef(null);
  const pollingTimeoutRef = useRef(null);
  const [generalError, setGeneralError] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedNodeForGraph, setSelectedNodeForGraph] = useState(null);

  const executionTracking = useExecutionTracking({
    workflowId: id,
    setNodes,
    pollIntervalMs: EXECUTION_POLL_INTERVAL_MS,
    onExecutionComplete: useCallback((eventId, status) => {
      // Reset executing state when execution completes
      setExecuting(false);
      setExecutionStatus({
        status: status === 'completed' ? 'success' : 'error',
        message:
          status === 'completed'
            ? 'Workflow execution completed'
            : 'Workflow execution failed',
      });
    }, []),
  });

  const statisticsState = useWorkflowStatistics({
    workflowId: id,
    isNewWorkflow: isNew,
    autoRefreshReady,
  });
  const { fetchStatistics } = statisticsState;

  const performanceState = useWorkflowPerformanceData({
    workflowId: id,
    isNewWorkflow: isNew,
    autoRefreshReady,
    selectedNodeForGraph,
  });
  const { fetchPerformance } = performanceState;

  const triggersState = useWorkflowTriggers({
    workflowId: id,
    isNewWorkflow: isNew,
    autoRefreshReady,
  });
  const { fetchActiveTriggers } = triggersState;

  const historyState = useWorkflowHistory({
    workflowId: id,
    isNewWorkflow: isNew,
    autoRefreshReady,
    activeExecutionsRef: executionTracking.activeExecutionsRef,
    activeExecutionsPollingRef: executionTracking.activeExecutionsPollingRef,
    setNodes,
    startPollingExecution: executionTracking.startPollingExecution,
  });
  const { fetchExecutionHistory } = historyState;

  const onNodeUpdate = useCallback(
    (nodeId, newData) => {
      setNodes(nds => {
        const updatedNodes = nds.map(node => {
          if (node.id === nodeId) {
            const updatedData = { ...node.data, ...newData };
            const updatedNode = { ...node, data: updatedData };
            if (selectedNode && selectedNode.id === nodeId) {
              setSelectedNode({ ...updatedNode });
            }
            return updatedNode;
          }
          return node;
        });
        return updatedNodes;
      });
    },
    [selectedNode, setNodes]
  );

  const onConnect = useCallback(
    params => {
      setEdges(eds => addEdge(params, eds));
    },
    [setEdges]
  );

  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  const toggleKnowledgeBase = useCallback(() => {
    setShowKnowledgeBase(prev => !prev);
  }, []);

  const handleBack = useCallback(() => {
    navigate('/fullWorkflows');
  }, [navigate]);

  const handleSwitchToCallFlow = useCallback(() => {
    const lastId = getLastCallFlowId();
    if (lastId) {
      navigate(`/workflows/edit/${lastId}`);
    } else {
      navigate('/workflows');
    }
  }, [navigate]);

  const fetchWorkflow = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const response = await fetch(`/api/full-workflows/${id}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Workflow doesn't exist - clear stored ID and navigate to list
          clearLastFullWorkflowId();
          navigate('/fullWorkflows');
          return;
        }
        throw new Error('Failed to fetch workflow');
      }

      const data = await response.json();
      const workflow = data.data;

      setName(workflow.name);
      setDescription(workflow.description || '');
      setType(workflow.type || 'automation');

      const workflowJson = workflow.workflow_json || {};
      setNodes(workflowJson.nodes || []);
      const loadedEdges = (workflowJson.edges || []).map((edge, index) => ({
        ...edge,
        id:
          edge.id ||
          `reactflow__edge-${edge.source}-${edge.target}` ||
          `edge-${index}-${edge.source}-${edge.target}`,
      }));
      setEdges(loadedEdges);
      setAutoRefreshReady(true);
    } catch (err) {
      // Only show alert if it's not a 404 (404 is handled above)
      if (err.message !== 'Failed to fetch workflow') {
        alert('Failed to load workflow: ' + err.message);
      }
      // Only log error if it's not a 404
      if (!err.message.includes('404')) {
        console.error('Error fetching workflow:', err);
      }
      // Only navigate if not already navigating (404 case)
      if (!err.message.includes('404')) {
        navigate('/fullWorkflows');
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigate, setEdges, setNodes]);

  useEffect(() => {
    setAutoRefreshReady(false);
  }, [id]);

  useEffect(() => {
    if (!isNew) {
      if (id) {
        setLastFullWorkflowId(id);
      }
      fetchWorkflow().catch(() => {});
    } else {
      setNodes([
        {
          id: 'start-1',
          type: 'start',
          position: { x: 250, y: 100 },
          data: {},
        },
      ]);
      setEdges([]);
      setLoading(false);
    }

    const googleSheetsParam = searchParams.get('googleSheets');
    if (googleSheetsParam === 'connected') {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('googleSheets');
      setSearchParams(newParams);
      alert('Google Sheets connected successfully!');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } else if (googleSheetsParam === 'error') {
      const error = searchParams.get('error');
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('googleSheets');
      newParams.delete('error');
      setSearchParams(newParams);
      alert(`Google Sheets connection failed: ${error || 'Unknown error'}`);
    }
  }, [fetchWorkflow, isNew, searchParams, setEdges, setNodes, setSearchParams]);

  useEffect(() => {
    if (isNew || !autoRefreshReady) {
      return undefined;
    }

    let isMounted = true;
    const timeouts = [];

    const scheduleFetch = (fn, delay) => {
      if (!fn) return;
      const timeoutId = setTimeout(() => {
        if (isMounted) {
          fn();
        }
      }, delay);
      timeouts.push(timeoutId);
    };

    scheduleFetch(fetchActiveTriggers, 200);
    scheduleFetch(fetchExecutionHistory, 400);
    scheduleFetch(fetchStatistics, 600);
    scheduleFetch(fetchPerformance, 800);

    return () => {
      isMounted = false;
      timeouts.forEach(clearTimeout);
    };
  }, [
    fetchActiveTriggers,
    fetchExecutionHistory,
    fetchPerformance,
    fetchStatistics,
    autoRefreshReady,
    isNew,
  ]);

  useWorkflowEvents({
    workflowId: id,
    isNewWorkflow: isNew,
    autoRefreshReady,
    activeExecutionsRef: executionTracking.activeExecutionsRef,
    startPollingExecution: executionTracking.startPollingExecution,
    pollExecution: executionTracking.pollExecution,
    fetchExecutionHistory: historyState.fetchExecutionHistory,
  });

  const addNode = useCallback(
    nodeType => {
      const newNode = {
        id: `${nodeType}-${Date.now()}`,
        type: nodeType,
        position: {
          x: Math.random() * 400 + 100,
          y: Math.random() * 400 + 100,
        },
        data: {},
      };
      setNodes(nds => [...nds, newNode]);
    },
    [setNodes]
  );

  const handleExecute = useCallback(async () => {
    if (!id) {
      alert('Please save the workflow first before executing');
      return;
    }

    try {
      const response = await fetchWithCSRF(`/api/full-workflows/${id}`);
      const data = await response.json();
      if (!data.data.is_active) {
        const activate = confirm(
          'Workflow is not active. Do you want to activate it and execute?'
        );
        if (activate) {
          await fetchWithCSRF(`/api/full-workflows/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: true }),
          });
        } else {
          return;
        }
      }
    } catch (error) {
      console.error('Error checking workflow status:', error);
    }

    try {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }

      setExecuting(true);
      setExecutionStatus({
        status: 'running',
        message: 'Starting workflow...',
      });

      setNodes(nds =>
        nds.map(node => ({
          ...node,
          data: { ...node.data, status: 'running' },
        }))
      );
      executionTracking.setExecutedEdges([]);

      const response = await fetchWithCSRF(
        `/api/full-workflows/${id}/trigger`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: {} }),
        }
      );

      const result = await response.json();

      if (response.status === 429 && result.data?.eventId) {
        executionTracking.startPollingExecution(result.data.eventId);
        return;
      }

      if (result.success && result.data?.eventId) {
        executionTracking.startPollingExecution(result.data.eventId);
      } else {
        setExecutionStatus({
          status: 'error',
          message: result.error || 'Failed to trigger workflow',
        });
        setNodes(nds =>
          nds.map(node => ({
            ...node,
            data: { ...node.data, status: 'failed' },
          }))
        );
        executionTracking.setExecutedEdges([]);
        setExecuting(false);

        await fetchStatistics();
        await fetchExecutionHistory();
      }
    } catch (error) {
      setExecutionStatus({
        status: 'error',
        message: error.message || 'Failed to execute workflow',
      });
      setNodes(nds =>
        nds.map(node => ({
          ...node,
          data: { ...node.data, status: 'failed' },
        }))
      );
      executionTracking.setExecutedEdges([]);

      await fetchStatistics();
      await fetchExecutionHistory();
      await fetchPerformance();
    } finally {
      setExecuting(false);
    }
  }, [
    executionTracking,
    fetchExecutionHistory,
    fetchPerformance,
    fetchStatistics,
    id,
  ]);

  const handleExport = useCallback(async () => {
    if (isNew) {
      alert('Please save the workflow before exporting');
      return;
    }

    try {
      setExporting(true);
      await workflowExportImportService.exportWorkflow(parseInt(id, 10));
    } catch (err) {
      alert('Failed to export workflow: ' + err.message);
      console.error('Error exporting workflow:', err);
    } finally {
      setExporting(false);
    }
  }, [id, isNew]);

  const handleImportSuccess = useCallback(
    importedWorkflow => {
      navigate(`/fullWorkflows/edit/${importedWorkflow.id}`);
    },
    [navigate]
  );

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      alert('Please enter a workflow name');
      return;
    }

    try {
      setSaving(true);

      const workflowJson = {
        nodes: nodes.map(({ id: nodeId, type, position, data }) => ({
          id: nodeId,
          type,
          position,
          data,
        })),
        edges: edges.map((edge, index) => {
          const edgeId =
            edge.id ||
            `reactflow__edge-${edge.source}-${edge.target}` ||
            `edge-${index}-${edge.source}-${edge.target}`;
          return {
            id: edgeId,
            source: edge.source,
            target: edge.target,
            ...(edge.sourceHandle != null && {
              sourceHandle: edge.sourceHandle,
            }),
            ...(edge.targetHandle != null && {
              targetHandle: edge.targetHandle,
            }),
          };
        }),
      };

      const url = isNew ? '/api/full-workflows' : `/api/full-workflows/${id}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetchWithCSRF(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description,
          type,
          workflow_json: workflowJson,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save workflow');
      }

      const result = await response.json();
      if (isNew) {
        navigate(`/fullWorkflows/edit/${result.data.id}`);
      } else {
        setGeneralError(null);
        await fetchActiveTriggers();
        await fetchStatistics();
        await fetchExecutionHistory();
        await fetchPerformance();
      }
    } catch (err) {
      const errorMessage = err.message || 'Failed to save workflow';
      setGeneralError(errorMessage);
      console.error('Error saving workflow:', err);
      setTimeout(() => {
        alert('Failed to save workflow: ' + errorMessage);
      }, 100);
    } finally {
      setSaving(false);
    }
  }, [
    description,
    edges,
    fetchActiveTriggers,
    fetchExecutionHistory,
    fetchPerformance,
    fetchStatistics,
    id,
    isNew,
    name,
    navigate,
    nodes,
    type,
  ]);

  const handleClearPerformance = useCallback(async () => {
    if (confirm('Are you sure you want to clear all performance data?')) {
      try {
        await workflowPerformanceService.clearPerformance(parseInt(id, 10));
        await fetchPerformance();
      } catch (err) {
        alert('Failed to clear performance data: ' + err.message);
      }
    }
  }, [fetchPerformance, id]);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, []);

  return {
    loading,
    workflowId: id,
    isNew,
    name,
    setName,
    description,
    setDescription,
    type,
    setType,
    nodes,
    setNodes,
    edges,
    setEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeUpdate,
    onNodeClick,
    selectedNode,
    setSelectedNode,
    showKnowledgeBase,
    setShowKnowledgeBase,
    toggleKnowledgeBase,
    saving,
    exporting,
    executing,
    executionStatus,
    setExecutionStatus,
    generalError,
    setGeneralError,
    showImportModal,
    setShowImportModal,
    selectedNodeForGraph,
    setSelectedNodeForGraph,
    addNode,
    handleExecute,
    handleSave,
    handleExport,
    handleImportSuccess,
    handleBack,
    statisticsState,
    performanceState,
    triggersState,
    historyState,
    executionTracking,
    handleClearPerformance,
    handleSwitchToCallFlow,
  };
}
