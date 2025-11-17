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
import {
  Database,
  Download,
  Upload,
  Save,
  Play,
  BarChart3,
  Zap,
  ArrowLeft,
  Loader2,
  ChevronDown,
  ChevronRight,
  FileEdit,
  Clipboard,
  Rocket,
  Sheet,
  Link as LinkIcon,
  Clock,
  Globe,
  Phone,
  Mail,
  GitBranch,
  GitMerge,
  Flag,
  Bot,
  Timer,
} from 'lucide-react';

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

const EXECUTION_POLL_INTERVAL_MS = 1000;
const EXECUTION_HISTORY_REFRESH_INTERVAL_MS = 5000;
const ACTIVE_TRIGGERS_REFRESH_INTERVAL_MS = 10000;
const AUTO_REFRESH_PAUSE_DURATION_MS = 30000;

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
  // Track multiple active executions simultaneously
  const activeExecutionsRef = useRef(new Map()); // Map<eventId, { status, executedEdges, nodeOutputs, executionLog }>
  const activeExecutionsPollingRef = useRef(new Map()); // Map<eventId, intervalId>
  const eventSourceRef = useRef(null);
  const eventStreamReconnectTimeoutRef = useRef(null);
  const autoRefreshPauseUntilRef = useRef(0);
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

  const isAutoRefreshPaused = () => autoRefreshPauseUntilRef.current > Date.now();

  const logAutoRefreshPauseSkip = label => {
    const resumeInMs = Math.max(
      0,
      autoRefreshPauseUntilRef.current - Date.now()
    );
    console.log('⏸️ Auto refresh paused, skipping request', {
      label,
      resumeInMs,
      resumeAt: new Date(autoRefreshPauseUntilRef.current).toISOString(),
    });
  };

  const pauseAutoRefresh = (reason, context = {}) => {
    autoRefreshPauseUntilRef.current = Date.now() + AUTO_REFRESH_PAUSE_DURATION_MS;
    console.warn('⏸️ Auto refresh paused due to gateway response', {
      reason,
      resumeAt: new Date(autoRefreshPauseUntilRef.current).toISOString(),
      context,
    });
  };

  const handleHttpAccessIssues = (response, contextLabel) => {
    if (!response) {
      return false;
    }

    if (response.status === 401) {
      console.warn('Session expired while calling workflow API', {
        context: contextLabel,
      });
      setGeneralError('Session expired. Please sign in again.');
      return true;
    }

    if (response.status === 403) {
      pauseAutoRefresh('403 Forbidden', { context: contextLabel });
      setGeneralError(
        'Gateway returned 403 (tunnel/security). Pausing auto-refresh for 30s so it can recover.'
      );
      return true;
    }

    return false;
  };

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
      }, ACTIVE_TRIGGERS_REFRESH_INTERVAL_MS);
      return () => clearInterval(interval);
    }
  }, [id, isNew]);

  // Fetch statistics
  const fetchStatistics = async () => {
    if (!id || isNew) return;
    if (isAutoRefreshPaused()) {
      logAutoRefreshPauseSkip('statistics');
      return;
    }
    try {
      setStatisticsLoading(true);
      setStatisticsError(null);
      const response = await fetchWithCSRF(
        `/api/full-workflows/${id}/statistics`
      );
      if (!response.ok) {
        if (handleHttpAccessIssues(response, 'statistics')) {
          return;
        }
        throw new Error('Failed to fetch statistics');
      }
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
    if (isAutoRefreshPaused()) {
      logAutoRefreshPauseSkip('performance');
      return;
    }
    try {
      setPerformanceLoading(true);
      setPerformanceError(null);
      const data = await workflowPerformanceService.getPerformance(
        parseInt(id, 10)
      );
      setPerformance(data);
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) {
        handleHttpAccessIssues({ status: error.status }, 'performance');
      } else {
        console.error('Error fetching performance:', error);
        setPerformanceError(error.message);
      }
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
      if (isAutoRefreshPaused()) {
        logAutoRefreshPauseSkip('node-history');
        return;
      }
      workflowPerformanceService
        .getNodeHistory(parseInt(id, 10), selectedNodeForGraph, 50)
        .then(setNodeHistory)
        .catch(err => {
          if (err?.status === 401 || err?.status === 403) {
            handleHttpAccessIssues({ status: err.status }, 'node-history');
          } else {
            console.error('Error fetching node history:', err);
          }
          setNodeHistory([]);
        });
    }
  }, [selectedNodeForGraph, id, isNew]);

  // Track last seen execution timestamp to detect new executions
  const lastExecutionTimestampRef = useRef(null);

  // Helper function to update visualization from all active executions
  const updateVisualizationFromActiveExecutions = () => {
    const activeExecutions = activeExecutionsRef.current;
    if (activeExecutions.size === 0) return;

    // Combine all executed edges from all active executions
    const allExecutedEdges = new Set();
    const nodeStatusMap = new Map(); // Map<nodeId, { status, output, timestamp }>
    const nodeOutputsMap = new Map(); // Map<nodeId, output>

    // Process all active executions
    activeExecutions.forEach((executionData, eventId) => {
      // Add executed edges
      if (executionData.executedEdges) {
        executionData.executedEdges.forEach(edge => {
          allExecutedEdges.add(edge);
        });
      }

      // Update node statuses (keep the latest status for each node)
      if (executionData.executionLog) {
        executionData.executionLog.forEach(logEntry => {
          const existing = nodeStatusMap.get(logEntry.nodeId);
          const logTimestamp = new Date(logEntry.timestamp || 0).getTime();
          if (!existing || logTimestamp > existing.timestamp) {
            nodeStatusMap.set(logEntry.nodeId, {
              status: logEntry.status === 'failed' ? 'failed' : 'success',
              timestamp: logTimestamp,
            });
          }
        });
      }

      // Update node outputs (keep the latest output for each node)
      if (executionData.nodeOutputs) {
        Object.entries(executionData.nodeOutputs).forEach(([nodeId, output]) => {
          const existing = nodeOutputsMap.get(nodeId);
          const executionTimestamp = executionData.timestamp || 0;
          if (!existing || executionTimestamp > existing.timestamp) {
            nodeOutputsMap.set(nodeId, { output, timestamp: executionTimestamp });
          }
        });
      }
    });

    // Update executed edges state
    setExecutedEdges(Array.from(allExecutedEdges));

    // Update nodes state
    setNodes(nds =>
      nds.map(node => {
        const statusInfo = nodeStatusMap.get(node.id);
        const outputInfo = nodeOutputsMap.get(node.id);
        
        // If node has been executed in any active execution, update it
        if (statusInfo || outputInfo) {
          return {
            ...node,
            data: {
              ...node.data,
              status: statusInfo?.status || node.data.status || 'running',
              output: outputInfo?.output !== undefined ? outputInfo.output : node.data.output,
            },
          };
        }
        // If no active execution has executed this node yet, keep it as running
        return {
          ...node,
          data: {
            ...node.data,
            status: node.data.status === 'success' || node.data.status === 'failed' 
              ? node.data.status 
              : 'running',
          },
        };
      })
    );
  };

  // Poll a single execution by eventId
  const pollExecution = async eventId => {
    try {
      if (isAutoRefreshPaused()) {
        logAutoRefreshPauseSkip(`execution-poll:${eventId}`);
        return true;
      }

      const resultsResponse = await fetchWithCSRF(
        `/api/full-workflows/execution-results?eventId=${encodeURIComponent(eventId)}`
      );

      if (resultsResponse.ok) {
        const resultsData = await resultsResponse.json();
        const status = resultsData.data?.status;

        // Update execution data in activeExecutionsRef
        const executionData = {
          status,
          executedEdges: resultsData.data?.executedEdges || [],
          nodeOutputs: resultsData.data?.nodeOutputs || {},
          executionLog: resultsData.data?.executionLog || [],
          timestamp: resultsData.data?.startedAt || Date.now(),
        };
        activeExecutionsRef.current.set(eventId, executionData);

        // Update visualization
        updateVisualizationFromActiveExecutions();

        // If execution is still running, continue polling
        if (status === 'pending' || status === 'running') {
          return true; // Continue polling
        } else {
          // Execution completed - stop polling for this execution
          console.log('✅ Execution completed', {
            eventId,
            status,
            nodeOutputsCount: Object.keys(executionData.nodeOutputs || {}).length,
            executedEdgesCount: executionData.executedEdges?.length || 0,
          });
          const intervalId = activeExecutionsPollingRef.current.get(eventId);
          if (intervalId) {
            clearInterval(intervalId);
            activeExecutionsPollingRef.current.delete(eventId);
          }
          // Keep execution data for a bit longer, then remove it
          setTimeout(() => {
            activeExecutionsRef.current.delete(eventId);
            updateVisualizationFromActiveExecutions();
          }, 3000); // Keep for 5 seconds after completion
          return false; // Stop polling
        }
      } else if (resultsResponse.status === 404) {
        // Execution not found - might still be starting, continue polling
        return true;
      } else {
        if (handleHttpAccessIssues(resultsResponse, `execution-results:${eventId}`)) {
          const resumeInMs = Math.max(
            0,
            autoRefreshPauseUntilRef.current - Date.now()
          );
          if (resumeInMs > 0) {
            console.log('♻️ Scheduling execution poll retry after pause', {
              eventId,
              resumeInMs,
            });
            setTimeout(() => {
              if (activeExecutionsRef.current.has(eventId)) {
                console.log('♻️ Resuming execution poll after pause', {
                  eventId,
                });
                startPollingExecution(eventId);
              }
            }, resumeInMs + 100);
          }
        } else {
          console.warn('Error polling execution', {
            eventId,
            status: resultsResponse.status,
          });
        }
        return false;
      }
    } catch (error) {
      console.warn('Error polling execution', { eventId, error: error.message });
      return false;
    }
  };

  // Start polling for a specific execution
  const startPollingExecution = (eventId) => {
    // Don't start polling if already polling this execution
    if (activeExecutionsPollingRef.current.has(eventId)) {
      return;
    }

    console.log('🔄 Starting polling for execution', { eventId });

    // Poll immediately
    pollExecution(eventId).then(shouldContinue => {
      if (shouldContinue) {
        const intervalId = setInterval(async () => {
          const shouldContinue = await pollExecution(eventId);
          if (!shouldContinue) {
            clearInterval(intervalId);
            activeExecutionsPollingRef.current.delete(eventId);
          }
        }, EXECUTION_POLL_INTERVAL_MS);
        activeExecutionsPollingRef.current.set(eventId, intervalId);
      }
    });
  };

  // Fetch execution history
  const fetchExecutionHistory = async () => {
    if (!id || isNew) return;
    if (isAutoRefreshPaused()) {
      logAutoRefreshPauseSkip('execution-history');
      return;
    }
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const response = await fetchWithCSRF(
        `/api/full-workflows/${id}/execution-history?limit=50`
      );
      if (!response.ok) {
        if (handleHttpAccessIssues(response, 'execution-history')) {
          return;
        }
        throw new Error('Failed to fetch execution history');
      }
      const data = await response.json();
      const history = data.data || [];
      setExecutionHistory(history);

      // Check if there's a new execution (for automatic output loading)
      if (history.length > 0) {
        const latestExecution = history[0];
        const latestTimestamp = new Date(latestExecution.timestamp).getTime();

        // Initialize lastExecutionTimestampRef on first load (to avoid loading old executions)
        if (lastExecutionTimestampRef.current === null) {
          lastExecutionTimestampRef.current = latestTimestamp;
          console.log('🔵 Initialized lastExecutionTimestampRef', {
            timestamp: latestTimestamp,
          });
          return; // Don't load outputs on initial load
        }

        // Check for new executions (not just the latest, but all recent ones)
        // This allows multiple triggers to run simultaneously
        const newExecutions = history.filter(execution => {
          const execTimestamp = new Date(execution.timestamp).getTime();
          return (
            execution.eventId &&
            execTimestamp > (lastExecutionTimestampRef.current || 0) &&
            !activeExecutionsRef.current.has(execution.eventId) &&
            !activeExecutionsPollingRef.current.has(execution.eventId)
          );
        });

        // Process all new executions
        if (newExecutions.length > 0) {
          console.log('🆕 New execution(s) detected', {
            count: newExecutions.length,
            eventIds: newExecutions.map(e => e.eventId),
            lastSeen: lastExecutionTimestampRef.current,
          });

          // Update last seen timestamp to the latest
          const latestNewTimestamp = Math.max(
            ...newExecutions.map(e => new Date(e.timestamp).getTime())
          );
          lastExecutionTimestampRef.current = latestNewTimestamp;

          // Start polling for each new execution
          newExecutions.forEach(execution => {
            if (execution.eventId) {
              // Mark nodes as running when new execution starts (only if no other execution is running)
              if (activeExecutionsRef.current.size === 0) {
                setNodes(nds =>
                  nds.map(node => ({
                    ...node,
                    data: { ...node.data, status: 'running' },
                  }))
                );
              }
              startPollingExecution(execution.eventId);
            }
          });
        } else if (latestTimestamp > (lastExecutionTimestampRef.current || 0)) {
          // Fallback: single execution detection (backward compatibility)
          const latestExecution = history[0];
          if (latestExecution.eventId && !activeExecutionsRef.current.has(latestExecution.eventId)) {
            console.log('🆕 New execution detected (fallback)', {
              eventId: latestExecution.eventId,
              timestamp: latestTimestamp,
            });
            lastExecutionTimestampRef.current = latestTimestamp;
            if (activeExecutionsRef.current.size === 0) {
              setNodes(nds =>
                nds.map(node => ({
                  ...node,
                  data: { ...node.data, status: 'running' },
                }))
              );
            }
            startPollingExecution(latestExecution.eventId);
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
      const interval = setInterval(
        fetchExecutionHistory,
        EXECUTION_HISTORY_REFRESH_INTERVAL_MS
      );
      return () => clearInterval(interval);
    }
  }, [id, isNew]);

  useEffect(() => {
    if (!id || isNew) {
      return undefined;
    }

    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      console.warn('⚠️ EventSource not available in this environment, skipping workflow events stream.');
      return undefined;
    }

    let isMounted = true;

    const connectToEventStream = () => {
      if (!isMounted) return;

      if (eventSourceRef.current) {
        console.log('🔌 Closing existing workflow events stream before reconnecting', {
          workflowId: id,
        });
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      const eventsUrl = `/api/full-workflows/events?workflowId=${encodeURIComponent(id)}`;
      console.log('🔌 Connecting to workflow events stream', {
        workflowId: id,
        eventsUrl,
      });

      const source = new EventSource(eventsUrl, { withCredentials: true });
      eventSourceRef.current = source;

      const scheduleReconnect = () => {
        if (!isMounted) return;
        if (eventStreamReconnectTimeoutRef.current) {
          clearTimeout(eventStreamReconnectTimeoutRef.current);
        }
        eventStreamReconnectTimeoutRef.current = setTimeout(() => {
          console.log('♻️ Attempting to reconnect to workflow events stream', {
            workflowId: id,
          });
          connectToEventStream();
        }, 2000);
      };

      const parsePayload = event => {
        if (!event?.data) {
          console.warn('⚠️ Received workflow event without data payload', {
            workflowId: id,
            eventType: event?.type,
          });
          return null;
        }
        try {
          return JSON.parse(event.data);
        } catch (error) {
          console.warn('⚠️ Failed to parse workflow event payload', {
            workflowId: id,
            eventType: event?.type,
            rawData: event.data,
            error: error.message,
          });
          return null;
        }
      };

      const handleCompletionLikeEvent = (payload, eventType) => {
        if (!payload?.eventId) {
          console.warn('⚠️ Workflow completion event missing eventId', {
            workflowId: id,
            eventType,
            payload,
          });
          return;
        }
        console.log('🏁 Workflow completion-type event received', {
          workflowId: id,
          eventType,
          payload,
        });
        pollExecution(payload.eventId).catch(error => {
          console.warn('⚠️ Failed to poll execution after completion event', {
            workflowId: id,
            eventType,
            eventId: payload.eventId,
            error: error.message,
          });
        });
        fetchExecutionHistory().catch(error => {
          console.warn('⚠️ Failed to refresh execution history after completion event', {
            workflowId: id,
            eventType,
            error: error.message,
          });
        });
      };

      source.onopen = () => {
        console.log('🟢 Workflow events stream connected', {
          workflowId: id,
        });
      };

      source.onerror = error => {
        console.warn('⚠️ Workflow events stream error', {
          workflowId: id,
          error,
        });
        source.close();
        eventSourceRef.current = null;
        scheduleReconnect();
      };

      source.addEventListener('ready', event => {
        const payload = parsePayload(event);
        console.log('✅ Workflow events stream ready', {
          workflowId: id,
          payload,
        });
      });

      source.addEventListener('heartbeat', event => {
        const payload = parsePayload(event);
        console.log('💓 Workflow events heartbeat', {
          workflowId: id,
          payload,
        });
      });

      source.addEventListener('workflow.pending', event => {
        const payload = parsePayload(event);
        if (!payload) return;
        if (payload.workflowId && Number(payload.workflowId) !== Number(id)) {
          console.log('⏭️ Ignoring workflow.pending event for different workflow', {
            currentWorkflowId: id,
            payloadWorkflowId: payload.workflowId,
          });
          return;
        }
        console.log('📨 workflow.pending event received', {
          workflowId: id,
          payload,
        });
        if (payload.eventId && !activeExecutionsRef.current.has(payload.eventId)) {
          startPollingExecution(payload.eventId);
        }
      });

      source.addEventListener('workflow.running', event => {
        const payload = parsePayload(event);
        if (!payload) return;
        if (payload.workflowId && Number(payload.workflowId) !== Number(id)) {
          return;
        }
        console.log('🏃 workflow.running event received', {
          workflowId: id,
          payload,
        });
      });

      source.addEventListener('workflow.completed', event => {
        const payload = parsePayload(event);
        if (!payload) return;
        if (payload.workflowId && Number(payload.workflowId) !== Number(id)) {
          return;
        }
        handleCompletionLikeEvent(payload, 'workflow.completed');
      });

      source.addEventListener('workflow.failed', event => {
        const payload = parsePayload(event);
        if (!payload) return;
        if (payload.workflowId && Number(payload.workflowId) !== Number(id)) {
          return;
        }
        handleCompletionLikeEvent(payload, 'workflow.failed');
      });
    };

    connectToEventStream();

    return () => {
      isMounted = false;
      if (eventStreamReconnectTimeoutRef.current) {
        clearTimeout(eventStreamReconnectTimeoutRef.current);
        eventStreamReconnectTimeoutRef.current = null;
      }
      if (eventSourceRef.current) {
        console.log('🔌 Closing workflow events stream', { workflowId: id });
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [id, isNew]);

  // Cleanup polling intervals on unmount
  useEffect(() => {
    return () => {
      // Cleanup legacy polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
      // Cleanup all active execution polling intervals
      activeExecutionsPollingRef.current.forEach((intervalId) => {
        clearInterval(intervalId);
      });
      activeExecutionsPollingRef.current.clear();
      activeExecutionsRef.current.clear();
    };
  }, []);

  const fetchActiveTriggers = async () => {
    if (!id) return;
    if (isAutoRefreshPaused()) {
      logAutoRefreshPauseSkip('active-triggers');
      return;
    }
    try {
      setTriggersLoading(true);
      setTriggersError(null);
      const response = await fetchWithCSRF(
        `/api/full-workflows/${id}/triggers`
      );
      if (!response.ok) {
        if (handleHttpAccessIssues(response, 'active-triggers')) {
          return;
        }
        throw new Error('Failed to fetch triggers');
      }
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
          background: 'hsl(var(--card))',
          padding: '1rem 2rem',
          borderBottom: '1px solid hsl(var(--border))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: 'hsl(var(--foreground))',
          width: '100%',
          maxWidth: '100%',
          overflowX: 'hidden',
          boxSizing: 'border-box',
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
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              background: 'hsl(var(--secondary))',
              color: 'hsl(var(--secondary-foreground))',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'hsl(var(--accent))';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'hsl(var(--secondary))';
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </button>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Workflow Name"
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid hsl(var(--input))',
              borderRadius: '8px',
              fontSize: '1rem',
              minWidth: '200px',
              background: 'hsl(var(--background))',
              color: 'hsl(var(--foreground))',
            }}
          />
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid hsl(var(--input))',
              borderRadius: '8px',
              fontSize: '1rem',
              background: 'hsl(var(--background))',
              color: 'hsl(var(--foreground))',
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
                ? 'hsl(var(--primary))'
                : 'hsl(var(--secondary))',
              color: showKnowledgeBase
                ? 'hsl(var(--primary-foreground))'
                : 'hsl(var(--secondary-foreground))',
              border: `1px solid ${showKnowledgeBase ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              if (!showKnowledgeBase) {
                e.currentTarget.style.background = 'hsl(var(--accent))';
                e.currentTarget.style.borderColor = 'hsl(var(--primary))';
              }
            }}
            onMouseLeave={e => {
              if (!showKnowledgeBase) {
                e.currentTarget.style.background = 'hsl(var(--secondary))';
                e.currentTarget.style.borderColor = 'hsl(var(--border))';
              }
            }}
          >
            <Database className="w-4 h-4" />
            Knowledge Base
          </button>
          {!isNew && (
            <button
              onClick={handleExport}
              disabled={exporting || saving}
              style={{
                padding: '0.5rem 1rem',
                background: 'hsl(var(--secondary))',
                color: 'hsl(var(--secondary-foreground))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: exporting || saving ? 'not-allowed' : 'pointer',
                opacity: exporting || saving ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                if (!exporting && !saving) {
                  e.currentTarget.style.background = 'hsl(var(--accent))';
                  e.currentTarget.style.borderColor = 'hsl(var(--primary))';
                }
              }}
              onMouseLeave={e => {
                if (!exporting && !saving) {
                  e.currentTarget.style.background = 'hsl(var(--secondary))';
                  e.currentTarget.style.borderColor = 'hsl(var(--border))';
                }
              }}
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export
                </>
              )}
            </button>
          )}
          <button
            onClick={() => setShowImportModal(true)}
            disabled={saving}
            style={{
              padding: '0.5rem 1rem',
              background: 'hsl(var(--secondary))',
              color: 'hsl(var(--secondary-foreground))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              if (!saving) {
                e.currentTarget.style.background = 'hsl(var(--accent))';
                e.currentTarget.style.borderColor = 'hsl(var(--primary))';
              }
            }}
            onMouseLeave={e => {
              if (!saving) {
                e.currentTarget.style.background = 'hsl(var(--secondary))';
                e.currentTarget.style.borderColor = 'hsl(var(--border))';
              }
            }}
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '0.5rem 1.5rem',
              background: 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))',
              border: '1px solid hsl(var(--primary))',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              if (!saving) {
                e.currentTarget.style.background = 'hsl(var(--primary) / 0.9)';
              }
            }}
            onMouseLeave={e => {
              if (!saving) {
                e.currentTarget.style.background = 'hsl(var(--primary))';
              }
            }}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1" />
                Save
              </>
            )}
          </button>
          {!isNew && (
            <button
              onClick={handleExecute}
              disabled={executing || saving}
              style={{
                padding: '0.5rem 1.5rem',
                background: executing
                  ? '#10b981'
                  : 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
                border: '1px solid hsl(var(--primary))',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: executing || saving ? 'not-allowed' : 'pointer',
                opacity: executing || saving ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                if (!executing && !saving) {
                  e.currentTarget.style.background = 'hsl(var(--primary) / 0.9)';
                }
              }}
              onMouseLeave={e => {
                if (!executing && !saving) {
                  e.currentTarget.style.background = 'hsl(var(--primary))';
                }
              }}
            >
              {executing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  <span>Executing...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1" />
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
            background: 'hsl(var(--destructive) / 0.1)',
            border: '1px solid hsl(var(--destructive))',
            borderRadius: '0.5rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
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
                color: 'hsl(var(--destructive))',
                marginBottom: '0.25rem',
              }}
            >
              Error
            </div>
            <div style={{ fontSize: '0.875rem', color: 'hsl(var(--destructive))' }}>
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
            background: 'hsl(var(--card))',
            borderRight: '1px solid hsl(var(--border))',
            padding: '1rem',
            overflowY: 'auto',
            color: 'hsl(var(--foreground))',
          }}
        >
          {/* Statistics Section */}
          {!isNew && (
            <div
              style={{
                marginBottom: '1.5rem',
                padding: '0.75rem',
                background:
                  statistics?.totalExecutions > 0
                    ? 'hsl(var(--muted))'
                    : 'hsl(var(--card))',
                border: `1px solid ${statistics?.totalExecutions > 0 ? '#10b981' : 'hsl(var(--border))'}`,
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
                      statistics?.totalExecutions > 0
                        ? '#10b981'
                        : 'hsl(var(--muted-foreground))',
                    margin: 0,
                  }}
                >
                  <BarChart3 className="w-4 h-4 mr-1" />
                  Statistics
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
                  {showStatistics ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
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
                        background: 'hsl(var(--destructive) / 0.1)',
                        border: '1px solid hsl(var(--destructive))',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        color: 'hsl(var(--destructive))',
                      }}
                    >
                      Error: {statisticsError}
                    </div>
                  )}
                  {statisticsLoading && (
                    <div
                      style={{
                        padding: '0.75rem',
                        background: 'hsl(var(--muted))',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        color: 'hsl(var(--muted-foreground))',
                        textAlign: 'center',
                        border: '1px solid hsl(var(--border))',
                      }}
                    >
                      Loading statistics...
                    </div>
                  )}
                  {!statisticsLoading && !statisticsError && statistics && (
                    <div
                      style={{
                        padding: '0.75rem',
                        background: 'hsl(var(--muted))',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        border: '1px solid hsl(var(--border))',
                        color: 'hsl(var(--foreground))',
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
                          borderBottom: '1px solid hsl(var(--border))',
                        }}
                      >
                        <span style={{ color: 'hsl(var(--muted-foreground))' }}>
                          Total Executions
                        </span>
                        <span
                          style={{
                            fontWeight: 700,
                            color: 'hsl(var(--foreground))',
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
                          borderBottom: '1px solid hsl(var(--border))',
                        }}
                      >
                        <span style={{ color: 'hsl(var(--muted-foreground))' }}>Success Rate</span>
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
                          borderBottom: '1px solid hsl(var(--border))',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              color: 'hsl(var(--muted-foreground))',
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
                              color: 'hsl(var(--muted-foreground))',
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
                            borderBottom: '1px solid hsl(var(--border))',
                          }}
                        >
                          <div
                            style={{
                              color: 'hsl(var(--muted-foreground))',
                              fontSize: '0.65rem',
                              marginBottom: '0.25rem',
                            }}
                          >
                            Last Execution
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'hsl(var(--foreground))' }}>
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
                                color: 'hsl(var(--muted-foreground))',
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
                                color: 'hsl(var(--muted-foreground))',
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
                            borderTop: '1px solid hsl(var(--border))',
                          }}
                        >
                          <div
                            style={{
                              color: 'hsl(var(--muted-foreground))',
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
                              color: 'hsl(var(--destructive))',
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
                            borderTop: '2px solid hsl(var(--border))',
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
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '0.75rem',
                              color: 'hsl(var(--foreground))',
                              fontWeight: 600,
                            }}
                          >
                            <span>
                              <Clipboard className="w-4 h-4 mr-1" /> Execution History (
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
                        background: 'hsl(var(--muted))',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        color: 'hsl(var(--muted-foreground))',
                        textAlign: 'center',
                        border: '1px solid hsl(var(--border))',
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
                          background: 'hsl(var(--muted))',
                          borderRadius: '6px',
                          border: '1px solid hsl(var(--border))',
                          color: 'hsl(var(--foreground))',
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
                              color: 'hsl(var(--destructive))',
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
                              color: 'hsl(var(--muted-foreground))',
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
                                color: 'hsl(var(--muted-foreground))',
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
                                              color: 'hsl(var(--muted-foreground))',
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
                                            color: 'hsl(var(--muted-foreground))',
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
                                              color: 'hsl(var(--destructive))',
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
                                                  color: 'hsl(var(--destructive))',
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
                                                  background: 'hsl(var(--destructive) / 0.1)',
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
                                          background: 'hsl(var(--muted))',
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
                background: 'hsl(var(--card))',
                borderRadius: '8px',
                border: '1px solid hsl(var(--border))',
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
                    color: performance?.workflow ? '#10b981' : 'hsl(var(--muted-foreground))',
                    margin: 0,
                  }}
                >
                  <Zap className="w-4 h-4 mr-1" />
                  Performance
                </h3>
                <button
                  onClick={() => setShowPerformance(!showPerformance)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: performance?.workflow ? '#10b981' : 'hsl(var(--muted-foreground))',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  {showPerformance ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
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
                        background: 'hsl(var(--destructive) / 0.1)',
                        border: '1px solid hsl(var(--destructive))',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        color: 'hsl(var(--destructive))',
                      }}
                    >
                      Error: {performanceError}
                    </div>
                  )}
                  {performanceLoading && (
                    <div
                      style={{
                        padding: '0.75rem',
                        background: 'hsl(var(--muted))',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        color: 'hsl(var(--muted-foreground))',
                        textAlign: 'center',
                        border: '1px solid hsl(var(--border))',
                      }}
                    >
                      Loading performance data...
                    </div>
                  )}
                  {!performanceLoading && !performanceError && performance && (
                    <div
                      style={{
                        padding: '0.75rem',
                        background: 'hsl(var(--muted))',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        border: '1px solid hsl(var(--border))',
                        color: 'hsl(var(--foreground))',
                      }}
                    >
                      {/* Workflow-Level Performance */}
                      {performance.workflow && (
                        <div style={{ marginBottom: '1rem' }}>
                          <div
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              color: 'hsl(var(--muted-foreground))',
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
                            <span style={{ color: 'hsl(var(--muted-foreground))' }}>Avg Time</span>
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
                            <span style={{ color: 'hsl(var(--muted-foreground))' }}>Min Time</span>
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
                            <span style={{ color: 'hsl(var(--muted-foreground))' }}>Max Time</span>
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
                            <span style={{ color: 'hsl(var(--muted-foreground))' }}>
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
                              color: 'hsl(var(--muted-foreground))',
                              marginBottom: '0.5rem',
                              textTransform: 'uppercase',
                              borderTop: '1px solid hsl(var(--border))',
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
                                  background: idx === 0
                                    ? 'hsl(var(--muted))'
                                    : 'hsl(var(--card))',
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
                                      color: 'hsl(var(--foreground))',
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
                                    color: 'hsl(var(--muted-foreground))',
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
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.65rem',
                                    color: 'hsl(var(--muted-foreground))',
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
                                        border: '1px solid hsl(var(--border))',
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontSize: '0.65rem',
                                          color: 'hsl(var(--muted-foreground))',
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
                            color: 'hsl(var(--muted-foreground))',
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
                        background: 'hsl(var(--muted))',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        color: 'hsl(var(--muted-foreground))',
                        textAlign: 'center',
                        border: '1px solid hsl(var(--border))',
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
                background: activeTriggers.length > 0
                  ? 'hsl(var(--muted))'
                  : 'hsl(var(--card))',
                border: `1px solid ${activeTriggers.length > 0 ? '#3b82f6' : 'hsl(var(--border))'}`,
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
                        background: 'hsl(var(--destructive) / 0.1)',
                        border: '1px solid hsl(var(--destructive))',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        color: 'hsl(var(--destructive))',
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
                          color: 'hsl(var(--muted-foreground))',
                          textAlign: 'center',
                          border: '1px solid hsl(var(--border))',
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
                        background: 'hsl(var(--muted))',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        border: '1px solid hsl(var(--border))',
                        color: 'hsl(var(--foreground))',
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {trigger.triggerConfig?.type === 'google-sheets-trigger' ? (
                            <>
                              <Sheet className="w-4 h-4" style={{ color: '#34d399' }} />
                              <span>Google Sheets Trigger</span>
                            </>
                          ) : trigger.triggerConfig?.type === 'schedule-trigger' ? (
                            <>
                              <Clock className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                              <span>Schedule Trigger</span>
                            </>
                          ) : trigger.triggerConfig?.type === 'webhook-trigger' ? (
                            <>
                              <LinkIcon className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                              <span>Webhook Trigger</span>
                            </>
                          ) : (
                            <>
                              <Rocket className="w-4 h-4" style={{ color: '#10b981' }} />
                              <span>Manual Trigger</span>
                            </>
                          )}
                        </div>
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
                              color: 'hsl(var(--muted-foreground))',
                              fontSize: '0.7rem',
                              marginBottom: '0.25rem',
                            }}
                          >
                            Method: {trigger.triggerConfig.method || 'POST'}
                          </div>
                          <div
                            style={{
                              color: 'hsl(var(--muted-foreground))',
                              fontSize: '0.7rem',
                              marginBottom: '0.25rem',
                              wordBreak: 'break-all',
                            }}
                          >
                            URL:{' '}
                            <code
                              style={{
                                background: 'hsl(var(--muted))',
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
                                color: 'hsl(var(--muted-foreground))',
                                fontSize: '0.7rem',
                                marginBottom: '0.25rem',
                              }}
                            >
                              Sheet: {trigger.triggerConfig.sheetName || 'N/A'}
                            </div>
                          )}
                          <div
                            style={{
                              color: 'hsl(var(--muted-foreground))',
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
                                color: 'hsl(var(--muted-foreground))',
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
                                color: 'hsl(var(--muted-foreground))',
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
                                color: 'hsl(var(--muted-foreground))',
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
                            color: 'hsl(var(--muted-foreground))',
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
                            color: 'hsl(var(--muted-foreground))',
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
              color: 'hsl(var(--muted-foreground))',
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
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
              className="node-palette-button"
            >
              <Rocket className="w-4 h-4" style={{ color: '#10b981' }} />
              <span>Manual Trigger</span>
            </button>
            <button
              onClick={() => addNode('google-sheets-trigger')}
              style={{
                padding: '0.75rem',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
            >
              <Sheet className="w-4 h-4" style={{ color: '#34d399' }} />
              <span>Google Sheets Trigger</span>
            </button>
            <button
              onClick={() => addNode('webhook-trigger')}
              style={{
                padding: '0.75rem',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
              className="node-palette-button"
            >
              <LinkIcon className="w-4 h-4" style={{ color: '#8b5cf6' }} />
              <span>Webhook Trigger</span>
            </button>
            <button
              onClick={() => addNode('schedule-trigger')}
              style={{
                padding: '0.75rem',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
              className="node-palette-button"
            >
              <Clock className="w-4 h-4" style={{ color: '#8b5cf6' }} />
              <span>Schedule Trigger</span>
            </button>
          </div>

          {/* Action Nodes */}
          <h3
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'hsl(var(--muted-foreground))',
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
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
              className="node-palette-button"
            >
              <Globe className="w-4 h-4" style={{ color: '#3b82f6' }} />
              <span>HTTP Request</span>
            </button>
            <button
              onClick={() => addNode('call-agent')}
              style={{
                padding: '0.75rem',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
              className="node-palette-button"
            >
              <Phone className="w-4 h-4" style={{ color: '#10b981' }} />
              <span>Call Agent</span>
            </button>
            <button
              onClick={() => addNode('database-query')}
              style={{
                padding: '0.75rem',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
              className="node-palette-button"
            >
              <Database className="w-4 h-4" style={{ color: '#06b6d4' }} />
              <span>Database Query</span>
            </button>
            <button
              onClick={() => addNode('google-sheets')}
              style={{
                padding: '0.75rem',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
            >
              <Sheet className="w-4 h-4" style={{ color: '#34d399' }} />
              <span>Google Sheets</span>
            </button>
            <button
              onClick={() => addNode('knowledge-base-query')}
              style={{
                padding: '0.75rem',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
              className="node-palette-button"
            >
              <Database className="w-4 h-4" style={{ color: '#a78bfa' }} />
              <span>Knowledge Base</span>
            </button>
            <button
              onClick={() => addNode('ai-agent')}
              style={{
                padding: '0.75rem',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
              className="node-palette-button"
            >
              <Bot className="w-4 h-4" style={{ color: '#3b82f6' }} />
              <span>AI Agent</span>
            </button>
            <button
              onClick={() => addNode('email')}
              style={{
                padding: '0.75rem',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
              className="node-palette-button"
            >
              <Mail className="w-4 h-4" style={{ color: '#8b5cf6' }} />
              <span>Email</span>
            </button>
          </div>

          {/* Utility Nodes */}
          <h3
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'hsl(var(--muted-foreground))',
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
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
              className="node-palette-button"
            >
              <GitBranch className="w-4 h-4" style={{ color: '#f59e0b' }} />
              <span>If (Condition)</span>
            </button>
            <button
              onClick={() => addNode('merge')}
              style={{
                padding: '0.75rem',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
              className="node-palette-button"
            >
              <GitMerge className="w-4 h-4" style={{ color: '#8b5cf6' }} />
              <span>Merge</span>
            </button>
            <button
              onClick={() => addNode('wait')}
              style={{
                padding: '0.75rem',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
            >
              <Timer className="w-4 h-4" style={{ color: '#6366f1' }} />
              <span>Wait</span>
            </button>
            <button
              onClick={() => addNode('variable-set')}
              style={{
                padding: '0.75rem',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
              className="node-palette-button"
            >
              <FileEdit className="w-4 h-4" style={{ color: '#f59e0b' }} />
              <span>Variable Set</span>
            </button>
            <button
              onClick={() => addNode('end')}
              style={{
                padding: '0.75rem',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
              className="node-palette-button"
            >
              <Flag className="w-4 h-4" style={{ color: '#ef4444' }} />
              <span>End</span>
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            background: 'transparent',
            boxSizing: 'border-box',
            width: '100%',
            minWidth: 0,
            overflow: 'hidden',
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
            <Background variant="grid" gap={24} size={1} color="hsl(var(--border))" />
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

          {/* Node Sidebar - n8n style - 3-column layout */}
          {selectedNode && (
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
