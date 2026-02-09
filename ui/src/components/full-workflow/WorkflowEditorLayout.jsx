import { useState, useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ControlButton,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { edgeTypes } from './edges/edgeTypes.js';
import StartNode from './nodes/StartNode';
import EndNode from './nodes/EndNode';
import WebhookNode from './nodes/WebhookNode';
import HttpRequestNode from './nodes/HttpRequestNode';
import CallAgentNode from './nodes/CallAgentNode';
import CallTriggerNode from './nodes/CallTriggerNode';
import VariableSetNode from './nodes/VariableSetNode';
import IfNode from './nodes/IfNode';
import SwitchNode from './nodes/SwitchNode';
import WaitNode from './nodes/WaitNode';
import DatabaseQueryNode from './nodes/DatabaseQueryNode';
import GoogleSheetsNode from './nodes/GoogleSheetsNode';
import GoogleSheetsTriggerNode from './nodes/GoogleSheetsTriggerNode';
import WebhookTriggerNode from './nodes/WebhookTriggerNode';
import ScheduleTriggerNode from './nodes/ScheduleTriggerNode';
import KnowledgeBaseQueryNode from './nodes/KnowledgeBaseQueryNode';
import AiAgentNode from './nodes/AiAgentNode';
import EmailNode from './nodes/EmailNode';
import GmailNode from './nodes/GmailNode';
import MergeNode from './nodes/MergeNode';
import WebScraperNode from './nodes/WebScraperNode';
import HubspotNode from './nodes/HubspotNode';
import HubspotTriggerNode from './nodes/HubspotTriggerNode';
import NodeSidebarN8N from './NodeSidebarN8N';
import KnowledgeBaseManager from './KnowledgeBaseManager';
import VersionHistory from './VersionHistory';
import WorkflowImportModal from './WorkflowImportModal';
import WorkflowSettingsPanel from './WorkflowSettingsPanel.jsx';
import AgentChatPanel from './AgentChatPanel.jsx';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CommandPalette } from '@/components/ui/command-palette';
import { Spinner } from '@/components/ui/spinner';
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
  PhoneIncoming,
  Mail,
  GitBranch,
  GitMerge,
  Flag,
  Bot,
  Timer,
  LayoutGrid,
  Search,
  Building2,
  MessageCircle,
} from 'lucide-react';
import { computePyramidLayout } from '@/utils/layout/pyramidLayout';

const nodeTypes = {
  start: StartNode,
  end: EndNode,
  webhook: WebhookNode,
  'http-request': HttpRequestNode,
  'call-agent': CallAgentNode,
  'call-trigger': CallTriggerNode,
  'variable-set': VariableSetNode,
  if: IfNode,
  switch: SwitchNode,
  wait: WaitNode,
  'database-query': DatabaseQueryNode,
  'google-sheets': GoogleSheetsNode,
  'google-sheets-trigger': GoogleSheetsTriggerNode,
  'webhook-trigger': WebhookTriggerNode,
  'schedule-trigger': ScheduleTriggerNode,
  'knowledge-base-query': KnowledgeBaseQueryNode,
  'ai-agent': AiAgentNode,
  email: EmailNode,
  gmail: GmailNode,
  merge: MergeNode,
  'web-scraper': WebScraperNode,
  hubspot: HubspotNode,
  'hubspot-trigger': HubspotTriggerNode,
};

