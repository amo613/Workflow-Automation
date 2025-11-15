import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import StartNode from '../components/full-workflow/nodes/StartNode';
import EndNode from '../components/full-workflow/nodes/EndNode';
import WebhookNode from '../components/full-workflow/nodes/WebhookNode';
import HttpRequestNode from '../components/full-workflow/nodes/HttpRequestNode';
import CallAgentNode from '../components/full-workflow/nodes/CallAgentNode';
import VariableSetNode from '../components/full-workflow/nodes/VariableSetNode';
import IfNode from '../components/full-workflow/nodes/IfNode';
import WaitNode from '../components/full-workflow/nodes/WaitNode';
import DatabaseQueryNode from '../components/full-workflow/nodes/DatabaseQueryNode';
import GoogleSheetsNode from '../components/full-workflow/nodes/GoogleSheetsNode';
import GoogleSheetsTriggerNode from '../components/full-workflow/nodes/GoogleSheetsTriggerNode';
import WebhookTriggerNode from '../components/full-workflow/nodes/WebhookTriggerNode';
import ScheduleTriggerNode from '../components/full-workflow/nodes/ScheduleTriggerNode';
import KnowledgeBaseQueryNode from '../components/full-workflow/nodes/KnowledgeBaseQueryNode';
import AiAgentNode from '../components/full-workflow/nodes/AiAgentNode';
import EmailNode from '../components/full-workflow/nodes/EmailNode';
import MergeNode from '../components/full-workflow/nodes/MergeNode';
import NodeSidebarN8N from '../components/full-workflow/NodeSidebarN8N';
import KnowledgeBaseManager from '../components/full-workflow/KnowledgeBaseManager';
import VersionHistory from '../components/full-workflow/VersionHistory';
import WorkflowImportModal from '../components/full-workflow/WorkflowImportModal';
import { workflowExportImportService } from '../services/workflowExportImport.service.js';
import { workflowPerformanceService } from '../services/workflowPerformance.service.js';
import { fetchWithCSRF } from '../utils/csrf.utils.js';

const nodeTypes = {
  start: StartNode,
  end: EndNode,
  webhook: WebhookNode, // Deprecated - kept for backward compatibility
  'http-request': HttpRequestNode,
  'call-agent': CallAgentNode,
  'variable-set': VariableSetNode,
  if: IfNode,
  wait: WaitNode,
  'database-query': DatabaseQueryNode,
  'google-sheets': GoogleSheetsNode,
  'google-sheets-trigger': GoogleSheetsTriggerNode,
  'webhook-trigger': WebhookTriggerNode,
  'schedule-trigger': ScheduleTriggerNode,
  'knowledge-base-query': KnowledgeBaseQueryNode,
  'ai-agent': AiAgentNode,
  email: EmailNode,
  merge: MergeNode,
};

