import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  GitBranch,
  Flag,
  Save,
  FileText,
  Loader2,
  Clipboard,
  LayoutGrid,
} from 'lucide-react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ControlButton,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { edgeTypes } from '../components/full-workflow/edges/edgeTypes.js';
import StartNode from '../components/nodes/StartNode';
import IfNode from '../components/nodes/IfNode';
import StepNode from '../components/nodes/StepNode';
import EndNode from '../components/nodes/EndNode';
import NodeSidebar from '../components/NodeSidebar';
import { compileWorkflowToPrompt } from '../utils/workflow-compiler.js';
import { fetchWithCSRF } from '../utils/csrf.utils.js';
import {
  setLastCallFlowId,
  clearLastCallFlowId,
  getLastFullWorkflowId,
} from '../utils/callFlowStorage.js';
import FloatingCanvasToolbar from '../components/workflow/FloatingCanvasToolbar.jsx';
import { computePyramidLayout } from '@/utils/layout/pyramidLayout';

const nodeTypes = {
  start: StartNode,
  if: IfNode,
  step: StepNode,
  end: EndNode,
};

function WorkflowEditorInner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [compiledPrompt, setCompiledPrompt] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [isAutoLayouting, setIsAutoLayouting] = useState(false);
  const reactFlowInstance = useReactFlow();

  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'smoothstep',
    }),
    []
  );

  const handleAutoLayout = useCallback(() => {
    if (!nodes.length) {
      return;
    }

    setIsAutoLayouting(true);
    const positions = computePyramidLayout(nodes, edges, {
      triggerTypes: ['start'],
      laneSpacing: 420,
      levelSpacing: 240,
      intraSpacing: 240,
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

  useEffect(() => {
    if (!isNew) {
      if (id) {
        setLastCallFlowId(id);
      }
      fetchWorkflow();
    } else {
      // Initialize with default start node
      setNodes([
        {
          id: 'start-1',
          type: 'start',
          position: { x: 250, y: 100 },
          data: { label: 'Start', action: '', next: '' },
        },
      ]);
      setEdges([]);
    }
  }, [id, isNew]);

  const fetchWorkflow = async () => {
    try {
      setLoading(true);
      const response = await fetchWithCSRF(`/api/workflows/${id}`);

      if (!response.ok) {
        if (response.status === 404) {
          // Workflow doesn't exist - clear stored ID and navigate to list
          clearLastCallFlowId();
          navigate('/workflows');
          return;
        }
        throw new Error('Failed to fetch workflow');
      }

      const data = await response.json();
      const workflow = data.data;

      setName(workflow.name);
      setDescription(workflow.description || '');

      // Ensure nodes have proper data structure when loading from DB
      // Support both old format (text) and new format (action, name, next)
      const loadedNodes = (workflow.graph_json.nodes || []).map(node => ({
        ...node,
        data: {
          ...node.data,
          // Migrate old 'text' to 'action' if needed
          action: node.data?.action || node.data?.text || '',
          // Ensure all properties exist
          name: node.data?.name || '',
          condition: node.data?.condition || '',
          next: node.data?.next || '',
          ifTrue: node.data?.ifTrue || { next: '' },
          ifFalse: node.data?.ifFalse || { next: '' },
          trueLabel: node.data?.trueLabel || 'True',
          falseLabel: node.data?.falseLabel || 'False',
        },
      }));

      setNodes(loadedNodes);
      setEdges(workflow.graph_json.edges || []);

      // Debug: Log loaded nodes to see their structure
      console.log('Loaded nodes from DB:', loadedNodes);
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
        navigate('/workflows');
      }
    } finally {
      setLoading(false);
    }
  };

  const onConnect = params => {
    // React Flow's addEdge creates edges with id, source, target, sourceHandle, targetHandle
    // We need to ensure the edge has all required fields
    const newEdge = {
      id: params.id || `edge-${Date.now()}-${params.source}-${params.target}`,
      source: params.source,
      target: params.target,
      ...(params.sourceHandle && { sourceHandle: params.sourceHandle }),
      ...(params.targetHandle && { targetHandle: params.targetHandle }),
    };
    setEdges(eds => [...eds, newEdge]);
  };

  const addNode = type => {
    const newNode = {
      id: `${type}-${Date.now()}`,
      type,
      position: {
        x: Math.random() * 400 + 100,
        y: Math.random() * 400 + 100,
      },
      data: {
        label:
          type === 'if'
            ? 'Condition'
            : type === 'step'
              ? 'Step'
              : type === 'start'
                ? 'Start'
                : 'End',
        // New format
        action:
          type === 'step' || type === 'start' || type === 'end'
            ? ''
            : undefined,
        name: type === 'step' ? '' : undefined,
        next: type === 'end' ? undefined : '',
        condition: type === 'if' ? '' : undefined,
        ifTrue: type === 'if' ? { next: '' } : undefined,
        ifFalse: type === 'if' ? { next: '' } : undefined,
        trueLabel: type === 'if' ? 'True' : undefined,
        falseLabel: type === 'if' ? 'False' : undefined,
      },
    };
    setNodes(nds => [...nds, newNode]);
  };

  const onNodeUpdate = (nodeId, newData) => {
    console.log('onNodeUpdate called:', { nodeId, newData });
    setNodes(nds =>
      nds.map(node => {
        if (node.id === nodeId) {
          // Merge new data with existing data, ensuring all properties are preserved
          const updatedData = { ...node.data, ...newData };
          console.log('Updating node:', {
            nodeId,
            oldData: node.data,
            newData,
            updatedData,
          });
          const updatedNode = { ...node, data: updatedData };
          // Don't update selectedNode here - let the sidebar manage its own state
          // Updating selectedNode causes the sidebar to reset, which is not what we want
          // The sidebar will sync with the node data when the node is clicked again
          return updatedNode;
        }
        return node;
      })
    );
  };

  const onNodeClick = (event, node) => {
    setSelectedNode(node);
  };

  const handleShowPrompt = () => {
    // Clean nodes and edges before compiling
    // IMPORTANT: Use the actual nodes state, not the React Flow mapped nodes
    const cleanNodes = nodes.map(({ id, type, position, data }) => {
      // Remove React Flow internal fields (onNodeUpdate, label)
      const { onNodeUpdate, label, ...cleanData } = data || {};
      // Ensure all data properties are preserved
      return { id, type, position, data: cleanData || {} };
    });

    const cleanEdges = edges.map((edge, index) => {
      const cleaned = {
        id: edge.id || `edge-${index}-${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
      };
      if (edge.sourceHandle != null) {
        cleaned.sourceHandle = edge.sourceHandle;
      }
      if (edge.targetHandle != null) {
        cleaned.targetHandle = edge.targetHandle;
      }
      return cleaned;
    });

    const graphJson = {
      nodes: cleanNodes,
      edges: cleanEdges,
    };

    const prompt = compileWorkflowToPrompt(graphJson);
    setCompiledPrompt(prompt);
    setShowPromptModal(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a workflow name');
      return;
    }

    if (nodes.length === 0) {
      alert('Please add at least one node');
      return;
    }

    try {
      setSaving(true);

      // Clean nodes and edges before saving - remove React Flow internal fields and callbacks
      const cleanNodes = nodes.map(({ id, type, position, data }) => {
        const { onNodeUpdate, label, ...cleanData } = data || {};

        // Remove screenshot from output if it exists (screenshots are too large for storage)
        if (cleanData.output?.screenshot) {
          cleanData.output = { ...cleanData.output };
          delete cleanData.output.screenshot;
        }

        // Ensure all data properties are preserved, even if they're empty strings
        return { id, type, position, data: cleanData || {} };
      });

      // Debug: Log nodes before saving to see what we're saving
      console.log('Saving nodes:', cleanNodes);
      console.log('Sample node data:', cleanNodes[0]?.data);

      // Clean edges - ensure id exists, React Flow may create edges without id
      // Remove React Flow internal fields (animated, selected, style, markerStart, markerEnd, etc.)
      const cleanEdges = edges.map((edge, index) => {
        const cleaned = {
          id: edge.id || `edge-${index}-${edge.source}-${edge.target}`,
          source: edge.source,
          target: edge.target,
        };
        // Only include sourceHandle/targetHandle if they exist and are not null
        if (edge.sourceHandle != null) {
          cleaned.sourceHandle = edge.sourceHandle;
        }
        if (edge.targetHandle != null) {
          cleaned.targetHandle = edge.targetHandle;
        }
        return cleaned;
      });

      const graphJson = {
        nodes: cleanNodes,
        edges: cleanEdges,
      };

      const url = isNew ? '/api/workflows' : `/api/workflows/${id}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetchWithCSRF(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          graph_json: graphJson,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Validation error details:', errorData);
        const errorMessage = errorData.errors
          ? `Validation failed: ${JSON.stringify(errorData.errors, null, 2)}`
          : errorData.error || 'Failed to save workflow';
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (isNew) {
        navigate(`/workflows/edit/${data.data.id}`);
      } else {
        alert('Workflow saved successfully!');
      }
    } catch (err) {
      alert('Failed to save workflow: ' + err.message);
      console.error('Error saving workflow:', err);
    } finally {
      setSaving(false);
    }
  };

  const editorContent = loading ? (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        fontSize: '18px',
        color: '#667eea',
        fontWeight: 600,
      }}
    >
      <div
        style={{
          padding: '24px 48px',
          background: 'hsl(var(--card))',
          color: 'hsl(var(--foreground))',
          borderRadius: '0.75rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          border: '1px solid hsl(var(--border))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading workflow...</span>
        </div>
      </div>
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left sidebar: node palette */}
        <div
          className="custom-scrollbar"
          style={{
            width: '250px',
            minWidth: '250px',
            background: 'hsl(var(--card))',
            borderRight: '1px solid hsl(var(--border))',
            padding: '1rem',
            overflowY: 'auto',
          }}
        >
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
            Nodes
          </h3>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
          >
            <button
              onClick={() => addNode('start')}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-border bg-card hover:bg-accent/50 text-sm font-medium"
            >
              <span style={{ color: '#10b981' }}>●</span> Start
            </button>
            <button
              onClick={() => addNode('step')}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-border bg-card hover:bg-accent/50 text-sm font-medium"
            >
              <Plus className="w-4 h-4" style={{ color: '#10b981' }} />
              Step
            </button>
            <button
              onClick={() => addNode('if')}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-border bg-card hover:bg-accent/50 text-sm font-medium"
            >
              <GitBranch className="w-4 h-4" style={{ color: '#f59e0b' }} />
              If
            </button>
            <button
              onClick={() => addNode('end')}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-border bg-card hover:bg-accent/50 text-sm font-medium"
            >
              <Flag className="w-4 h-4" style={{ color: '#ef4444' }} />
              End
            </button>
          </div>
        </div>

        {/* Center: canvas with floating toolbar */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            width: '100%',
            minWidth: 0,
          }}
        >
          <FloatingCanvasToolbar
            workflowName={name}
            onWorkflowNameChange={setName}
            activeTab="call"
            onSwitchTab={tab => {
              if (tab === 'full') {
                const lastId = getLastFullWorkflowId();
                if (lastId) navigate(`/fullWorkflows/edit/${lastId}`);
                else navigate('/fullWorkflows');
              }
            }}
            onSave={handleSave}
            onImport={() => {}}
            onExport={() => {}}
            isFullWorkflow={false}
            saving={saving}
            isNew={isNew}
          />
          <div
            style={{
              width: '100%',
              height: '100%',
              boxSizing: 'border-box',
              background: 'transparent',
              position: 'relative',
            }}
          >
            <ReactFlow
              nodes={nodes.map(node => {
                const nodeData = {
                  ...node.data,
                  onNodeUpdate: onNodeUpdate,
                };
                return {
                  ...node,
                  data: nodeData,
                };
              })}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              defaultEdgeOptions={defaultEdgeOptions}
            >
              <Background
                variant="dots"
                gap={30}
                size={1}
                color="hsl(var(--border))"
              />
              <Controls>
                <ControlButton
                  title="Auto layout"
                  onClick={handleAutoLayout}
                  disabled={isAutoLayouting}
                >
                  {isAutoLayouting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LayoutGrid className="w-4 h-4" />
                  )}
                </ControlButton>
              </Controls>
              <MiniMap
                nodeColor={node => {
                  switch (node.type) {
                    case 'start':
                      return '#10b981';
                    case 'step':
                      return '#667eea';
                    case 'if':
                      return '#f59e0b';
                    case 'end':
                      return '#ef4444';
                    default:
                      return '#94a3b8';
                  }
                }}
                nodeStrokeWidth={3}
                pannable={false}
                zoomable={false}
              />
            </ReactFlow>
            {isAutoLayouting && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm z-50 pointer-events-none">
                <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span>Re-arranging nodes…</span>
                </div>
              </div>
            )}
          </div>

          {/* Node Sidebar - inside canvas container */}
          {selectedNode && (
            <NodeSidebar
              selectedNode={selectedNode}
              onNodeUpdate={onNodeUpdate}
              nodes={nodes}
              edges={edges}
              onClose={() => setSelectedNode(null)}
            />
          )}
        </div>

        {/* Right sidebar: description, prompt (no Agents for Call Flow) */}
        <div
          className="custom-scrollbar"
          style={{
            width: '320px',
            minWidth: '320px',
            background: 'hsl(var(--card))',
            borderLeft: '1px solid hsl(var(--border))',
            padding: '1rem',
            overflowY: 'auto',
          }}
        >
          <label className="text-sm font-medium text-muted-foreground block mb-1">
            Description
          </label>
          <textarea
            placeholder="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full min-h-[80px] px-3 py-2 rounded-lg border border-input bg-background text-sm"
          />
          <button
            onClick={handleShowPrompt}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-accent/50 text-sm font-medium"
          >
            <FileText className="w-4 h-4" />
            Prompt
          </button>
        </div>
      </div>

      {/* Prompt Preview Modal */}
      {showPromptModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowPromptModal(false)}
        >
          <div
            style={{
              background: 'hsl(var(--card))',
              color: 'hsl(var(--foreground))',
              borderRadius: '0.75rem',
              padding: '2rem',
              maxWidth: '800px',
              maxHeight: '80vh',
              width: '90%',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
              border: '1px solid hsl(var(--border))',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
              }}
            >
              <h2 style={{ margin: 0, color: 'hsl(var(--foreground))' }}>
                Compiled Prompt
              </h2>
              <button
                onClick={() => setShowPromptModal(false)}
                style={{
                  background: 'hsl(var(--secondary))',
                  color: 'hsl(var(--secondary-foreground))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'hsl(var(--accent))';
                  e.currentTarget.style.borderColor = 'hsl(var(--primary))';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'hsl(var(--secondary))';
                  e.currentTarget.style.borderColor = 'hsl(var(--border))';
                }}
              >
                × Close
              </button>
            </div>
            <div
              style={{
                background: 'hsl(var(--muted))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
                padding: '1rem',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                fontSize: '0.875rem',
                lineHeight: '1.6',
                color: 'hsl(var(--foreground))',
                minHeight: '200px',
              }}
            >
              {compiledPrompt ||
                'No prompt generated. Please add nodes and connect them.'}
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(compiledPrompt);
                  alert('Prompt copied to clipboard!');
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  border: '1px solid hsl(var(--primary))',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                  transition: 'all 0.2s ease',
                }}
              >
                <Clipboard className="w-4 h-4 mr-1" />
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {editorContent}
    </div>
  );
}

export default function WorkflowEditor() {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner />
    </ReactFlowProvider>
  );
}
