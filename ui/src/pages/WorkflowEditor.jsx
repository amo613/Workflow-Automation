import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { compileWorkflowToPrompt } from '../utils/workflow-compiler.js';

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
          data: { label: 'Start', text: '' },
        },
      ]);
      setEdges([]);
    }
  }, [id]);

  const fetchWorkflow = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/workflows/${id}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch workflow');
      }

      const data = await response.json();
      const workflow = data.data;

      setName(workflow.name);
      setDescription(workflow.description || '');

      // Ensure nodes have proper data structure when loading from DB
      const loadedNodes = (workflow.graph_json.nodes || []).map(node => ({
        ...node,
        data: {
          ...node.data,
          // Ensure data properties exist even if they're empty
          text: node.data?.text || '',
          condition: node.data?.condition || '',
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
        text:
          type === 'step' || type === 'start' || type === 'end'
            ? ''
            : undefined,
        condition: type === 'if' ? '' : undefined,
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
          return { ...node, data: updatedData };
        }
        return node;
      })
    );
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

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
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
      <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div
        style={{
          padding: '1rem 2rem',
          background: 'white',
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Workflow Name"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1.25rem',
              fontWeight: 600,
              flex: 1,
            }}
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              flex: 1,
            }}
          />
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '0.5rem 1.5rem',
              background: saving ? '#ccc' : '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleShowPrompt}
            style={{
              padding: '0.5rem 1.5rem',
              background: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            📄 View Prompt
          </button>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '0.5rem 1.5rem',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
        <div
          style={{
            marginTop: '1rem',
            display: 'flex',
            gap: '0.5rem',
          }}
        >
          <button
            onClick={() => addNode('step')}
            style={{
              padding: '0.5rem 1rem',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            + Step Node
          </button>
          <button
            onClick={() => addNode('if')}
            style={{
              padding: '0.5rem 1rem',
              background: '#ffc107',
              color: '#333',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            + If Node
          </button>
          <button
            onClick={() => addNode('end')}
            style={{
              padding: '0.5rem 1rem',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            + End Node
          </button>
        </div>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes.map(node => {
            const nodeData = {
              ...node.data,
              onNodeUpdate: onNodeUpdate,
            };
            // Debug: Log node data to see what's being passed
            if (
              node.type === 'start' ||
              node.type === 'step' ||
              node.type === 'end'
            ) {
              console.log('ReactFlow node data:', {
                id: node.id,
                type: node.type,
                text: nodeData.text,
                hasOnNodeUpdate: !!nodeData.onNodeUpdate,
              });
            }
            return {
              ...node,
              data: nodeData,
            };
          })}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
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
              background: 'white',
              borderRadius: '8px',
              padding: '2rem',
              maxWidth: '800px',
              maxHeight: '80vh',
              width: '90%',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
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
              <h2 style={{ margin: 0, color: '#333' }}>Compiled Prompt</h2>
              <button
                onClick={() => setShowPromptModal(false)}
                style={{
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                × Close
              </button>
            </div>
            <div
              style={{
                background: '#f8f9fa',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                padding: '1rem',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                fontSize: '0.875rem',
                lineHeight: '1.6',
                color: '#333',
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
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                📋 Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkflowEditor;