function WorkflowEditorLayoutInner({
  workflowId,
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
  executedEdges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeUpdate,
  onNodeClick,
  selectedNode,
  setSelectedNode,
  showKnowledgeBase,
  toggleKnowledgeBase,
  setShowKnowledgeBase,
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
  handleClearPerformance,
  agentsEnabled,
  goalDefinition,
  setAgentsEnabled,
  setGoalDefinition,
  handleSaveWorkflowSettings,
}) {
  const [isAutoLayouting, setIsAutoLayouting] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showWorkflowSettings, setShowWorkflowSettings] = useState(false);
  const [showAgentChat, setShowAgentChat] = useState(false);
  const reactFlowInstance = useReactFlow();

  const {
    statistics,
    statisticsLoading,
    statisticsError,
    showStatistics,
    setShowStatistics,
  } = statisticsState;

  const {
    performance,
    performanceLoading,
    performanceError,
    showPerformance,
    setShowPerformance,
    nodeHistory,
  } = performanceState;

  const {
    activeTriggers,
    showActiveTriggers,
    setShowActiveTriggers,
    triggersLoading,
    triggersError,
  } = triggersState;

  const {
    executionHistory,
    historyLoading,
    historyError,
    showExecutionHistory,
    setShowExecutionHistory,
    expandedExecution,
    setExpandedExecution,
    fetchExecutionHistory,
  } = historyState;

  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'smoothstep',
    }),
    []
  );

  const handleAutoLayout = useCallback(() => {
    if (!nodes?.length) {
      return;
    }

    setIsAutoLayouting(true);
    const positions = computePyramidLayout(nodes, edges, {
      triggerTypes: [
        'call-trigger',
        'webhook-trigger',
        'schedule-trigger',
        'google-sheets-trigger',
        'start',
      ],
      laneSpacing: 480,
      levelSpacing: 240,
      intraSpacing: 260,
    });

    if (!positions.size) {
      setIsAutoLayouting(false);
      return;
    }

    setNodes(prevNodes =>
      prevNodes.map(node => {
        const nextPosition = positions.get(node.id);
        if (!nextPosition) {
          return node;
        }
        return {
          ...node,
          position: nextPosition,
          dragging: false,
        };
      })
    );

    requestAnimationFrame(() => {
      reactFlowInstance.fitView({ padding: 0.2, duration: 500 });
      setIsAutoLayouting(false);
    });
  }, [nodes, edges, setNodes, reactFlowInstance]);

  // Calculate edge offsets for parallel edges and z-index
  const edgesWithOffset = useMemo(() => {
    // Group edges by source-target pair
    const edgeGroups = new Map();
    edges.forEach((edge, index) => {
      const key = `${edge.source}-${edge.target}`;
      if (!edgeGroups.has(key)) {
        edgeGroups.set(key, []);
      }
      edgeGroups.get(key).push({ edge, index });
    });

    // Calculate offset and z-index for each edge
    return edges.map((edge, index) => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const isFallbackEdge =
        sourceNode?.data?.errorConfig?.onError === 'fallback' &&
        sourceNode?.data?.errorConfig?.fallbackNodeId === edge.target;

      const triggerEdgeColors = {
        'webhook-trigger': '#3b82f6',
        'schedule-trigger': '#22c55e',
        'google-sheets-trigger': '#a855f7',
        'call-trigger': '#10b981',
        'hubspot-trigger': '#ff7a59',
        start: '#14b8a6',
      };

      const triggerColor = triggerEdgeColors[sourceNode?.type];
      const isExecuted = executedEdges.includes(edge.id);

      // Calculate offset for parallel edges
      const key = `${edge.source}-${edge.target}`;
      const group = edgeGroups.get(key) || [];
      const edgeInGroup = group.find(e => e.index === index);
      const groupIndex = group.indexOf(edgeInGroup);
      const totalInGroup = group.length;

      // Calculate offset: center edges around 0, spread them out
      // Offset in pixels (20px spacing between parallel edges)
      const offset =
        totalInGroup > 1 ? (groupIndex - (totalInGroup - 1) / 2) * 20 : 0;

      // Calculate z-index: newer edges on top, executed edges higher
      const zIndex = isExecuted ? 1000 + index : 100 + index;

      // Check if edge is connected to hovered node
      const isConnectedToHovered =
        hoveredNodeId &&
        (edge.source === hoveredNodeId || edge.target === hoveredNodeId);

      return {
        ...edge,
        type: isExecuted ? 'animated' : edge.type || 'default',
        data: {
          ...edge.data,
          isExecuted,
          offset, // Pass offset to edge component
        },
        style: {
          ...edge.style,
          stroke: isFallbackEdge
            ? isExecuted
              ? '#f59e0b'
              : '#ef4444'
            : isExecuted
              ? triggerColor || '#10b981'
              : edge.style?.stroke || '#b1b1b7',
          strokeWidth: isExecuted
            ? 3
            : isFallbackEdge
              ? 2.5
              : edge.style?.strokeWidth || 2,
          strokeDasharray: isFallbackEdge ? '5,5' : undefined,
          zIndex,
          opacity: hoveredNodeId && !isConnectedToHovered ? 0.3 : 1,
          transition: 'opacity 0.2s ease',
        },
      };
    });
  }, [edges, nodes, executedEdges, hoveredNodeId]);

  // Hover handlers for highlighting connected edges
  const handleNodeMouseEnter = useCallback((event, node) => {
    setHoveredNodeId(node.id);
  }, []);

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  const nodePaletteButtonStyle = {
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
  };

  return (
    <div style={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
      <div
        style={{
          background: 'hsl(var(--card))',
          padding: '1rem 2rem',
          borderBottom: '1px solid hsl(var(--border))',
          display: 'flex',
          alignItems: 'center',
          color: 'hsl(var(--foreground))',
          width: '100%',
          maxWidth: '100%',
          overflowX: 'hidden',
          boxSizing: 'border-box',
          gap: '1.5rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            flex: 1,
            minWidth: 0,
          }}
        >
          <button
            onClick={handleBack}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              background: 'hsl(var(--secondary))',
              color: 'hsl(var(--secondary-foreground))',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
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
        </div>

        <div
          style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            flex: 1,
            justifyContent: 'flex-end',
          }}
        >
          {!isNew && (
            <button
              onClick={() => setShowWorkflowSettings(true)}
              style={{
                padding: '0.5rem 1rem',
                background: agentsEnabled
                  ? 'hsl(var(--primary))'
                  : 'hsl(var(--secondary))',
                color: agentsEnabled
                  ? 'hsl(var(--primary-foreground))'
                  : 'hsl(var(--secondary-foreground))',
                border: `1px solid ${agentsEnabled ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
              title="Agents & Goal – Workflow-Einstellungen"
            >
              <Bot className="w-4 h-4" />
              Agents
            </button>
          )}
          <button
            onClick={toggleKnowledgeBase}
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
            >
              {exporting ? (
                <>
                  <Spinner variant="dots" size="sm" />
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
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
          <Button
            onClick={handleSave}
            animated
            loading={saving}
            disabled={saving}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            Save
          </Button>
          {!isNew && (
            <Button
              onClick={handleExecute}
              animated
              loading={executing}
              disabled={executing || saving}
              className="gap-2"
              style={{
                background: executing ? '#10b981' : undefined,
              }}
            >
              <Play className="w-4 h-4" />
              Execute
            </Button>
          )}
        </div>
      </div>

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
            <div
              style={{ fontSize: '0.875rem', color: 'hsl(var(--destructive))' }}
            >
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

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
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
          {!isNew && (
            <div
              style={{
                marginBottom: '1.25rem',
                padding: '1rem',
                background: agentsEnabled ? 'linear-gradient(135deg, hsl(var(--primary) / 0.08) 0%, hsl(var(--card)) 100%)' : 'hsl(var(--card))',
                border: `1px solid ${agentsEnabled ? 'hsl(var(--primary) / 0.4)' : 'hsl(var(--border))'}`,
                borderRadius: '10px',
                boxShadow: agentsEnabled ? '0 1px 3px hsl(var(--primary) / 0.1)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Bot className="w-4 h-4" style={{ color: agentsEnabled ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }} />
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: 0, color: 'hsl(var(--foreground))' }}>
                  Agents
                </h3>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: '6px',
                    background: agentsEnabled ? 'hsl(var(--primary) / 0.2)' : 'hsl(var(--muted))',
                    color: agentsEnabled ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                  }}
                >
                  {agentsEnabled ? 'Aktiv' : 'Aus'}
                </span>
              </div>
              {goalDefinition?.summary && (
                <p
                  style={{
                    fontSize: '0.75rem',
                    color: 'hsl(var(--muted-foreground))',
                    marginBottom: '0.75rem',
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {goalDefinition.summary}
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Button
                  variant={agentsEnabled ? 'default' : 'outline'}
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => setShowWorkflowSettings(true)}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Einstellungen & Goal
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => setShowAgentChat(true)}
                  title="Mit dem Workflow-Agenten chatten"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Mit Agent chatten
                </Button>
              </div>
            </div>
          )}
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
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <Spinner variant="dots" size="sm" />
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
                          Success Rate
                        </span>
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
                          <div
                            style={{
                              fontSize: '0.7rem',
                              color: 'hsl(var(--foreground))',
                            }}
                          >
                            {new Date(
                              statistics.lastExecution
                            ).toLocaleString()}
                          </div>
                        </div>
                      )}

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
                              <Clipboard className="w-4 h-4 mr-1" /> Execution
                              History ({executionHistory.length || 0})
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
                                              color:
                                                'hsl(var(--muted-foreground))',
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
                                            color:
                                              'hsl(var(--muted-foreground))',
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
                                                  color:
                                                    'hsl(var(--destructive))',
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
                                                  background:
                                                    'hsl(var(--destructive) / 0.1)',
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
                    color: performance?.workflow
                      ? '#10b981'
                      : 'hsl(var(--muted-foreground))',
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
                    color: performance?.workflow
                      ? '#10b981'
                      : 'hsl(var(--muted-foreground))',
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
                            <span
                              style={{ color: 'hsl(var(--muted-foreground))' }}
                            >
                              Avg Time
                            </span>
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
                            <span
                              style={{ color: 'hsl(var(--muted-foreground))' }}
                            >
                              Min Time
                            </span>
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
                            <span
                              style={{ color: 'hsl(var(--muted-foreground))' }}
                            >
                              Max Time
                            </span>
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
                            <span
                              style={{ color: 'hsl(var(--muted-foreground))' }}
                            >
                              Total Executions
                            </span>
                            <span style={{ fontWeight: 600, color: '#1f2937' }}>
                              {performance.workflow.totalExecutions}
                            </span>
                          </div>
                        </div>
                      )}

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
                                  background:
                                    idx === 0
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
                                              maxTime > 0
                                                ? (record.executionTime /
                                                    maxTime) *
                                                  100
                                                : 0;
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

                      {performance.workflow && (
                        <button
                          onClick={handleClearPerformance}
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

          {!isNew && (
            <VersionHistory
              workflowId={parseInt(workflowId, 10)}
              onRestore={restoredWorkflowJson => {
                setNodes(restoredWorkflowJson.nodes || []);
                setEdges(restoredWorkflowJson.edges || []);
                window.location.reload();
              }}
            />
          )}

          {!isNew && (
            <div
              style={{
                marginBottom: '1.5rem',
                padding: '0.75rem',
                background:
                  activeTriggers.length > 0
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
                  {activeTriggers
                    .filter(
                      trigger =>
                        trigger.triggerConfig?.type &&
                        trigger.triggerConfig.type !== 'start'
                    )
                    .map((trigger, index) => (
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
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                            }}
                          >
                            {trigger.triggerConfig?.type ===
                            'google-sheets-trigger' ? (
                              <>
                                <Sheet
                                  className="w-4 h-4"
                                  style={{ color: '#34d399' }}
                                />
                                <span>Google Sheets Trigger</span>
                              </>
                            ) : trigger.triggerConfig?.type ===
                              'schedule-trigger' ? (
                              <>
                                <Clock
                                  className="w-4 h-4"
                                  style={{ color: '#8b5cf6' }}
                                />
                                <span>Schedule Trigger</span>
                              </>
                            ) : trigger.triggerConfig?.type ===
                              'webhook-trigger' ? (
                              <>
                                <LinkIcon
                                  className="w-4 h-4"
                                  style={{ color: '#8b5cf6' }}
                                />
                                <span>Webhook Trigger</span>
                              </>
                            ) : trigger.triggerConfig?.type ===
                              'call-trigger' ? (
                              <>
                                <PhoneIncoming
                                  className="w-4 h-4"
                                  style={{ color: '#3b82f6' }}
                                />
                                <span>Call Trigger</span>
                              </>
                            ) : trigger.triggerConfig?.type ===
                              'hubspot-trigger' ? (
                              <>
                                <Zap
                                  className="w-4 h-4"
                                  style={{ color: '#ff7a59' }}
                                />
                                <span>HubSpot Trigger</span>
                              </>
                            ) : (
                              <>
                                <Rocket
                                  className="w-4 h-4"
                                  style={{ color: '#10b981' }}
                                />
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
                        {trigger.triggerConfig?.type === 'call-trigger' && (
                          <>
                            {trigger.triggerConfig.phoneNumber && (
                              <div
                                style={{
                                  color: 'hsl(var(--muted-foreground))',
                                  fontSize: '0.7rem',
                                  marginBottom: '0.25rem',
                                }}
                              >
                                Phone Number:{' '}
                                {trigger.triggerConfig.phoneNumber}
                              </div>
                            )}
                            <div
                              style={{
                                color: 'hsl(var(--muted-foreground))',
                                fontSize: '0.7rem',
                                marginBottom: '0.25rem',
                                wordBreak: 'break-all',
                              }}
                            >
                              Webhook URL:{' '}
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
                        {trigger.triggerConfig?.type === 'hubspot-trigger' && (
                          <>
                            {trigger.triggerConfig.eventTypes &&
                              trigger.triggerConfig.eventTypes.length > 0 && (
                                <div
                                  style={{
                                    color: 'hsl(var(--muted-foreground))',
                                    fontSize: '0.7rem',
                                    marginBottom: '0.25rem',
                                  }}
                                >
                                  Events:{' '}
                                  {trigger.triggerConfig.eventTypes.join(', ')}
                                </div>
                              )}
                            {trigger.triggerConfig.subscriptionIds &&
                              trigger.triggerConfig.subscriptionIds.length >
                                0 && (
                                <div
                                  style={{
                                    color: 'hsl(var(--muted-foreground))',
                                    fontSize: '0.7rem',
                                    marginBottom: '0.25rem',
                                  }}
                                >
                                  Subscriptions:{' '}
                                  {trigger.triggerConfig.subscriptionIds.length}{' '}
                                  active
                                </div>
                              )}
                            <div
                              style={{
                                color: 'hsl(var(--muted-foreground))',
                                fontSize: '0.7rem',
                                marginBottom: '0.25rem',
                                wordBreak: 'break-all',
                              }}
                            >
                              Webhook URL:{' '}
                              <code
                                style={{
                                  background: 'hsl(var(--muted))',
                                  padding: '0.125rem 0.25rem',
                                  borderRadius: '4px',
                                  fontSize: '0.65rem',
                                }}
                              >
                                {trigger.triggerConfig.webhookUrl}
                              </code>
                            </div>
                          </>
                        )}
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
                                Sheet:{' '}
                                {trigger.triggerConfig.sheetName || 'N/A'}
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
                            Next Run:{' '}
                            {new Date(trigger.nextRun).toLocaleString()}
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
              style={nodePaletteButtonStyle}
            >
              <Rocket className="w-4 h-4" style={{ color: '#10b981' }} />
              <span>Manual Trigger</span>
            </button>
            <button
              onClick={() => addNode('google-sheets-trigger')}
              style={nodePaletteButtonStyle}
            >
              <Sheet className="w-4 h-4" style={{ color: '#34d399' }} />
              <span>Google Sheets Trigger</span>
            </button>
            <button
              onClick={() => addNode('webhook-trigger')}
              style={nodePaletteButtonStyle}
            >
              <LinkIcon className="w-4 h-4" style={{ color: '#8b5cf6' }} />
              <span>Webhook Trigger</span>
            </button>
            <button
              onClick={() => addNode('schedule-trigger')}
              style={nodePaletteButtonStyle}
            >
              <Clock className="w-4 h-4" style={{ color: '#8b5cf6' }} />
              <span>Schedule Trigger</span>
            </button>
            <button
              onClick={() => addNode('call-trigger')}
              style={nodePaletteButtonStyle}
            >
              <PhoneIncoming className="w-4 h-4" style={{ color: '#10b981' }} />
              <span>Call Trigger</span>
            </button>
            <button
              onClick={() => addNode('hubspot-trigger')}
              style={nodePaletteButtonStyle}
            >
              <Zap className="w-4 h-4" style={{ color: '#ff7a59' }} />
              <span>HubSpot Trigger</span>
            </button>
          </div>

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
              style={nodePaletteButtonStyle}
            >
              <Globe className="w-4 h-4" style={{ color: '#3b82f6' }} />
              <span>HTTP Request</span>
            </button>
            <button
              onClick={() => addNode('call-agent')}
              style={nodePaletteButtonStyle}
            >
              <Phone className="w-4 h-4" style={{ color: '#10b981' }} />
              <span>Call Agent</span>
            </button>
            <button
              onClick={() => addNode('database-query')}
              style={nodePaletteButtonStyle}
            >
              <Database className="w-4 h-4" style={{ color: '#06b6d4' }} />
              <span>Database Query</span>
            </button>
            <button
              onClick={() => addNode('google-sheets')}
              style={nodePaletteButtonStyle}
            >
              <Sheet className="w-4 h-4" style={{ color: '#34d399' }} />
              <span>Google Sheets</span>
            </button>
            <button
              onClick={() => addNode('knowledge-base-query')}
              style={nodePaletteButtonStyle}
            >
              <Database className="w-4 h-4" style={{ color: '#a78bfa' }} />
              <span>Knowledge Base</span>
            </button>
            <button
              onClick={() => addNode('ai-agent')}
              style={nodePaletteButtonStyle}
            >
              <Bot className="w-4 h-4" style={{ color: '#3b82f6' }} />
              <span>AI Agent</span>
            </button>
            <button
              onClick={() => addNode('email')}
              style={nodePaletteButtonStyle}
            >
              <Mail className="w-4 h-4" style={{ color: '#8b5cf6' }} />
              <span>Email</span>
            </button>
            <button
              onClick={() => addNode('gmail')}
              style={nodePaletteButtonStyle}
            >
              <Mail className="w-4 h-4" style={{ color: '#ea4335' }} />
              <span>Gmail</span>
            </button>
            <button
              onClick={() => addNode('web-scraper')}
              style={nodePaletteButtonStyle}
            >
              <Search className="w-4 h-4" style={{ color: '#3b82f6' }} />
              <span>Web Scraper</span>
            </button>
            <button
              onClick={() => addNode('hubspot')}
              style={nodePaletteButtonStyle}
            >
              <Building2 className="w-4 h-4" style={{ color: '#ff7a59' }} />
              <span>HubSpot CRM</span>
            </button>
          </div>

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
              style={nodePaletteButtonStyle}
            >
              <GitBranch className="w-4 h-4" style={{ color: '#f59e0b' }} />
              <span>If (Condition)</span>
            </button>
            <button
              onClick={() => addNode('switch')}
              style={nodePaletteButtonStyle}
            >
              <GitBranch className="w-4 h-4" style={{ color: '#8b5cf6' }} />
              <span>Switch/Case</span>
            </button>
            <button
              onClick={() => addNode('merge')}
              style={nodePaletteButtonStyle}
            >
              <GitMerge className="w-4 h-4" style={{ color: '#8b5cf6' }} />
              <span>Merge</span>
            </button>
            <button
              onClick={() => addNode('wait')}
              style={nodePaletteButtonStyle}
            >
              <Timer className="w-4 h-4" style={{ color: '#6366f1' }} />
              <span>Wait</span>
            </button>
            <button
              onClick={() => addNode('variable-set')}
              style={nodePaletteButtonStyle}
            >
              <FileEdit className="w-4 h-4" style={{ color: '#f59e0b' }} />
              <span>Variable Set</span>
            </button>
            <button
              onClick={() => addNode('end')}
              style={nodePaletteButtonStyle}
            >
              <Flag className="w-4 h-4" style={{ color: '#ef4444' }} />
              <span>End</span>
            </button>
          </div>
        </div>

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
            edges={edgesWithOffset}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onNodeMouseEnter={handleNodeMouseEnter}
            onNodeMouseLeave={handleNodeMouseLeave}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            defaultEdgeOptions={defaultEdgeOptions}
            onlyRenderVisibleElements={true}
            panOnScroll={true}
            zoomOnScroll={true}
            zoomOnPinch={true}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant="cross"
              gap={20}
              size={5}
              color="hsl(var(--border))"
            />
            <Controls>
              <ControlButton
                title="Auto layout"
                onClick={handleAutoLayout}
                disabled={isAutoLayouting}
              >
                {isAutoLayouting ? (
                  <Spinner variant="ring" size="sm" />
                ) : (
                  <LayoutGrid className="w-4 h-4" />
                )}
              </ControlButton>
            </Controls>
            <MiniMap
              nodeColor={node => {
                const colors = {
                  start: '#10b981',
                  end: '#ef4444',
                  webhook: '#8b5cf6',
                  'http-request': '#3b82f6',
                  'call-agent': '#10b981',
                  'call-trigger': '#10b981',
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
          {isAutoLayouting && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm z-50 pointer-events-none">
              <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <Spinner variant="chase" size="lg" />
                <span>Re-arranging nodes…</span>
              </div>
            </div>
          )}

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
              workflowId={workflowId ? parseInt(workflowId, 10) : null}
            />
          )}

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

          {!isNew && (
            <WorkflowSettingsPanel
              open={showWorkflowSettings}
              onClose={() => setShowWorkflowSettings(false)}
              workflowId={workflowId}
              agentsEnabled={agentsEnabled}
              goalDefinition={goalDefinition}
              onSaveSettings={handleSaveWorkflowSettings}
              onOpenAgentChat={() => {
                setShowWorkflowSettings(false);
                setShowAgentChat(true);
              }}
            />
          )}

          {showAgentChat && !isNew && workflowId && (
            <AgentChatPanel
              workflowId={workflowId}
              workflowName={name}
              agentsEnabled={agentsEnabled}
              onClose={() => setShowAgentChat(false)}
            />
          )}
        </div>
      </div>

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
            flexDirection: 'column',
            gap: '0.75rem',
            minWidth: '300px',
            maxWidth: '600px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
          </div>
          {/* Progress Bar for running executions */}
          {executing && edges.length > 0 && executedEdges && (
            <div style={{ width: '100%' }}>
              <Progress
                value={executedEdges.length}
                max={edges.length}
                className="h-1.5 bg-white/20"
                indicatorClassName="bg-white/80"
                showShimmer={true}
              />
              <div
                style={{
                  fontSize: '0.75rem',
                  opacity: 0.8,
                  marginTop: '0.25rem',
                  textAlign: 'right',
                }}
              >
                {executedEdges.length} / {edges.length} steps
              </div>
            </div>
          )}
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

      <WorkflowImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={handleImportSuccess}
      />

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onAction={action => {
          switch (action) {
            case 'save':
              handleSave();
              break;
            case 'execute':
              if (!isNew) handleExecute();
              break;
            case 'export':
              handleExport();
              break;
            case 'import':
              setShowImportModal(true);
              break;
            case 'knowledge-base':
              setShowKnowledgeBase(!showKnowledgeBase);
              break;
            case 'statistics':
              setShowStatistics(!showStatistics);
              break;
            case 'settings':
              if (!isNew) setShowWorkflowSettings(true);
              break;
            case 'history':
              // Open version history modal if available
              break;
            default:
              break;
          }
        }}
      />
    </div>
  );
}

export default function WorkflowEditorLayout(props) {
  return (
    <ReactFlowProvider>
      <WorkflowEditorLayoutInner {...props} />
    </ReactFlowProvider>
  );
}
