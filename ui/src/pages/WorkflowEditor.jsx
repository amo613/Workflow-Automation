import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  GitBranch,
  Flag,
  Save,
  FileText,
  ArrowLeft,
  Sparkles,
  Loader2,
  Clipboard,
} from 'lucide-react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import StartNode from '../components/nodes/StartNode';
import IfNode from '../components/nodes/IfNode';
import StepNode from '../components/nodes/StepNode';
import EndNode from '../components/nodes/EndNode';
import NodeSidebar from '../components/NodeSidebar';
import { compileWorkflowToPrompt } from '../utils/workflow-compiler.js';
import { fetchWithCSRF } from '../utils/csrf.utils.js';

const nodeTypes = {
  start: StartNode,
  if: IfNode,
  step: StepNode,
  end: EndNode,
};

function WorkflowEditor() {
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

  useEffect(() => {
    if (!isNew) {
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
  }, [id]);

  const fetchWorkflow = async () => {
    try {
      setLoading(true);
      const response = await fetchWithCSRF(`/api/workflows/${id}`);

      if (!response.ok) {
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
      alert('Failed to load workflow: ' + err.message);
      console.error('Error fetching workflow:', err);
      navigate('/');
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
        navigate(`/edit/${data.data.id}`);
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
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div
        id="workflow-header"
        style={{
          padding: '0.75rem 1.5rem',
          background: 'hsl(var(--card))',
          borderBottom: '1px solid hsl(var(--border))',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          width: '100%',
          maxWidth: '100%',
          overflowX: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
            flexWrap: 'nowrap',
          }}
        >
          <input
            type="text"
            placeholder="Workflow Name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="bubble-input"
            style={{
              flex: '0 1 200px',
              fontSize: '0.95rem',
              fontWeight: 600,
              padding: '0.5rem 0.75rem',
            }}
          />
          <input
            type="text"
            placeholder="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="bubble-input"
            style={{
              flex: '0 1 180px',
              fontSize: '0.875rem',
              padding: '0.5rem 0.75rem',
            }}
          />
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              marginLeft: 'auto',
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => addNode('step')}
              className="bubble-btn"
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.8rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              }}
            >
              <Plus className="w-3 h-3 mr-1" />
              Step
            </button>
            <button
              onClick={() => addNode('if')}
              className="bubble-btn"
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.8rem',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              }}
            >
              <GitBranch className="w-3 h-3 mr-1" />
              If
            </button>
            <button
              onClick={() => addNode('end')}
              className="bubble-btn"
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.8rem',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              }}
            >
              <Flag className="w-3 h-3 mr-1" />
              End
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexShrink: 0,
            }}
          >
            <button
              onClick={handleSave}
              disabled={saving}
              className="bubble-btn"
              style={{
                padding: '0.4rem 0.9rem',
                fontSize: '0.8rem',
                background: saving
                  ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                opacity: saving ? 0.6 : 1,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3 h-3 mr-1" />
                  Save
                </>
              )}
            </button>
            <button
              onClick={handleShowPrompt}
              className="bubble-btn"
              style={{
                padding: '0.4rem 0.9rem',
                fontSize: '0.8rem',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              }}
            >
              <FileText className="w-3 h-3 mr-1" />
              Prompt
            </button>
            <button
              onClick={() => navigate('/workflows')}
              className="bubble-btn"
              style={{
                padding: '0.4rem 0.9rem',
                fontSize: '0.8rem',
                background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
              }}
            >
              <ArrowLeft className="w-3 h-3 mr-1" />
              Back
            </button>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', width: '100%', minWidth: 0 }}>
        <div
          style={{
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            background: 'transparent',
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
            fitView
          >
            <Background variant="grid" gap={24} size={1} color="hsl(var(--border))" />
            <Controls />
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
              <h2 style={{ margin: 0, color: 'hsl(var(--foreground))' }}>Compiled Prompt</h2>
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
}

export default WorkflowEditor;
