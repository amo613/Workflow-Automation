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
import KnowledgeBaseQueryNode from '../components/full-workflow/nodes/KnowledgeBaseQueryNode';
import NodeSidebarN8N from '../components/full-workflow/NodeSidebarN8N';
import KnowledgeBaseManager from '../components/full-workflow/KnowledgeBaseManager';

const nodeTypes = {
  start: StartNode,
  end: EndNode,
  webhook: WebhookNode,
  'http-request': HttpRequestNode,
  'call-agent': CallAgentNode,
  'variable-set': VariableSetNode,
  if: IfNode,
  wait: WaitNode,
  'database-query': DatabaseQueryNode,
  'google-sheets': GoogleSheetsNode,
  'knowledge-base-query': KnowledgeBaseQueryNode,
};

function FullWorkflowEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
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

  const onNodeUpdate = (nodeId, newData) => {
    setNodes(nds =>
      nds.map(node => {
        if (node.id === nodeId) {
          const updatedData = { ...node.data, ...newData };
          const updatedNode = { ...node, data: updatedData };
          // Update selected node if it's the one being updated
          if (selectedNode && selectedNode.id === nodeId) {
            setSelectedNode(updatedNode);
          }
          return updatedNode;
        }
        return node;
      })
    );
  };

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
          data: {},
        },
      ]);
      setEdges([]);
    }
  }, [id]);

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
      setEdges(workflowJson.edges || []);
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
      const response = await fetch(`/api/full-workflows/${id}`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (!data.data.is_active) {
        const activate = confirm(
          'Workflow is not active. Do you want to activate it and execute?'
        );
        if (activate) {
          await fetch(`/api/full-workflows/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
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
      setExecuting(true);
      setExecutionStatus({
        status: 'running',
        message: 'Starting workflow...',
      });

      // Update node statuses to 'running'
      setNodes(nds =>
        nds.map(node => ({
          ...node,
          data: { ...node.data, status: 'running' },
        }))
      );

      const response = await fetch(`/api/full-workflows/${id}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ input: {} }), // Empty input
      });

      const result = await response.json();

      if (result.success) {
        setExecutionStatus({
          status: 'success',
          message: 'Workflow triggered successfully',
          eventId: result.data?.eventId,
          workflowId: result.data?.workflowId,
        });

        // Update nodes with outputs from execution
        if (result.data?.nodeOutputs) {
          setNodes(nds =>
            nds.map(node => {
              const nodeOutput = result.data.nodeOutputs[node.id];
              return {
                ...node,
                data: {
                  ...node.data,
                  status:
                    nodeOutput !== undefined
                      ? 'success'
                      : node.data.status || 'idle',
                  output: nodeOutput || node.data.output,
                },
              };
            })
          );
        } else {
          // Fallback: update node statuses to 'success' after a delay
          setTimeout(() => {
            setNodes(nds =>
              nds.map(node => ({
                ...node,
                data: { ...node.data, status: 'success' },
              }))
            );
          }, 1000);
        }
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
    } finally {
      setExecuting(false);
    }
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
        edges: edges.map(
          ({ id, source, target, sourceHandle, targetHandle }) => ({
            id,
            source,
            target,
            sourceHandle,
            targetHandle,
          })
        ),
      };

      const url = isNew ? '/api/full-workflows' : `/api/full-workflows/${id}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
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
        alert('Workflow saved successfully!');
      }
    } catch (err) {
      alert('Failed to save workflow: ' + err.message);
      console.error('Error saving workflow:', err);
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
          <h3
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#64748b',
              marginBottom: '1rem',
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
              onClick={() => addNode('webhook')}
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
              <span>Webhook</span>
            </button>
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
              <span>Set Variable</span>
            </button>
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
              <span>❓</span>
              <span>If Condition</span>
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
              <span>⏱️</span>
              <span>Wait</span>
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
            edges={edges}
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
                  'variable-set': '#f59e0b',
                  if: '#f59e0b',
                  wait: '#6366f1',
                  'database-query': '#06b6d4',
                  'google-sheets': '#34d399',
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
    </div>
  );
}

export default FullWorkflowEditor;
