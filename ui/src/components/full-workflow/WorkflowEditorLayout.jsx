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
import FloatingCanvasToolbar from '../workflow/FloatingCanvasToolbar.jsx';
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
  onSwitchToCallFlow,
}) {
  const [isAutoLayouting, setIsAutoLayouting] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showWorkflowSettings, setShowWorkflowSettings] = useState(false);
  const [showAgentChat, setShowAgentChat] = useState(false);
  const [agentRightTab, setAgentRightTab] = useState('settings');
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
    <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column' }}>
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
          className="custom-scrollbar"
          style={{
            width: '250px',
            background: 'hsl(var(--card))',
            borderRight: '1px solid hsl(var(--border))',
            padding: '1rem',
            overflowY: 'auto',
            color: 'hsl(var(--foreground))',
          }}
        >

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
          <FloatingCanvasToolbar
            workflowName={name}
            onWorkflowNameChange={setName}
            activeTab="full"
            onSwitchTab={tab => tab === 'call' && onSwitchToCallFlow?.()}
            onSave={handleSave}
            onImport={() => setShowImportModal(true)}
            onExport={handleExport}
            onKnowledgeBase={toggleKnowledgeBase}
            onExecute={handleExecute}
            isFullWorkflow={true}
            saving={saving}
            exporting={exporting}
            executing={executing}
            showKnowledgeBase={showKnowledgeBase}
            agentsEnabled={agentsEnabled}
            isNew={isNew}
          />
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
              variant="dots"
              gap={30}
              size={1}
              color="hsl(var(--border))"
            />
            <Controls
              position="bottom-right"
              className="!bg-card/80 dark:!bg-card/80 backdrop-blur-md border border-border rounded-lg shadow"
            >
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
              position="bottom-left"
              className="!bg-card/80 dark:!bg-card/80 backdrop-blur-md border border-border rounded-lg"
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
                setAgentRightTab('chat');
                setShowAgentChat(true);
              }}
            />
          )}

        </div>

        {/* Right sidebar: Agents (Settings | Chat), Statistics, Performance, Triggers, History */}
        {!isNew && (
          <div
            style={{
              width: '320px',
              minWidth: '320px',
              background: 'hsl(var(--card))',
              borderLeft: '1px solid hsl(var(--border))',
              padding: '1rem',
              overflowY: 'auto',
              color: 'hsl(var(--foreground))',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* Agents: Settings & Goals | Chat with Agent */}
            <div
              style={{
                padding: '0.75rem',
                background: 'hsl(var(--muted))',
                borderRadius: '8px',
                border: '1px solid hsl(var(--border))',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: '0.25rem',
                  marginBottom: '0.75rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => setAgentRightTab('settings')}
                  style={{
                    flex: 1,
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    border: 'none',
                    borderRadius: '6px',
                    background: agentRightTab === 'settings' ? 'hsl(var(--primary))' : 'transparent',
                    color: agentRightTab === 'settings' ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                    cursor: 'pointer',
                  }}
                >
                  Settings & Goals
                </button>
                <button
                  type="button"
                  onClick={() => setAgentRightTab('chat')}
                  style={{
                    flex: 1,
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    border: 'none',
                    borderRadius: '6px',
                    background: agentRightTab === 'chat' ? 'hsl(var(--primary))' : 'transparent',
                    color: agentRightTab === 'chat' ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                    cursor: 'pointer',
                  }}
                >
                  Chat with Agent
                </button>
              </div>
              {agentRightTab === 'settings' && (
                <Button
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => setShowWorkflowSettings(true)}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Open Settings & Goal
                </Button>
              )}
              {agentRightTab === 'chat' && workflowId && (
                <div className="flex flex-col min-h-0 flex-1" style={{ minHeight: '280px' }}>
                  <AgentChatPanel
                    workflowId={workflowId}
                    workflowName={name}
                    agentsEnabled={agentsEnabled}
                    onClose={() => setAgentRightTab('settings')}
                    embedded
                  />
                </div>
              )}
            </div>

            {/* Statistics */}
            <div
              style={{
                padding: '0.75rem',
                background: 'hsl(var(--card))',
                borderRadius: '8px',
                border: `1px solid ${statistics?.totalExecutions > 0 ? '#10b981' : 'hsl(var(--border))'}`,
              }}
            >
              <button
                type="button"
                onClick={() => setShowStatistics(!showStatistics)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'none',
                  border: 'none',
                  color: 'hsl(var(--foreground))',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                <span className="flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4" />
                  Statistics
                </span>
                {showStatistics ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {showStatistics && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                  {statisticsError && (
                    <div style={{ padding: '0.5rem', background: 'hsl(var(--destructive) / 0.1)', border: '1px solid hsl(var(--destructive))', borderRadius: '6px', marginBottom: '0.5rem', color: 'hsl(var(--destructive))' }}>
                      Error: {statisticsError}
                    </div>
                  )}
                  {statisticsLoading && (
                    <div style={{ padding: '0.75rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
                      <Spinner variant="dots" size="sm" /> Loading…
                    </div>
                  )}
                  {!statisticsLoading && !statisticsError && statistics && (
                    <div style={{ padding: '0.75rem', background: 'hsl(var(--muted))', borderRadius: '6px', border: '1px solid hsl(var(--border))', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid hsl(var(--border))' }}>
                        <span style={{ color: 'hsl(var(--muted-foreground))' }}>Total Executions</span>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{statistics.totalExecutions ?? 0}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid hsl(var(--border))' }}>
                        <span style={{ color: 'hsl(var(--muted-foreground))' }}>Success Rate</span>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: parseFloat(statistics.successRate || 0) >= 90 ? '#10b981' : parseFloat(statistics.successRate || 0) >= 70 ? '#f59e0b' : '#ef4444' }}>
                          {parseFloat(statistics.successRate || 0).toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.65rem', marginBottom: '0.25rem' }}>Successful</div>
                          <div style={{ fontWeight: 600, color: '#10b981', fontSize: '0.875rem' }}>{statistics.successfulExecutions ?? 0}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.65rem', marginBottom: '0.25rem' }}>Failed</div>
                          <div style={{ fontWeight: 600, color: '#ef4444', fontSize: '0.875rem' }}>{statistics.failedExecutions ?? 0}</div>
                        </div>
                      </div>
                      {statistics.lastExecution && (
                        <div style={{ paddingBottom: '0.5rem', borderBottom: '1px solid hsl(var(--border))' }}>
                          <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.65rem', marginBottom: '0.25rem' }}>Last Execution</div>
                          <div style={{ fontSize: '0.7rem' }}>{new Date(statistics.lastExecution).toLocaleString()}</div>
                        </div>
                      )}
                      {(statistics.lastSuccess || statistics.lastFailure) && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {statistics.lastSuccess && (
                            <div style={{ flex: 1 }}>
                              <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.65rem', marginBottom: '0.25rem' }}>Last Success</div>
                              <div style={{ fontSize: '0.7rem', color: '#10b981' }}>{new Date(statistics.lastSuccess).toLocaleString()}</div>
                            </div>
                          )}
                          {statistics.lastFailure && (
                            <div style={{ flex: 1 }}>
                              <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.65rem', marginBottom: '0.25rem' }}>Last Failure</div>
                              <div style={{ fontSize: '0.7rem', color: '#ef4444' }}>{new Date(statistics.lastFailure).toLocaleString()}</div>
                            </div>
                          )}
                        </div>
                      )}
                      {statistics.errors && statistics.errors.length > 0 && (
                        <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid hsl(var(--border))' }}>
                          <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.65rem', marginBottom: '0.25rem' }}>Recent Errors ({statistics.errors.length})</div>
                          <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '0.65rem', color: 'hsl(var(--destructive))' }}>
                            {statistics.errors.slice(-3).map((err, idx) => (
                              <div key={idx} style={{ marginBottom: '0.25rem' }}>{new Date(err.timestamp).toLocaleString()}: {err.error}</div>
                            ))}
                          </div>
                        </div>
                      )}
                      {statistics.totalExecutions > 0 && (
                        <button
                          type="button"
                          onClick={() => { setShowExecutionHistory(!showExecutionHistory); if (!showExecutionHistory && (!Array.isArray(executionHistory) || executionHistory.length === 0)) fetchExecutionHistory(); }}
                          style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem', background: 'transparent', border: '1px solid hsl(var(--border))', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}
                        >
                          <span><Clipboard className="w-4 h-4 mr-1 inline" /> Execution History ({Array.isArray(executionHistory) ? executionHistory.length : 0})</span>
                          <span>{showExecutionHistory ? '▼' : '▶'}</span>
                        </button>
                      )}
                    </div>
                  )}
                  {!statisticsLoading && !statisticsError && !statistics && (
                    <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}>
                      No statistics yet. Execute the workflow to see statistics.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Performance */}
            <div
              style={{
                padding: '0.75rem',
                background: 'hsl(var(--card))',
                borderRadius: '8px',
                border: `1px solid ${performance?.workflow ? '#10b981' : 'hsl(var(--border))'}`,
              }}
            >
              <button
                type="button"
                onClick={() => setShowPerformance(!showPerformance)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'none',
                  border: 'none',
                  color: 'hsl(var(--foreground))',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                <span className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4" />
                  Performance
                </span>
                {showPerformance ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {showPerformance && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                  {performanceLoading && (
                    <div style={{ padding: '0.75rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}><Spinner variant="dots" size="sm" /> Loading…</div>
                  )}
                  {performanceError && (
                    <div style={{ padding: '0.5rem', background: 'hsl(var(--destructive) / 0.1)', border: '1px solid hsl(var(--destructive))', borderRadius: '6px', color: 'hsl(var(--destructive))', marginBottom: '0.5rem' }}>{performanceError}</div>
                  )}
                  {!performanceLoading && !performanceError && performance?.workflow && (
                    <div style={{ padding: '0.75rem', background: 'hsl(var(--muted))', borderRadius: '6px', border: '1px solid hsl(var(--border))' }}>
                      <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Workflow performance</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ color: 'hsl(var(--muted-foreground))' }}>Avg. runtime</span>
                        <span>{performance.workflow.avgExecutionTime != null ? `${Math.round(performance.workflow.avgExecutionTime)} ms` : '—'}</span>
                      </div>
                      {performance.workflow.minExecutionTime != null && performance.workflow.minExecutionTime > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ color: 'hsl(var(--muted-foreground))' }}>Min runtime</span>
                          <span>{Math.round(performance.workflow.minExecutionTime)} ms</span>
                        </div>
                      )}
                      {performance.workflow.maxExecutionTime != null && performance.workflow.maxExecutionTime > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ color: 'hsl(var(--muted-foreground))' }}>Max runtime</span>
                          <span>{Math.round(performance.workflow.maxExecutionTime)} ms</span>
                        </div>
                      )}
                      {performance.workflow.totalExecutions != null && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ color: 'hsl(var(--muted-foreground))' }}>Executions</span>
                          <span>{performance.workflow.totalExecutions}</span>
                        </div>
                      )}
                      {performance.nodes && performance.nodes.length > 0 && (
                        <>
                          <div style={{ fontWeight: 600, marginTop: '0.5rem', marginBottom: '0.25rem' }}>Nodes (top bottlenecks)</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '120px', overflowY: 'auto' }}>
                            {performance.nodes.slice(0, 5).map((n, i) => (
                              <div key={n.nodeId || i} style={{ fontSize: '0.7rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                                <span className="truncate" style={{ maxWidth: '50%' }}>{n.nodeId || n.nodeType || 'Node'}</span>
                                <span style={{ whiteSpace: 'nowrap' }}>
                                  {n.avg != null ? `${Math.round(n.avg)} ms` : '—'}
                                  {n.count != null && n.count > 0 ? ` (${n.count})` : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                      <Button variant="outline" size="sm" className="w-full mt-2 gap-1.5" onClick={handleClearPerformance}>
                        Clear performance data
                      </Button>
                    </div>
                  )}
                  {!performanceLoading && !performanceError && !performance?.workflow && (
                    <div style={{ padding: '0.75rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}>No performance data yet.</div>
                  )}
                </div>
              )}
            </div>

            {/* Active Triggers */}
            <div
              style={{
                padding: '0.75rem',
                background: 'hsl(var(--card))',
                borderRadius: '8px',
                border: '1px solid hsl(var(--border))',
              }}
            >
              <button
                type="button"
                onClick={() => setShowActiveTriggers(!showActiveTriggers)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'none',
                  border: 'none',
                  color: 'hsl(var(--foreground))',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                <span className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4" />
                  Active Triggers ({Array.isArray(activeTriggers) ? activeTriggers.length : 0})
                </span>
                {showActiveTriggers ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {showActiveTriggers && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                  {triggersLoading && (
                    <div style={{ padding: '0.75rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}><Spinner variant="dots" size="sm" /> Loading…</div>
                  )}
                  {triggersError && (
                    <div style={{ padding: '0.5rem', background: 'hsl(var(--destructive) / 0.1)', border: '1px solid hsl(var(--destructive))', borderRadius: '6px', color: 'hsl(var(--destructive))', marginBottom: '0.5rem' }}>{triggersError}</div>
                  )}
                  {!triggersLoading && !triggersError && activeTriggers?.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto' }}>
                      {activeTriggers.map((trigger, i) => (
                        <div key={i} style={{ padding: '0.75rem', background: 'hsl(var(--muted))', borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '0.75rem' }}>
                          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{trigger.triggerType || trigger.type || 'Trigger'}</div>
                          {trigger.triggerConfig?.triggerOn && <div style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '0.15rem' }}>Trigger On: {trigger.triggerConfig.triggerOn}</div>}
                          {trigger.triggerConfig?.cronExpression && <div style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '0.15rem' }}>Cron: {trigger.triggerConfig.cronExpression}</div>}
                          {trigger.triggerConfig?.preset && <div style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '0.15rem' }}>Preset: {trigger.triggerConfig.preset}</div>}
                          {trigger.nextRun && <div style={{ color: 'hsl(var(--muted-foreground))' }}>Next Run: {new Date(trigger.nextRun).toLocaleString()}</div>}
                          {trigger.id && <div style={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.25rem' }}>ID: {trigger.id}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  {!triggersLoading && !triggersError && (!activeTriggers || activeTriggers.length === 0) && (
                    <div style={{ padding: '0.75rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}>No active triggers.</div>
                  )}
                </div>
              )}
            </div>

            {/* Version History: Button öffnet Modal mit allen Versionen (wie zuvor) */}
            <div
              style={{
                padding: '0.75rem',
                background: 'hsl(var(--card))',
                borderRadius: '8px',
                border: '1px solid hsl(var(--border))',
              }}
            >
              <VersionHistory
                workflowId={workflowId}
                onRestore={restored => {
                  if (restored?.nodes) setNodes(restored.nodes);
                  if (restored?.edges) setEdges(restored.edges);
                }}
              />
            </div>

            {/* Execution History: klappbare Liste der Runs (Success/Failed) */}
            <div
              style={{
                padding: '0.75rem',
                background: 'hsl(var(--card))',
                borderRadius: '8px',
                border: '1px solid hsl(var(--border))',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowExecutionHistory(!showExecutionHistory);
                  if (!showExecutionHistory && (!Array.isArray(executionHistory) || executionHistory.length === 0)) fetchExecutionHistory();
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'none',
                  border: 'none',
                  color: 'hsl(var(--foreground))',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  Execution History ({Array.isArray(executionHistory) ? executionHistory.length : 0})
                </span>
                {showExecutionHistory ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {showExecutionHistory && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                  {historyError && (
                    <div style={{ padding: '0.5rem', background: 'hsl(var(--destructive) / 0.1)', border: '1px solid hsl(var(--destructive))', borderRadius: '6px', color: 'hsl(var(--destructive))', marginBottom: '0.5rem' }}>{historyError}</div>
                  )}
                  {historyLoading && (
                    <div style={{ padding: '0.75rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>Loading execution history…</div>
                  )}
                  {!historyLoading && !historyError && executionHistory?.length === 0 && (
                    <div style={{ padding: '0.75rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}>No execution history yet.</div>
                  )}
                  {!historyLoading && !historyError && Array.isArray(executionHistory) && executionHistory.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
                      {executionHistory.map((execution, index) => {
                        const isFailed = !execution.success;
                        const hasError = execution.error || execution.errorStack;
                        return (
                          <div
                            key={index}
                            style={{
                              padding: '0.75rem',
                              background: execution.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              border: `1px solid ${execution.success ? '#10b981' : '#ef4444'}`,
                              borderRadius: '6px',
                              cursor: isFailed ? 'pointer' : 'default',
                              userSelect: 'none',
                            }}
                            onClick={(e) => { e.stopPropagation(); if (isFailed) setExpandedExecution(expandedExecution === index ? null : index); }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isFailed && hasError ? '0.5rem' : 0 }}>
                              <span>{execution.success ? '✓ Success' : '✗ Failed'}</span>
                              <span style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))' }}>
                                {execution.finishedAt ? new Date(execution.finishedAt).toLocaleString() : execution.timestamp ? new Date(execution.timestamp).toLocaleString() : '—'}
                              </span>
                            </div>
                            {isFailed && hasError && expandedExecution === index && (
                              <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid hsl(var(--border))' }}>
                                <div style={{ fontSize: '0.7rem', color: 'hsl(var(--destructive))', marginBottom: '0.25rem', wordBreak: 'break-word' }}>{execution.error}</div>
                                {execution.errorStack && (
                                  <details style={{ marginTop: '0.5rem' }}>
                                    <summary style={{ cursor: 'pointer', color: 'hsl(var(--destructive))', fontSize: '0.65rem', fontWeight: 600 }}>Stack Trace</summary>
                                    <pre style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'hsl(var(--destructive) / 0.1)', borderRadius: '4px', fontSize: '0.6rem', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '200px', overflowY: 'auto' }}>{execution.errorStack}</pre>
                                  </details>
                                )}
                              </div>
                            )}
                            {isFailed && !hasError && (
                              <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'hsl(var(--muted))', border: '1px solid #f59e0b', borderRadius: '6px', fontSize: '0.7rem', color: '#92400e' }}>No error details available</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
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