function FullWorkflowEditor() {
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
  const [executing, setExecuting] = useState(false);
  const [executionStatus, setExecutionStatus] = useState(null);
  const [executedEdges, setExecutedEdges] = useState([]);
  const [activeTriggers, setActiveTriggers] = useState([]);
  const pollingIntervalRef = useRef(null);
  const pollingTimeoutRef = useRef(null);
  const [showActiveTriggers, setShowActiveTriggers] = useState(true); // Default: open
  const [triggersLoading, setTriggersLoading] = useState(false);
  const [triggersError, setTriggersError] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [statisticsLoading, setStatisticsLoading] = useState(false);
  const [statisticsError, setStatisticsError] = useState(null);
  const [showStatistics, setShowStatistics] = useState(false);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [showExecutionHistory, setShowExecutionHistory] = useState(false);
  const [expandedExecution, setExpandedExecution] = useState(null);
  const [generalError, setGeneralError] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [performance, setPerformance] = useState(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [performanceError, setPerformanceError] = useState(null);
  const [showPerformance, setShowPerformance] = useState(false);
  const [selectedNodeForGraph, setSelectedNodeForGraph] = useState(null);
  const [nodeHistory, setNodeHistory] = useState([]);

  const onNodeUpdate = (nodeId, newData) => {
    setNodes(nds => {
      const updatedNodes = nds.map(node => {
        if (node.id === nodeId) {
          const updatedData = { ...node.data, ...newData };
          const updatedNode = { ...node, data: updatedData };
          // Update selected node if it's the one being updated
          // Use a new object reference to force React re-render
          if (selectedNode && selectedNode.id === nodeId) {
            setSelectedNode({ ...updatedNode });
          }
          return updatedNode;
        }
        return node;
      });
      // Force React to re-render by returning a new array reference
      return updatedNodes;
    });
  };

  useEffect(() => {
    if (!isNew) {
      fetchWorkflow();
      fetchActiveTriggers();
    } else {
      // Initialize with default start node
      setNodes([
        {
          id: 'start-1',
          type: 'start',
          position: { x: 250, y: 100 },
          data: {},
        },
      ]);
      setEdges([]);
    }

    // Check if redirected from OAuth
    const googleSheetsParam = searchParams.get('googleSheets');
    if (googleSheetsParam === 'connected') {
      // Remove the query parameter
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('googleSheets');
      setSearchParams(newParams);
      // Show success message
      alert('Google Sheets connected successfully!');
      // Force a page refresh to ensure all data is loaded
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } else if (googleSheetsParam === 'error') {
      // Handle error case
      const error = searchParams.get('error');
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('googleSheets');
      newParams.delete('error');
      setSearchParams(newParams);
      alert(`Google Sheets connection failed: ${error || 'Unknown error'}`);
    }
  }, [id, searchParams, setSearchParams]);

  // Poll active triggers every 5 seconds
  useEffect(() => {
    if (!isNew && id) {
      const interval = setInterval(() => {
        fetchActiveTriggers();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [id, isNew]);

  // Fetch statistics
  const fetchStatistics = async () => {
    if (!id || isNew) return;
    try {
      setStatisticsLoading(true);
      setStatisticsError(null);
      const response = await fetchWithCSRF(
        `/api/full-workflows/${id}/statistics`
      );
      if (!response.ok) throw new Error('Failed to fetch statistics');
      const data = await response.json();
      setStatistics(data.data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
      setStatisticsError(error.message);
    } finally {
      setStatisticsLoading(false);
    }
  };

  // Fetch statistics on mount and when workflow changes
  useEffect(() => {
    if (!isNew && id) {
      fetchStatistics();
      // Refresh statistics every 30 seconds
      const interval = setInterval(fetchStatistics, 30000);
      return () => clearInterval(interval);
    }
  }, [id, isNew]);

  // Fetch performance data
  const fetchPerformance = async () => {
    if (!id || isNew) return;
    try {
      setPerformanceLoading(true);
      setPerformanceError(null);
      const data = await workflowPerformanceService.getPerformance(
        parseInt(id, 10)
      );
      setPerformance(data);
    } catch (error) {
      console.error('Error fetching performance:', error);
      setPerformanceError(error.message);
    } finally {
      setPerformanceLoading(false);
    }
  };

  // Fetch performance on mount and when workflow changes
  useEffect(() => {
    if (!isNew && id) {
      fetchPerformance();
      // Refresh performance every 30 seconds
      const interval = setInterval(fetchPerformance, 30000);
      return () => clearInterval(interval);
    }
  }, [id, isNew]);

  // Fetch node history when node is selected for graph
  useEffect(() => {
    if (selectedNodeForGraph && id && !isNew) {
      workflowPerformanceService
        .getNodeHistory(parseInt(id, 10), selectedNodeForGraph, 50)
        .then(setNodeHistory)
        .catch(err => {
          console.error('Error fetching node history:', err);
          setNodeHistory([]);
        });
    }
  }, [selectedNodeForGraph, id, isNew]);

  // Track last seen execution timestamp to detect new executions
  const lastExecutionTimestampRef = useRef(null);

  // Fetch execution history
  const fetchExecutionHistory = async () => {
    if (!id || isNew) return;
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const response = await fetchWithCSRF(
        `/api/full-workflows/${id}/execution-history?limit=50`
      );
      if (!response.ok) throw new Error('Failed to fetch execution history');
      const data = await response.json();
      const history = data.data || [];
      setExecutionHistory(history);

      // Check if there's a new execution (for automatic output loading)
      if (history.length > 0) {
        const latestExecution = history[0];
        const latestTimestamp = new Date(latestExecution.timestamp).getTime();

        // Debug logging - expand the object to see full details
        console.log('📊 Execution history fetched', {
          historyLength: history.length,
          latestExecution: latestExecution, // Show full object
          lastSeenTimestamp: lastExecutionTimestampRef.current,
          isNewExecution:
            latestTimestamp > (lastExecutionTimestampRef.current || 0),
          hasEventId: !!latestExecution.eventId,
          isSuccess: latestExecution.success,
        });

        // Initialize lastExecutionTimestampRef on first load (to avoid loading old executions)
        if (lastExecutionTimestampRef.current === null) {
          lastExecutionTimestampRef.current = latestTimestamp;
          console.log('🔵 Initialized lastExecutionTimestampRef', {
            timestamp: latestTimestamp,
          });
          return; // Don't load outputs on initial load
        }

        // If this is a new execution (not seen before)
        if (latestTimestamp > lastExecutionTimestampRef.current) {
          console.log('🆕 New execution detected', {
            timestamp: latestTimestamp,
            lastSeen: lastExecutionTimestampRef.current,
            hasEventId: !!latestExecution.eventId,
            eventId: latestExecution.eventId,
            success: latestExecution.success,
            error: latestExecution.error,
          });

          // Update last seen timestamp
          lastExecutionTimestampRef.current = latestTimestamp;

          // Reset all nodes to 'running' status and clear executed edges
          // This gives visual feedback that a new execution has started (like manual execute button)
          setNodes(nds =>
            nds.map(node => ({
              ...node,
              data: { ...node.data, status: 'running' },
            }))
          );
          setExecutedEdges([]);

          // Load outputs if execution has an eventId (try for both success and failure)
          if (!latestExecution.eventId) {
            console.warn('⚠️ Execution has no eventId - cannot load outputs', {
              timestamp: latestExecution.timestamp,
              success: latestExecution.success,
              execution: latestExecution,
            });
            return; // Can't load outputs without eventId
          }

          console.log(
            `🔄 Attempting to load outputs for ${latestExecution.success ? 'successful' : 'failed'} execution`,
            {
              eventId: latestExecution.eventId,
              success: latestExecution.success,
            }
          );

          // Load outputs for this execution (with retry logic for async executions)
          const loadOutputs = async (retryCount = 0) => {
            try {
              const resultsResponse = await fetchWithCSRF(
                `/api/full-workflows/execution-results?eventId=${encodeURIComponent(latestExecution.eventId)}`
              );

              if (resultsResponse.ok) {
                const resultsData = await resultsResponse.json();

                // Check if workflow is still running (pending/running status)
                const status = resultsData.data?.status;
                if (status === 'pending' || status === 'running') {
                  // Workflow is still running - update nodes incrementally as they complete
                  if (
                    resultsData.data.executionLog &&
                    resultsData.data.executionLog.length > 0
                  ) {
                    const executionLog = resultsData.data.executionLog || [];
                    const nodeOutputs = resultsData.data.nodeOutputs || {};

                    // Update nodes immediately as they appear in executionLog
                    setNodes(nds =>
                      nds.map(node => {
                        const logEntry = executionLog.find(
                          e => e.nodeId === node.id
                        );
                        if (logEntry) {
                          const nodeOutput = nodeOutputs[node.id];
                          return {
                            ...node,
                            data: {
                              ...node.data,
                              status:
                                logEntry.status === 'failed'
                                  ? 'failed'
                                  : 'success',
                              output: nodeOutput || node.data.output,
                            },
                          };
                        }
                        // Keep nodes that haven't executed yet as 'running'
                        return node;
                      })
                    );

                    // Update executed edges immediately
                    if (resultsData.data.executedEdges) {
                      setExecutedEdges(resultsData.data.executedEdges);
                    }
                  }
                  // Continue polling - workflow still running
                  // Retry after 1 second to get updates
                  if (retryCount < 30) {
                    // Max 30 retries = 30 seconds
                    setTimeout(() => loadOutputs(retryCount + 1), 1000);
                  }
                  return;
                }

                // Workflow completed - update all nodes
                if (resultsData.success && resultsData.data?.nodeOutputs) {
                  // Update nodes with outputs from execution
                  // Use executionLog to update nodes in order (with timestamps)
                  const executionLog = resultsData.data.executionLog || [];
                  const nodeOutputs = resultsData.data.nodeOutputs || {};

                  // Sort execution log by timestamp to get correct order
                  const sortedLog = [...executionLog].sort((a, b) => {
                    const timeA = new Date(a.timestamp || 0).getTime();
                    const timeB = new Date(b.timestamp || 0).getTime();
                    return timeA - timeB;
                  });

                  // Update nodes one by one with a small delay for visual effect
                  sortedLog.forEach((logEntry, index) => {
                    setTimeout(() => {
                      setNodes(nds =>
                        nds.map(node => {
                          if (node.id === logEntry.nodeId) {
                            const nodeOutput = nodeOutputs[node.id];
                            return {
                              ...node,
                              data: {
                                ...node.data,
                                status:
                                  logEntry.status === 'failed'
                                    ? 'failed'
                                    : 'success',
                                output: nodeOutput || node.data.output,
                              },
                            };
                          }
                          return node;
                        })
                      );
                    }, index * 100); // 100ms delay between each node update
                  });

                  // Also update any nodes that have outputs but aren't in executionLog
                  // (fallback for nodes that completed but weren't logged)
                  setTimeout(() => {
                    setNodes(nds =>
                      nds.map(node => {
                        const nodeOutput = nodeOutputs[node.id];
                        if (
                          nodeOutput !== undefined &&
                          !sortedLog.find(e => e.nodeId === node.id)
                        ) {
                          return {
                            ...node,
                            data: {
                              ...node.data,
                              status: 'success',
                              output: nodeOutput,
                            },
                          };
                        }
                        return node;
                      })
                    );
                  }, sortedLog.length * 100);

                  // Update executed edges if available
                  if (resultsData.data.executedEdges) {
                    setExecutedEdges(resultsData.data.executedEdges);
                  }

                  console.log(
                    '✅ Automatically loaded outputs for new execution',
                    {
                      eventId: latestExecution.eventId,
                      timestamp: latestExecution.timestamp,
                      nodeOutputsCount: Object.keys(
                        resultsData.data.nodeOutputs
                      ).length,
                    }
                  );
                } else {
                  console.warn(
                    '⚠️ Execution results found but no nodeOutputs',
                    {
                      eventId: latestExecution.eventId,
                      hasData: !!resultsData.data,
                      dataKeys: resultsData.data
                        ? Object.keys(resultsData.data)
                        : [],
                    }
                  );
                }
              } else if (resultsResponse.status === 404 && retryCount < 6) {
                // Execution might still be running, retry after 2 seconds (max 6 retries = 12 seconds)
                console.log('⏳ Execution results not ready yet, retrying...', {
                  eventId: latestExecution.eventId,
                  retryCount: retryCount + 1,
                });
                setTimeout(() => loadOutputs(retryCount + 1), 2000);
              } else {
                console.warn('⚠️ Failed to load execution results', {
                  eventId: latestExecution.eventId,
                  status: resultsResponse.status,
                  retryCount,
                });
              }
            } catch (outputError) {
              console.warn('❌ Error loading outputs for new execution', {
                eventId: latestExecution.eventId,
                error: outputError.message,
                retryCount,
              });
            }
          };

          // Start loading outputs
          loadOutputs();
        } else {
          // Execution already seen (same timestamp) - this is normal, no action needed
          // Only log if there's something unusual (e.g., eventId changed)
          if (
            latestExecution.eventId &&
            latestTimestamp === lastExecutionTimestampRef.current
          ) {
            // Already processed this execution, nothing to do
            // This is expected behavior when polling
          } else if (
            !latestExecution.eventId &&
            latestTimestamp === lastExecutionTimestampRef.current
          ) {
            // Execution already seen and still no eventId - might be an old execution
            // Don't spam the console, this is expected for old executions
          }
        }
      }
    } catch (error) {
      console.error('Error fetching execution history:', error);
      setHistoryError(error.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Fetch execution history on mount and when workflow changes
  useEffect(() => {
    if (!isNew && id) {
      fetchExecutionHistory();
      // Refresh history every 5 seconds to catch new executions quickly
      const interval = setInterval(fetchExecutionHistory, 5000);
      return () => clearInterval(interval);
    }
  }, [id, isNew]);

  // Cleanup polling intervals on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
    };
  }, []);

  const fetchActiveTriggers = async () => {
    if (!id) return;
    try {
      setTriggersLoading(true);
      setTriggersError(null);
      const response = await fetchWithCSRF(
        `/api/full-workflows/${id}/triggers`
      );
      if (!response.ok) throw new Error('Failed to fetch triggers');
      const data = await response.json();
      const triggers = data.data || [];
      setActiveTriggers(triggers);
      // Auto-open if triggers exist
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
  };

  const fetchWorkflow = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/full-workflows/${id}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch workflow');
      }

      const data = await response.json();
      const workflow = data.data;

      setName(workflow.name);
      setDescription(workflow.description || '');
      setType(workflow.type || 'automation');

      // Load nodes and edges from workflow_json
      const workflowJson = workflow.workflow_json || {};
      setNodes(workflowJson.nodes || []);
      // Ensure all edges have IDs when loading (React Flow requires IDs)
      // This fixes issues with workflows that were saved without edge IDs
      const loadedEdges = (workflowJson.edges || []).map((edge, index) => ({
        ...edge,
        id:
          edge.id ||
          `reactflow__edge-${edge.source}-${edge.target}` ||
          `edge-${index}-${edge.source}-${edge.target}`,
      }));
      setEdges(loadedEdges);
    } catch (err) {
      alert('Failed to load workflow: ' + err.message);
      console.error('Error fetching workflow:', err);
      navigate('/fullWorkflows');
    } finally {
      setLoading(false);
    }
  };

  const onConnect = params => {
    setEdges(eds => addEdge(params, eds));
  };

  const onNodeClick = (event, node) => {
    setSelectedNode(node);
  };

  const handleExecute = async () => {
    if (!id) {
      alert('Please save the workflow first before executing');
      return;
    }

    // Check if workflow is active
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

    // Execute directly without modal
    try {
      // Stop any existing polling
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

      // Update node statuses to 'running' and reset executed edges
      setNodes(nds =>
        nds.map(node => ({
          ...node,
          data: { ...node.data, status: 'running' },
        }))
      );
      setExecutedEdges([]);

      const response = await fetchWithCSRF(
        `/api/full-workflows/${id}/trigger`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: {} }), // Empty input
        }
      );

      const result = await response.json();

      // Handle duplicate trigger (429 status)
      if (response.status === 429 && result.data?.eventId) {
        // Use the existing eventId from the duplicate trigger response
        const eventId = result.data.eventId;
        setExecutionStatus({
          status: 'running',
          message: 'Workflow already executing via Inngest...',
          eventId: eventId,
          workflowId: Number(id),
        });

        // Start polling with the existing eventId immediately
        pollingIntervalRef.current = setInterval(async () => {
          try {
            const resultsResponse = await fetchWithCSRF(
              `/api/full-workflows/execution-results?eventId=${encodeURIComponent(eventId)}`
            );

            if (resultsResponse.ok) {
              const resultsData = await resultsResponse.json();

              // Check if workflow is still pending or running
              if (resultsData.success && resultsData.data) {
                const status = resultsData.data.status;
                if (status === 'pending' || status === 'running') {
                  // Workflow is still running - update nodes incrementally as they complete
                  if (
                    resultsData.data.executionLog &&
                    resultsData.data.executionLog.length > 0
                  ) {
                    const executionLog = resultsData.data.executionLog || [];
                    const nodeOutputs = resultsData.data.nodeOutputs || {};

                    // Update nodes immediately as they appear in executionLog
                    setNodes(nds =>
                      nds.map(node => {
                        const logEntry = executionLog.find(
                          e => e.nodeId === node.id
                        );
                        if (logEntry) {
                          const nodeOutput = nodeOutputs[node.id];
                          return {
                            ...node,
                            data: {
                              ...node.data,
                              status:
                                logEntry.status === 'failed'
                                  ? 'failed'
                                  : 'success',
                              output: nodeOutput || node.data.output,
                            },
                          };
                        }
                        return node;
                      })
                    );

                    // Update executed edges immediately
                    if (resultsData.data.executedEdges) {
                      setExecutedEdges(resultsData.data.executedEdges);
                    }
                  }
                  // Continue polling - workflow still running
                  return;
                }
              }

              if (resultsData.success && resultsData.data) {
                if (pollingIntervalRef.current) {
                  clearInterval(pollingIntervalRef.current);
                  pollingIntervalRef.current = null;
                }
                if (pollingTimeoutRef.current) {
                  clearTimeout(pollingTimeoutRef.current);
                  pollingTimeoutRef.current = null;
                }

                // Workflow completed successfully
                setExecutionStatus({
                  status: 'success',
                  message: 'Workflow executed successfully',
                  eventId: eventId,
                  workflowId: resultsData.data.workflowId,
                });

                // Final update of all nodes (in case some weren't updated incrementally)
                if (resultsData.data.nodeOutputs) {
                  const executionLog = resultsData.data.executionLog || [];
                  const nodeOutputs = resultsData.data.nodeOutputs || {};

                  setNodes(nds =>
                    nds.map(node => {
                      const logEntry = executionLog.find(
                        e => e.nodeId === node.id
                      );
                      const nodeOutput = nodeOutputs[node.id];
                      if (logEntry || nodeOutput !== undefined) {
                        return {
                          ...node,
                          data: {
                            ...node.data,
                            status:
                              logEntry?.status === 'failed'
                                ? 'failed'
                                : 'success',
                            output: nodeOutput || node.data.output,
                          },
                        };
                      }
                      return node;
                    })
                  );
                }

                // Update executed edges (mark them as green)
                if (resultsData.data.executedEdges) {
                  setExecutedEdges(resultsData.data.executedEdges);
                }

                // Refresh statistics and history after successful execution
                await fetchStatistics();
                await fetchExecutionHistory();
                await fetchPerformance();

                setExecuting(false);
              }
            } else if (resultsResponse.status === 404) {
              // Still running, continue polling silently (no error, just wait)
              // Don't update status unnecessarily, just continue
            } else {
              // Only stop on non-404 errors (5xx, etc.)
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
              if (pollingTimeoutRef.current) {
                clearTimeout(pollingTimeoutRef.current);
                pollingTimeoutRef.current = null;
              }
              setExecutionStatus({
                status: 'error',
                message: 'Failed to get execution results',
                eventId: eventId,
              });
              setNodes(nds =>
                nds.map(node => ({
                  ...node,
                  data: { ...node.data, status: 'failed' },
                }))
              );
              setExecutedEdges([]);
              setExecuting(false);

              // Refresh statistics and history after failed execution
              await fetchStatistics();
              await fetchExecutionHistory();
            }
          } catch (pollError) {
            // Silently continue polling on network errors (404s are expected)
            // Only log actual errors, not expected 404s
            if (!pollError.message?.includes('404')) {
              // Continue polling silently
            }
          }
        }, 200); // Poll every 200ms for fast response

        // Stop polling after 5 minutes (timeout)
        pollingTimeoutRef.current = setTimeout(() => {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setExecutionStatus(prev => {
            if (prev?.status === 'running') {
              return {
                status: 'error',
                message: 'Workflow execution timed out',
                eventId: eventId,
              };
            }
            return prev;
          });
          setExecuting(false);
        }, 300000); // 5 minutes timeout

        return; // Exit early, polling is set up
      }

      if (result.success && result.data?.eventId) {
        const eventId = result.data.eventId;
        setExecutionStatus({
          status: 'running',
          message: 'Workflow executing via Inngest...',
          eventId: eventId,
          workflowId: result.data?.workflowId,
        });

        // Poll for execution results immediately
        pollingIntervalRef.current = setInterval(async () => {
          try {
            const resultsResponse = await fetchWithCSRF(
              `/api/full-workflows/execution-results?eventId=${encodeURIComponent(eventId)}`
            );

            if (resultsResponse.ok) {
              const resultsData = await resultsResponse.json();

              // Check if workflow is still pending or running
              if (resultsData.success && resultsData.data) {
                const status = resultsData.data.status;
                if (status === 'pending' || status === 'running') {
                  // Workflow is still running - update nodes incrementally as they complete
                  if (
                    resultsData.data.executionLog &&
                    resultsData.data.executionLog.length > 0
                  ) {
                    const executionLog = resultsData.data.executionLog || [];
                    const nodeOutputs = resultsData.data.nodeOutputs || {};

                    // Update nodes immediately as they appear in executionLog
                    setNodes(nds =>
                      nds.map(node => {
                        const logEntry = executionLog.find(
                          e => e.nodeId === node.id
                        );
                        if (logEntry) {
                          const nodeOutput = nodeOutputs[node.id];
                          return {
                            ...node,
                            data: {
                              ...node.data,
                              status:
                                logEntry.status === 'failed'
                                  ? 'failed'
                                  : 'success',
                              output: nodeOutput || node.data.output,
                            },
                          };
                        }
                        return node;
                      })
                    );

                    // Update executed edges immediately
                    if (resultsData.data.executedEdges) {
                      setExecutedEdges(resultsData.data.executedEdges);
                    }
                  }
                  // Continue polling - workflow still running
                  return;
                }
              }

              if (resultsData.success && resultsData.data) {
                if (pollingIntervalRef.current) {
                  clearInterval(pollingIntervalRef.current);
                  pollingIntervalRef.current = null;
                }
                if (pollingTimeoutRef.current) {
                  clearTimeout(pollingTimeoutRef.current);
                  pollingTimeoutRef.current = null;
                }

                // Workflow completed successfully
                setExecutionStatus({
                  status: 'success',
                  message: 'Workflow executed successfully',
                  eventId: eventId,
                  workflowId: resultsData.data.workflowId,
                });

                // Final update of all nodes (in case some weren't updated incrementally)
                if (resultsData.data.nodeOutputs) {
                  const executionLog = resultsData.data.executionLog || [];
                  const nodeOutputs = resultsData.data.nodeOutputs || {};

                  setNodes(nds =>
                    nds.map(node => {
                      const logEntry = executionLog.find(
                        e => e.nodeId === node.id
                      );
                      const nodeOutput = nodeOutputs[node.id];
                      if (logEntry || nodeOutput !== undefined) {
                        return {
                          ...node,
                          data: {
                            ...node.data,
                            status:
                              logEntry?.status === 'failed'
                                ? 'failed'
                                : 'success',
                            output: nodeOutput || node.data.output,
                          },
                        };
                      }
                      return node;
                    })
                  );
                }

                // Update executed edges (mark them as green)
                if (resultsData.data.executedEdges) {
                  setExecutedEdges(resultsData.data.executedEdges);
                }

                setExecuting(false);
              }
            } else if (resultsResponse.status === 404) {
              // Still running, continue polling silently (no error, just wait)
              // Don't update status unnecessarily, just continue
            } else {
              // Only stop on non-404 errors (5xx, etc.)
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
              if (pollingTimeoutRef.current) {
                clearTimeout(pollingTimeoutRef.current);
                pollingTimeoutRef.current = null;
              }
              setExecutionStatus({
                status: 'error',
                message: 'Failed to get execution results',
                eventId: eventId,
              });
              setNodes(nds =>
                nds.map(node => ({
                  ...node,
                  data: { ...node.data, status: 'failed' },
                }))
              );
              setExecutedEdges([]);
              setExecuting(false);
            }
          } catch (pollError) {
            // Silently continue polling on network errors (404s are expected)
            // Only log actual errors, not expected 404s
            if (!pollError.message?.includes('404')) {
              // Continue polling silently
            }
          }
        }, 200); // Poll every 200ms for fast response

        // Stop polling after 5 minutes (timeout)
        pollingTimeoutRef.current = setTimeout(() => {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setExecutionStatus(prev => {
            if (prev?.status === 'running') {
              return {
                status: 'error',
                message: 'Workflow execution timed out',
                eventId: eventId,
              };
            }
            return prev;
          });
          setExecuting(false);
        }, 300000); // 5 minutes timeout
      } else {
        setExecutionStatus({
          status: 'error',
          message: result.error || 'Failed to trigger workflow',
        });

        // Update node statuses to 'failed'
        setNodes(nds =>
          nds.map(node => ({
            ...node,
            data: { ...node.data, status: 'failed' },
          }))
        );
        setExecutedEdges([]);
        setExecuting(false);

        // Refresh statistics and history after failed execution
        await fetchStatistics();
        await fetchExecutionHistory();
      }
    } catch (error) {
      setExecutionStatus({
        status: 'error',
        message: error.message || 'Failed to execute workflow',
      });

      // Update node statuses to 'failed'
      setNodes(nds =>
        nds.map(node => ({
          ...node,
          data: { ...node.data, status: 'failed' },
        }))
      );
      setExecutedEdges([]);

      // Refresh statistics and history after failed execution
      await fetchStatistics();
      await fetchExecutionHistory();
      await fetchPerformance();
    } finally {
      setExecuting(false);
    }
  };

  const handleExport = async () => {
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
  };

  const handleImportSuccess = importedWorkflow => {
    // Navigate to the imported workflow
    navigate(`/fullWorkflows/edit/${importedWorkflow.id}`);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a workflow name');
      return;
    }

    try {
      setSaving(true);

      const workflowJson = {
        nodes: nodes.map(({ id, type, position, data }) => ({
          id,
          type,
          position,
          data,
        })),
        edges: edges.map((edge, index) => {
          // Ensure every edge has an ID - React Flow generates IDs automatically
          // Format: reactflow__edge-${source}-${target}
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
        // Refresh active triggers, statistics, history and performance after saving
        await fetchActiveTriggers();
        await fetchStatistics();
        await fetchExecutionHistory();
        await fetchPerformance();
      }
    } catch (err) {
      const errorMessage = err.message || 'Failed to save workflow';
      setGeneralError(errorMessage);
      console.error('Error saving workflow:', err);
      // Also show alert for immediate feedback
      setTimeout(() => {
        alert('Failed to save workflow: ' + errorMessage);
      }, 100);
    } finally {
      setSaving(false);
    }
  };

  const addNode = nodeType => {
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
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '18px',
          color: '#667eea',
          fontWeight: 600,
        }}
      >
        Loading workflow...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          background: 'white',
          padding: '1rem 2rem',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            flex: 1,
          }}
        >
          <button
            onClick={() => navigate('/fullWorkflows')}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              background: 'white',
              cursor: 'pointer',
            }}
          >
            ← Back
          </button>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Workflow Name"
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: '1rem',
              minWidth: '200px',
            }}
          />
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: '1rem',
            }}
          >
            <option value="automation">Automation</option>
            <option value="call-workflow">Call Workflow</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            onClick={() => setShowKnowledgeBase(!showKnowledgeBase)}
            style={{
              padding: '0.5rem 1rem',
              background: showKnowledgeBase
                ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
                : 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            📚 Knowledge Base
          </button>
          {!isNew && (
            <button
              onClick={handleExport}
              disabled={exporting || saving}
              style={{
                padding: '0.5rem 1rem',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: exporting || saving ? 'not-allowed' : 'pointer',
                opacity: exporting || saving ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                if (!exporting && !saving) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow =
                    '0 4px 12px rgba(245, 158, 11, 0.3)';
                }
              }}
              onMouseLeave={e => {
                if (!exporting && !saving) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              {exporting ? '⏳ Exporting...' : '📤 Export'}
            </button>
          )}
          <button
            onClick={() => setShowImportModal(true)}
            disabled={saving}
            style={{
              padding: '0.5rem 1rem',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              if (!saving) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow =
                  '0 4px 12px rgba(16, 185, 129, 0.3)';
              }
            }}
            onMouseLeave={e => {
              if (!saving) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            📥 Import
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '0.5rem 1.5rem',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          {!isNew && (
            <button
              onClick={handleExecute}
              disabled={executing || saving}
              style={{
                padding: '0.5rem 1.5rem',
                background: executing
                  ? '#10b981'
                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: executing || saving ? 'not-allowed' : 'pointer',
                opacity: executing || saving ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              {executing ? (
                <>
                  <span>⏳</span>
                  <span>Executing...</span>
                </>
              ) : (
                <>
                  <span>▶️</span>
                  <span>Execute</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* General Error Display */}
      {generalError && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000,
            padding: '1rem 1.5rem',
            background: '#fee2e2',
            border: '2px solid #ef4444',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
            maxWidth: '500px',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <span style={{ fontSize: '1.5rem' }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontWeight: 600,
                color: '#dc2626',
                marginBottom: '0.25rem',
              }}
            >
              Error
            </div>
            <div style={{ fontSize: '0.875rem', color: '#991b1b' }}>
              {generalError}
            </div>
          </div>
          <button
            onClick={() => setGeneralError(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#dc2626',
              cursor: 'pointer',
              fontSize: '1.25rem',
              padding: '0.25rem',
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Node Palette */}
        <div
          style={{
            width: '250px',
            background: 'white',
            borderRight: '1px solid #e0e0e0',
            padding: '1rem',
            overflowY: 'auto',
          }}
        >
          {/* Statistics Section */}
          {!isNew && (
            <div
              style={{
                marginBottom: '1.5rem',
                padding: '0.75rem',
                background:
                  statistics?.totalExecutions > 0 ? '#f0fdf4' : '#f8f9fa',
                border: `1px solid ${statistics?.totalExecutions > 0 ? '#10b981' : '#e0e0e0'}`,
                borderRadius: '8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                }}
              >
                <h3
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color:
                      statistics?.totalExecutions > 0 ? '#059669' : '#64748b',
                    margin: 0,
                  }}
                >
                  📊 Statistics
                </h3>
                <button
                  onClick={() => setShowStatistics(!showStatistics)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color:
                      statistics?.totalExecutions > 0 ? '#10b981' : '#64748b',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  {showStatistics ? '▼' : '▶'}
                </button>
              </div>
              {showStatistics && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  {statisticsError && (
                    <div
                      style={{
                        padding: '0.5rem',
                        background: '#fee2e2',
                        border: '1px solid #ef4444',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        color: '#dc2626',
                      }}
                    >
                      Error: {statisticsError}
                    </div>
                  )}
                  {statisticsLoading && (
                    <div
                      style={{
                        padding: '0.75rem',
                        background: 'white',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        color: '#64748b',
                        textAlign: 'center',
                        border: '1px solid #e0e0e0',
                      }}
                    >
                      Loading statistics...
                    </div>
                  )}
                  {!statisticsLoading && !statisticsError && statistics && (
                    <div
                      style={{
                        padding: '0.75rem',
                        background: 'white',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        border: '1px solid #e0e0e0',
                      }}
                    >
                      {/* Total Executions */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.5rem',
                          paddingBottom: '0.5rem',
                          borderBottom: '1px solid #e5e7eb',
                        }}
                      >
                        <span style={{ color: '#64748b' }}>
                          Total Executions
                        </span>
                        <span
                          style={{
                            fontWeight: 700,
                            color: '#1f2937',
                            fontSize: '0.875rem',
                          }}
                        >
                          {statistics.totalExecutions || 0}
                        </span>
                      </div>

                      {/* Success Rate */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.5rem',
                          paddingBottom: '0.5rem',
                          borderBottom: '1px solid #e5e7eb',
                        }}
                      >
                        <span style={{ color: '#64748b' }}>Success Rate</span>
                        <span
                          style={{
                            fontWeight: 700,
                            color:
                              parseFloat(statistics.successRate || 0) >= 90
                                ? '#10b981'
                                : parseFloat(statistics.successRate || 0) >= 70
                                  ? '#f59e0b'
                                  : '#ef4444',
                            fontSize: '0.875rem',
                          }}
                        >
                          {parseFloat(statistics.successRate || 0).toFixed(1)}%
                        </span>
                      </div>

                      {/* Successful / Failed */}
                      <div
                        style={{
                          display: 'flex',
                          gap: '0.5rem',
                          marginBottom: '0.5rem',
                          paddingBottom: '0.5rem',
                          borderBottom: '1px solid #e5e7eb',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              color: '#64748b',
                              fontSize: '0.65rem',
                              marginBottom: '0.25rem',
                            }}
                          >
                            Successful
                          </div>
                          <div
                            style={{
                              fontWeight: 600,
                              color: '#10b981',
                              fontSize: '0.875rem',
                            }}
                          >
                            {statistics.successfulExecutions || 0}
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              color: '#64748b',
                              fontSize: '0.65rem',
                              marginBottom: '0.25rem',
                            }}
                          >
                            Failed
                          </div>
                          <div
                            style={{
                              fontWeight: 600,
                              color: '#ef4444',
                              fontSize: '0.875rem',
                            }}
                          >
                            {statistics.failedExecutions || 0}
                          </div>
                        </div>
                      </div>

                      {/* Last Execution */}
                      {statistics.lastExecution && (
                        <div
                          style={{
                            marginBottom: '0.5rem',
                            paddingBottom: '0.5rem',
                            borderBottom: '1px solid #e5e7eb',
                          }}
                        >
                          <div
                            style={{
                              color: '#64748b',
                              fontSize: '0.65rem',
                              marginBottom: '0.25rem',
                            }}
                          >
                            Last Execution
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#1f2937' }}>
                            {new Date(
                              statistics.lastExecution
                            ).toLocaleString()}
                          </div>
                        </div>
                      )}

                      {/* Last Success / Failure */}
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {statistics.lastSuccess && (
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                color: '#64748b',
                                fontSize: '0.65rem',
                                marginBottom: '0.25rem',
                              }}
                            >
                              Last Success
                            </div>
                            <div
                              style={{ fontSize: '0.7rem', color: '#10b981' }}
                            >
                              {new Date(
                                statistics.lastSuccess
                              ).toLocaleString()}
                            </div>
                          </div>
                        )}
                        {statistics.lastFailure && (
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                color: '#64748b',
                                fontSize: '0.65rem',
                                marginBottom: '0.25rem',
                              }}
                            >
                              Last Failure
                            </div>
                            <div
                              style={{ fontSize: '0.7rem', color: '#ef4444' }}
                            >
                              {new Date(
                                statistics.lastFailure
                              ).toLocaleString()}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Recent Errors */}
                      {statistics.errors && statistics.errors.length > 0 && (
                        <div
                          style={{
                            marginTop: '0.5rem',
                            paddingTop: '0.5rem',
                            borderTop: '1px solid #e5e7eb',
                          }}
                        >
                          <div
                            style={{
                              color: '#64748b',
                              fontSize: '0.65rem',
                              marginBottom: '0.25rem',
                            }}
                          >
                            Recent Errors ({statistics.errors.length})
                          </div>
                          <div
                            style={{
                              maxHeight: '100px',
                              overflowY: 'auto',
                              fontSize: '0.65rem',
                              color: '#dc2626',
                            }}
                          >
                            {statistics.errors.slice(-3).map((err, idx) => (
                              <div
                                key={idx}
                                style={{ marginBottom: '0.25rem' }}
                              >
                                {new Date(err.timestamp).toLocaleString()}:{' '}
                                {err.error}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Execution History Toggle */}
                      {statistics.totalExecutions > 0 && (
                        <div
                          style={{
                            marginTop: '0.75rem',
                            paddingTop: '0.75rem',
                            borderTop: '2px solid #e5e7eb',
                          }}
                        >
                          <button
                            onClick={() => {
                              setShowExecutionHistory(!showExecutionHistory);
                              if (
                                !showExecutionHistory &&
                                executionHistory.length === 0
                              ) {
                                fetchExecutionHistory();
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              background: 'transparent',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '0.75rem',
                              color: '#1f2937',
                              fontWeight: 600,
                            }}
                          >
                            <span>
                              📋 Execution History (
                              {executionHistory.length || 0})
                            </span>
                            <span>{showExecutionHistory ? '▼' : '▶'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {!statisticsLoading && !statisticsError && !statistics && (
                    <div
                      style={{
                        padding: '0.75rem',
                        background: 'white',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        color: '#64748b',
                        textAlign: 'center',
                        border: '1px solid #e0e0e0',
                      }}
                    >
                      No statistics available yet. Execute the workflow to see
                      statistics.
                    </div>
                  )}

                  {/* Execution History List */}
                  {showExecutionHistory &&
                    statistics &&
                    statistics.totalExecutions > 0 && (
                      <div
                        style={{
                          marginTop: '0.5rem',
                          padding: '0.75rem',
                          background: 'white',
                          borderRadius: '6px',
                          border: '1px solid #e0e0e0',
                          maxHeight: '400px',
                          overflowY: 'auto',
                        }}
                      >
                        {historyError && (
                          <div
                            style={{
                              padding: '0.5rem',
                              background: '#fee2e2',
                              border: '1px solid #ef4444',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              color: '#dc2626',
                              marginBottom: '0.5rem',
                            }}
                          >
                            Error: {historyError}
                          </div>
                        )}
                        {historyLoading && (
                          <div
                            style={{
                              padding: '0.75rem',
                              fontSize: '0.75rem',
                              color: '#64748b',
                              textAlign: 'center',
                            }}
                          >
                            Loading execution history...
                          </div>
                        )}
                        {!historyLoading &&
                          !historyError &&
                          executionHistory.length === 0 && (
                            <div
                              style={{
                                padding: '0.75rem',
                                fontSize: '0.75rem',
                                color: '#64748b',
                                textAlign: 'center',
                              }}
                            >
                              No execution history available yet.
                            </div>
                          )}
                        {!historyLoading &&
                          !historyError &&
                          executionHistory.length > 0 && (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                              }}
                            >
                              {executionHistory.map((execution, index) => {
                                const isFailed = !execution.success;
                                const hasError =
                                  execution.error || execution.errorStack;
                                return (
                                  <div
                                    key={index}
                                    style={{
                                      padding: '0.75rem',
                                      background: execution.success
                                        ? '#f0fdf4'
                                        : '#fef2f2',
                                      border: `1px solid ${execution.success ? '#10b981' : '#ef4444'}`,
                                      borderRadius: '6px',
                                      cursor: isFailed ? 'pointer' : 'default',
                                      userSelect: 'none',
                                    }}
                                    onClick={e => {
                                      e.stopPropagation();
                                      if (isFailed) {
                                        setExpandedExecution(
                                          expandedExecution === index
                                            ? null
                                            : index
                                        );
                                      }
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom:
                                          isFailed && hasError ? '0.5rem' : '0',
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.5rem',
                                        }}
                                      >
                                        <span style={{ fontSize: '1rem' }}>
                                          {execution.success ? '✅' : '❌'}
                                        </span>
                                        <div>
                                          <div
                                            style={{
                                              fontSize: '0.75rem',
                                              fontWeight: 600,
                                              color: execution.success
                                                ? '#059669'
                                                : '#dc2626',
                                            }}
                                          >
                                            {execution.success
                                              ? 'Success'
                                              : 'Failed'}
                                          </div>
                                          <div
                                            style={{
                                              fontSize: '0.65rem',
                                              color: '#64748b',
                                              marginTop: '0.125rem',
                                            }}
                                          >
                                            {new Date(
                                              execution.timestamp
                                            ).toLocaleString()}
                                          </div>
                                        </div>
                                      </div>
                                      {isFailed && (
                                        <span
                                          style={{
                                            fontSize: '0.7rem',
                                            color: '#64748b',
                                            pointerEvents: 'none',
                                          }}
                                        >
                                          {expandedExecution === index
                                            ? '▼'
                                            : '▶'}
                                        </span>
                                      )}
                                    </div>
                                    {isFailed &&
                                      hasError &&
                                      expandedExecution === index && (
                                        <div
                                          style={{
                                            marginTop: '0.5rem',
                                            padding: '0.75rem',
                                            background: '#fee2e2',
                                            border: '1px solid #ef4444',
                                            borderRadius: '6px',
                                            fontSize: '0.7rem',
                                          }}
                                        >
                                          <div
                                            style={{
                                              fontWeight: 600,
                                              color: '#dc2626',
                                              marginBottom: '0.5rem',
                                            }}
                                          >
                                            Error Details:
                                          </div>
                                          <div
                                            style={{
                                              color: '#991b1b',
                                              whiteSpace: 'pre-wrap',
                                              wordBreak: 'break-word',
                                              fontFamily: 'monospace',
                                              fontSize: '0.65rem',
                                              lineHeight: '1.4',
                                            }}
                                          >
                                            {execution.error}
                                          </div>
                                          {execution.errorStack && (
                                            <details
                                              style={{ marginTop: '0.5rem' }}
                                            >
                                              <summary
                                                style={{
                                                  cursor: 'pointer',
                                                  color: '#dc2626',
                                                  fontSize: '0.65rem',
                                                  fontWeight: 600,
                                                }}
                                              >
                                                Stack Trace
                                              </summary>
                                              <pre
                                                style={{
                                                  marginTop: '0.5rem',
                                                  padding: '0.5rem',
                                                  background: '#fef2f2',
                                                  borderRadius: '4px',
                                                  fontSize: '0.6rem',
                                                  color: '#991b1b',
                                                  overflowX: 'auto',
                                                  whiteSpace: 'pre-wrap',
                                                  wordBreak: 'break-word',
                                                  maxHeight: '200px',
                                                  overflowY: 'auto',
                                                }}
                                              >
                                                {execution.errorStack}
                                              </pre>
                                            </details>
                                          )}
                                        </div>
                                      )}
                                    {isFailed && !hasError && (
                                      <div
                                        style={{
                                          marginTop: '0.5rem',
                                          padding: '0.5rem',
                                          background: '#fef3c7',
                                          border: '1px solid #f59e0b',
                                          borderRadius: '6px',
                                          fontSize: '0.7rem',
                                          color: '#92400e',
                                        }}
                                      >
                                        No error details available
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                      </div>
                    )}
                </div>
              )}
            </div>
          )}

          {/* Performance Section */}
          {!isNew && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                }}
              >
                <h3
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: performance?.workflow ? '#059669' : '#64748b',
                    margin: 0,
                  }}
                >
                  ⚡ Performance
                </h3>
                <button
                  onClick={() => setShowPerformance(!showPerformance)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: performance?.workflow ? '#10b981' : '#64748b',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  {showPerformance ? '▼' : '▶'}
                </button>
              </div>
              {showPerformance && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  {performanceError && (
                    <div
                      style={{
                        padding: '0.5rem',
                        background: '#fee2e2',
                        border: '1px solid #ef4444',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        color: '#dc2626',
                      }}
                    >
                      Error: {performanceError}
                    </div>
                  )}
                  {performanceLoading && (
                    <div
                      style={{
                        padding: '0.75rem',
                        background: 'white',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        color: '#64748b',
                        textAlign: 'center',
                        border: '1px solid #e0e0e0',
                      }}
                    >
                      Loading performance data...
                    </div>
                  )}
                  {!performanceLoading && !performanceError && performance && (
                    <div
                      style={{
                        padding: '0.75rem',
                        background: 'white',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        border: '1px solid #e0e0e0',
                      }}
                    >
                      {/* Workflow-Level Performance */}
                      {performance.workflow && (
                        <div style={{ marginBottom: '1rem' }}>
                          <div
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              color: '#64748b',
                              marginBottom: '0.5rem',
                              textTransform: 'uppercase',
                            }}
                          >
                            Workflow Performance
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginBottom: '0.25rem',
                            }}
                          >
                            <span style={{ color: '#64748b' }}>Avg Time</span>
                            <span style={{ fontWeight: 600, color: '#1f2937' }}>
                              {performance.workflow.avgExecutionTime.toFixed(2)}
                              ms
                            </span>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginBottom: '0.25rem',
                            }}
                          >
                            <span style={{ color: '#64748b' }}>Min Time</span>
                            <span style={{ fontWeight: 600, color: '#10b981' }}>
                              {performance.workflow.minExecutionTime.toFixed(2)}
                              ms
                            </span>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginBottom: '0.25rem',
                            }}
                          >
                            <span style={{ color: '#64748b' }}>Max Time</span>
                            <span style={{ fontWeight: 600, color: '#ef4444' }}>
                              {performance.workflow.maxExecutionTime.toFixed(2)}
                              ms
                            </span>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span style={{ color: '#64748b' }}>
                              Total Executions
                            </span>
                            <span style={{ fontWeight: 600, color: '#1f2937' }}>
                              {performance.workflow.totalExecutions}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Node-Level Performance (Bottlenecks) */}
                      {performance.nodes && performance.nodes.length > 0 && (
                        <div>
                          <div
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              color: '#64748b',
                              marginBottom: '0.5rem',
                              textTransform: 'uppercase',
                              borderTop: '1px solid #e5e7eb',
                              paddingTop: '0.75rem',
                            }}
                          >
                            Node Performance (Top Bottlenecks)
                          </div>
                          <div
                            style={{ maxHeight: '300px', overflowY: 'auto' }}
                          >
                            {performance.nodes.slice(0, 5).map((node, idx) => (
                              <div
                                key={node.nodeId}
                                style={{
                                  padding: '0.5rem',
                                  background: idx === 0 ? '#fef3c7' : '#f8fafc',
                                  borderRadius: '6px',
                                  marginBottom: '0.5rem',
                                  border:
                                    idx === 0
                                      ? '1px solid #f59e0b'
                                      : '1px solid #e0e0e0',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '0.25rem',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontWeight: 600,
                                      color: '#1f2937',
                                      fontSize: '0.7rem',
                                    }}
                                  >
                                    {node.nodeType}
                                  </span>
                                  {idx === 0 && (
                                    <span
                                      style={{
                                        fontSize: '0.65rem',
                                        color: '#f59e0b',
                                        fontWeight: 600,
                                      }}
                                    >
                                      🔥 Slowest
                                    </span>
                                  )}
                                </div>
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontSize: '0.65rem',
                                    color: '#64748b',
                                  }}
                                >
                                  <span>Avg: {node.avg.toFixed(2)}ms</span>
                                  <span>Min: {node.min.toFixed(2)}ms</span>
                                  <span>Max: {node.max.toFixed(2)}ms</span>
                                  <span>Count: {node.count}</span>
                                </div>
                                <button
                                  onClick={() => {
                                    setSelectedNodeForGraph(
                                      selectedNodeForGraph === node.nodeId
                                        ? null
                                        : node.nodeId
                                    );
                                  }}
                                  style={{
                                    width: '100%',
                                    marginTop: '0.5rem',
                                    padding: '0.25rem',
                                    background: 'transparent',
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.65rem',
                                    color: '#64748b',
                                  }}
                                >
                                  {selectedNodeForGraph === node.nodeId
                                    ? 'Hide Graph'
                                    : 'Show Graph'}
                                </button>
                                {selectedNodeForGraph === node.nodeId &&
                                  nodeHistory.length > 0 && (
                                    <div
                                      style={{
                                        marginTop: '0.5rem',
                                        padding: '0.5rem',
                                        background: 'white',
                                        borderRadius: '4px',
                                        border: '1px solid #e0e0e0',
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontSize: '0.65rem',
                                          color: '#64748b',
                                          marginBottom: '0.25rem',
                                        }}
                                      >
                                        Execution Time Over Time
                                      </div>
                                      <div
                                        style={{
                                          height: '60px',
                                          display: 'flex',
                                          alignItems: 'flex-end',
                                          gap: '2px',
                                        }}
                                      >
                                        {nodeHistory
                                          .slice(-20)
                                          .map((record, i) => {
                                            const maxTime = Math.max(
                                              ...nodeHistory.map(
                                                r => r.executionTime
                                              )
                                            );
                                            const height =
                                              (record.executionTime / maxTime) *
                                              100;
                                            return (
                                              <div
                                                key={i}
                                                style={{
                                                  flex: 1,
                                                  background:
                                                    record.executionTime >
                                                    node.avg
                                                      ? '#ef4444'
                                                      : '#10b981',
                                                  height: `${height}%`,
                                                  minHeight: '2px',
                                                  borderRadius: '2px 2px 0 0',
                                                }}
                                                title={`${record.executionTime.toFixed(2)}ms`}
                                              />
                                            );
                                          })}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(!performance.workflow ||
                        !performance.nodes ||
                        performance.nodes.length === 0) && (
                        <div
                          style={{
                            padding: '0.75rem',
                            textAlign: 'center',
                            color: '#64748b',
                            fontSize: '0.75rem',
                          }}
                        >
                          No performance data available yet. Execute the
                          workflow to collect performance metrics.
                        </div>
                      )}

                      {/* Clear Performance Button */}
                      {performance.workflow && (
                        <button
                          onClick={async () => {
                            if (
                              confirm(
                                'Are you sure you want to clear all performance data?'
                              )
                            ) {
                              try {
                                await workflowPerformanceService.clearPerformance(
                                  parseInt(id, 10)
                                );
                                await fetchPerformance();
                              } catch (err) {
                                alert(
                                  'Failed to clear performance data: ' +
                                    err.message
                                );
                              }
                            }
                          }}
                          style={{
                            width: '100%',
                            marginTop: '0.75rem',
                            padding: '0.5rem',
                            background: '#fee2e2',
                            border: '1px solid #ef4444',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            color: '#dc2626',
                            fontWeight: 600,
                          }}
                        >
                          🗑️ Clear Performance Data
                        </button>
                      )}
                    </div>
                  )}
                  {!performanceLoading && !performanceError && !performance && (
                    <div
                      style={{
                        padding: '0.75rem',
                        background: 'white',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        color: '#64748b',
                        textAlign: 'center',
                        border: '1px solid #e0e0e0',
                      }}
                    >
                      No performance data available yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Version History Section */}
          {!isNew && (
            <VersionHistory
              workflowId={parseInt(id, 10)}
              onRestore={restoredWorkflowJson => {
                // Update the workflow with restored version
                setNodes(restoredWorkflowJson.nodes || []);
                setEdges(restoredWorkflowJson.edges || []);
                // Reload the workflow to get the latest data
                window.location.reload();
              }}
            />
          )}

          {/* Active Triggers Section */}
          {!isNew && (
            <div
              style={{
                marginBottom: '1.5rem',
                padding: '0.75rem',
                background: activeTriggers.length > 0 ? '#f0f9ff' : '#f8f9fa',
                border: `1px solid ${activeTriggers.length > 0 ? '#3b82f6' : '#e0e0e0'}`,
                borderRadius: '8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                }}
              >
                <h3
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: activeTriggers.length > 0 ? '#1e40af' : '#64748b',
                    margin: 0,
                  }}
                >
                  Active Triggers{' '}
                  {activeTriggers.length > 0 && `(${activeTriggers.length})`}
                </h3>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'center',
                  }}
                >
                  {triggersLoading && (
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      Loading...
                    </span>
                  )}
                  <button
                    onClick={() => setShowActiveTriggers(!showActiveTriggers)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: activeTriggers.length > 0 ? '#3b82f6' : '#64748b',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                    }}
                  >
                    {showActiveTriggers ? '▼' : '▶'}
                  </button>
                </div>
              </div>
              {showActiveTriggers && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  {triggersError && (
                    <div
                      style={{
                        padding: '0.5rem',
                        background: '#fee2e2',
                        border: '1px solid #ef4444',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        color: '#dc2626',
                      }}
                    >
                      Error: {triggersError}
                    </div>
                  )}
                  {activeTriggers.length === 0 &&
                    !triggersLoading &&
                    !triggersError && (
                      <div
                        style={{
                          padding: '0.75rem',
                          background: 'white',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          color: '#64748b',
                          textAlign: 'center',
                          border: '1px solid #e0e0e0',
                        }}
                      >
                        No active triggers. Add a Trigger node (Google Sheets,
                        Schedule, or Webhook) and save the workflow to activate.
                      </div>
                    )}
                  {activeTriggers.map((trigger, index) => (
                    <div
                      key={trigger.id || index}
                      style={{
                        padding: '0.75rem',
                        background: 'white',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        border: '1px solid #e0e0e0',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          marginBottom: '0.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        {trigger.triggerConfig?.type === 'google-sheets-trigger'
                          ? '📊 Google Sheets Trigger'
                          : trigger.triggerConfig?.type === 'schedule-trigger'
                            ? '⏰ Schedule Trigger'
                            : trigger.triggerConfig?.type === 'webhook-trigger'
                              ? '🔗 Webhook Trigger'
                              : '🚀 Manual Trigger'}
                        {trigger.state && (
                          <span
                            style={{
                              padding: '0.125rem 0.5rem',
                              borderRadius: '12px',
                              fontSize: '0.65rem',
                              background:
                                trigger.state === 'active'
                                  ? '#10b981'
                                  : '#64748b',
                              color: 'white',
                            }}
                          >
                            {trigger.state}
                          </span>
                        )}
                      </div>
                      {/* Webhook Trigger Info */}
                      {trigger.triggerConfig?.type === 'webhook-trigger' && (
                        <>
                          <div
                            style={{
                              color: '#64748b',
                              fontSize: '0.7rem',
                              marginBottom: '0.25rem',
                            }}
                          >
                            Method: {trigger.triggerConfig.method || 'POST'}
                          </div>
                          <div
                            style={{
                              color: '#64748b',
                              fontSize: '0.7rem',
                              marginBottom: '0.25rem',
                              wordBreak: 'break-all',
                            }}
                          >
                            URL:{' '}
                            <code
                              style={{
                                background: '#f1f5f9',
                                padding: '0.125rem 0.25rem',
                                borderRadius: '4px',
                                fontSize: '0.65rem',
                              }}
                            >
                              {typeof window !== 'undefined'
                                ? `${window.location.origin}${trigger.triggerConfig.webhookUrl}`
                                : trigger.triggerConfig.webhookUrl}
                            </code>
                          </div>
                        </>
                      )}
                      {/* Google Sheets Trigger Info */}
                      {trigger.triggerConfig?.type ===
                        'google-sheets-trigger' && (
                        <>
                          {trigger.triggerConfig?.spreadsheetId && (
                            <div
                              style={{
                                color: '#64748b',
                                fontSize: '0.7rem',
                                marginBottom: '0.25rem',
                              }}
                            >
                              Sheet: {trigger.triggerConfig.sheetName || 'N/A'}
                            </div>
                          )}
                          <div
                            style={{
                              color: '#64748b',
                              fontSize: '0.7rem',
                              marginBottom: '0.25rem',
                            }}
                          >
                            Poll Interval:{' '}
                            {trigger.triggerConfig?.pollTime || 'N/A'}
                          </div>
                          {trigger.triggerConfig?.triggerOn && (
                            <div
                              style={{
                                color: '#64748b',
                                fontSize: '0.7rem',
                                marginBottom: '0.25rem',
                              }}
                            >
                              Trigger On: {trigger.triggerConfig.triggerOn}
                            </div>
                          )}
                        </>
                      )}
                      {/* Schedule Trigger Info */}
                      {trigger.triggerConfig?.type === 'schedule-trigger' && (
                        <>
                          {trigger.triggerConfig?.cronExpression && (
                            <div
                              style={{
                                color: '#64748b',
                                fontSize: '0.7rem',
                                marginBottom: '0.25rem',
                              }}
                            >
                              Cron: {trigger.triggerConfig.cronExpression}
                            </div>
                          )}
                          {trigger.triggerConfig?.preset && (
                            <div
                              style={{
                                color: '#64748b',
                                fontSize: '0.7rem',
                                marginBottom: '0.25rem',
                              }}
                            >
                              Preset: {trigger.triggerConfig.preset}
                            </div>
                          )}
                        </>
                      )}
                      {trigger.nextRun && (
                        <div
                          style={{
                            color: '#64748b',
                            fontSize: '0.7rem',
                            marginBottom: '0.25rem',
                          }}
                        >
                          Next Run: {new Date(trigger.nextRun).toLocaleString()}
                        </div>
                      )}
                      {trigger.id && (
                        <div
                          style={{
                            color: '#94a3b8',
                            fontSize: '0.65rem',
                            marginTop: '0.25rem',
                          }}
                        >
                          ID: {trigger.id}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Trigger Nodes */}
          <h3
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#64748b',
              marginBottom: '0.5rem',
              marginTop: '0',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            Trigger Nodes
          </h3>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              marginBottom: '1.5rem',
            }}
          >
            <button
              onClick={() => addNode('start')}
              style={{
                padding: '0.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                background: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>🚀</span>
              <span>Manual Trigger</span>
            </button>
            <button
              onClick={() => addNode('google-sheets-trigger')}
              style={{
                padding: '0.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                background: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>📊</span>
              <span>Google Sheets Trigger</span>
            </button>
            <button
              onClick={() => addNode('webhook-trigger')}
              style={{
                padding: '0.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                background: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>🔗</span>
              <span>Webhook Trigger</span>
            </button>
            <button
              onClick={() => addNode('schedule-trigger')}
              style={{
                padding: '0.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                background: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>⏰</span>
              <span>Schedule Trigger</span>
            </button>
          </div>

          {/* Action Nodes */}
          <h3
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#64748b',
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            Action Nodes
          </h3>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
          >
            <button
              onClick={() => addNode('http-request')}
              style={{
                padding: '0.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                background: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>🌐</span>
              <span>HTTP Request</span>
            </button>
            <button
              onClick={() => addNode('call-agent')}
              style={{
                padding: '0.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                background: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>📞</span>
              <span>Call Agent</span>
            </button>
            <button
              onClick={() => addNode('database-query')}
              style={{
                padding: '0.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                background: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>🗄️</span>
              <span>Database Query</span>
            </button>
            <button
              onClick={() => addNode('google-sheets')}
              style={{
                padding: '0.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                background: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>📊</span>
              <span>Google Sheets</span>
            </button>
            <button
              onClick={() => addNode('knowledge-base-query')}
              style={{
                padding: '0.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                background: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>📚</span>
              <span>Knowledge Base</span>
            </button>
            <button
              onClick={() => addNode('ai-agent')}
              style={{
                padding: '0.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                background: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>🤖</span>
              <span>AI Agent</span>
            </button>
            <button
              onClick={() => addNode('email')}
              style={{
                padding: '0.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                background: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>📧</span>
              <span>Email</span>
            </button>
          </div>

          {/* Utility Nodes */}
          <h3
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#64748b',
              marginTop: '1.5rem',
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            Utility Nodes
          </h3>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
          >
            <button
              onClick={() => addNode('if')}
              style={{
                padding: '0.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                background: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>🔀</span>
              <span>If (Condition)</span>
            </button>
            <button
              onClick={() => addNode('merge')}
              style={{
                padding: '0.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                background: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>🔀</span>
              <span>Merge</span>
            </button>
            <button
              onClick={() => addNode('wait')}
              style={{
                padding: '0.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                background: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>⏳</span>
              <span>Wait</span>
            </button>
            <button
              onClick={() => addNode('variable-set')}
              style={{
                padding: '0.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                background: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>📝</span>
              <span>Variable Set</span>
            </button>
            <button
              onClick={() => addNode('end')}
              style={{
                padding: '0.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                background: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>🏁</span>
              <span>End</span>
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            background: '#f5f5f5',
            paddingRight: selectedNode ? '350px' : '0',
            transition: 'padding-right 0.3s',
            boxSizing: 'border-box',
          }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges.map(edge => {
              // Check if this is a fallback edge
              const sourceNode = nodes.find(n => n.id === edge.source);
              const isFallbackEdge =
                sourceNode?.data?.errorConfig?.onError === 'fallback' &&
                sourceNode?.data?.errorConfig?.fallbackNodeId === edge.target;

              return {
                ...edge,
                style: {
                  ...edge.style,
                  stroke: isFallbackEdge
                    ? executedEdges.includes(edge.id)
                      ? '#f59e0b' // Orange when executed
                      : '#ef4444' // Red for fallback edges
                    : executedEdges.includes(edge.id)
                      ? '#10b981' // Green when executed
                      : edge.style?.stroke || '#b1b1b7',
                  strokeWidth: executedEdges.includes(edge.id)
                    ? 3
                    : isFallbackEdge
                      ? 2.5
                      : edge.style?.strokeWidth || 2,
                  strokeDasharray: isFallbackEdge ? '5,5' : undefined, // Dashed line for fallback
                },
                animated: executedEdges.includes(edge.id),
              };
            })}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background variant="grid" gap={20} size={1} color="#e2e8f0" />
            <Controls />
            <MiniMap
              nodeColor={node => {
                const colors = {
                  start: '#10b981',
                  end: '#ef4444',
                  webhook: '#8b5cf6',
                  'http-request': '#3b82f6',
                  'call-agent': '#10b981',
                  'ai-agent': '#3b82f6',
                  email: '#8b5cf6',
                  'variable-set': '#f59e0b',
                  if: '#f59e0b',
                  merge: '#8b5cf6',
                  wait: '#6366f1',
                  'database-query': '#06b6d4',
                  'google-sheets': '#34d399',
                  'google-sheets-trigger': '#34d399',
                  'webhook-trigger': '#8b5cf6',
                  'schedule-trigger': '#8b5cf6',
                  'knowledge-base-query': '#a78bfa',
                };
                return colors[node.type] || '#94a3b8';
              }}
              nodeStrokeWidth={3}
            />
          </ReactFlow>

          {/* Node Sidebar - n8n style - positioned absolutely */}
          {selectedNode && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: showKnowledgeBase ? '400px' : 0,
                bottom: 0,
                width: '100%',
                maxWidth: '1200px',
                zIndex: 10,
                transition: 'right 0.3s',
              }}
            >
              <NodeSidebarN8N
                selectedNode={selectedNode}
                nodes={nodes}
                edges={edges}
                onNodeUpdate={onNodeUpdate}
                onClose={() => setSelectedNode(null)}
                onDeleteNode={nodeId => {
                  setNodes(nds => nds.filter(n => n.id !== nodeId));
                  setEdges(eds =>
                    eds.filter(e => e.source !== nodeId && e.target !== nodeId)
                  );
                  setSelectedNode(null);
                }}
                workflowId={id ? parseInt(id, 10) : null}
              />
            </div>
          )}

          {/* Knowledge Base Manager - positioned absolutely */}
          {showKnowledgeBase && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                width: '400px',
                zIndex: 10,
              }}
            >
              <KnowledgeBaseManager
                onClose={() => setShowKnowledgeBase(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Execution Status Banner */}
      {executionStatus && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '1rem 2rem',
            background:
              executionStatus.status === 'success'
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : executionStatus.status === 'error'
                  ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                  : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: 'white',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            minWidth: '300px',
            maxWidth: '600px',
          }}
        >
          <div style={{ fontSize: '1.5rem' }}>
            {executionStatus.status === 'success'
              ? '✅'
              : executionStatus.status === 'error'
                ? '❌'
                : '⏳'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
              {executionStatus.status === 'success'
                ? 'Workflow Executed'
                : executionStatus.status === 'error'
                  ? 'Execution Failed'
                  : 'Executing...'}
            </div>
            <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
              {executionStatus.message}
              {executionStatus.eventId && (
                <div style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}>
                  Event ID: {executionStatus.eventId}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setExecutionStatus(null)}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              borderRadius: '6px',
              padding: '0.25rem 0.5rem',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Import Modal */}
      <WorkflowImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
}

export default FullWorkflowEditor;
