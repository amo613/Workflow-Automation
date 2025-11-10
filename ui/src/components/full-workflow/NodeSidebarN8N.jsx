import { useState, useEffect, useRef } from 'react';
import VariableAutocomplete from './VariableAutocomplete';

/**
 * n8n-style Node Sidebar with INPUT/OUTPUT Panels
 * Includes all input fields from original NodeSidebar + INPUT/OUTPUT panels
 */
export default function NodeSidebarN8N({
  selectedNode,
  nodes,
  edges,
  onNodeUpdate,
  onClose,
  onDeleteNode,
}) {
  const [activeTab, setActiveTab] = useState('parameters');
  const [outputView, setOutputView] = useState('table'); // table, json, schema
  const [inputView, setInputView] = useState('table'); // table, json
  const [localData, setLocalData] = useState({});
  const [knowledgeBaseEntries, setKnowledgeBaseEntries] = useState([]);
  const [showKBSelector, setShowKBSelector] = useState(false);
  const [workflows, setWorkflows] = useState([]);
  const [executingSingleNode, setExecutingSingleNode] = useState(false);
  const lastNodeIdRef = useRef(null);
  const [draggedVariable, setDraggedVariable] = useState(null);

  // Fetch knowledge base entries when component mounts or when call-agent node is selected
  useEffect(() => {
    if (selectedNode?.type === 'call-agent') {
      fetchKnowledgeBaseEntries();
      fetchWorkflows();
    }
  }, [selectedNode?.id, selectedNode?.type]);

  const fetchKnowledgeBaseEntries = async () => {
    try {
      const response = await fetch('/api/knowledge-base', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch entries');
      const data = await response.json();
      setKnowledgeBaseEntries(data.data || []);
    } catch (error) {
      console.error('Error fetching knowledge base entries:', error);
    }
  };

  const fetchWorkflows = async () => {
    try {
      const response = await fetch('/api/workflows', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch workflows');
      const data = await response.json();
      setWorkflows(data.data || []);
    } catch (error) {
      console.error('Error fetching workflows:', error);
    }
  };

  // Get available variables from previous nodes
  const getAvailableVariables = () => {
    if (!selectedNode || !nodes || !edges) {
      return [];
    }

    const variables = [];

    // Find previous nodes (nodes that connect to current node)
    const incomingEdges = edges.filter(edge => edge.target === selectedNode.id);
    const previousNodeIds = incomingEdges.map(edge => edge.source);

    // Add outputs from previous nodes
    previousNodeIds.forEach(nodeId => {
      const node = nodes.find(n => n.id === nodeId);
      if (node && node.data) {
        // Add node output
        variables.push({
          name: `${nodeId}.output`,
          path: `${nodeId}.output`,
          value: node.data.output,
          type: 'node-output',
          description: `Output from ${node.data.name || nodeId}`,
        });

        // Add nested fields if output is an object
        if (node.data.output && typeof node.data.output === 'object') {
          const addNestedFields = (obj, prefix) => {
            Object.keys(obj).forEach(key => {
              const value = obj[key];
              const fullPath = `${prefix}.${key}`;
              variables.push({
                name: fullPath,
                path: fullPath,
                value,
                type: 'node-output-field',
                description: `Field from ${node.data.name || nodeId}: ${key}`,
              });

              if (
                typeof value === 'object' &&
                value !== null &&
                !Array.isArray(value)
              ) {
                addNestedFields(value, fullPath);
              }
            });
          };

          addNestedFields(node.data.output, `${nodeId}.output`);
        }
      }
    });

    // Add previous.output if there's exactly one previous node
    if (previousNodeIds.length === 1) {
      const prevNode = nodes.find(n => n.id === previousNodeIds[0]);
      if (prevNode && prevNode.data && prevNode.data.output) {
        variables.push({
          name: 'previous.output',
          path: 'previous.output',
          value: prevNode.data.output,
          type: 'previous-output',
          description: 'Output from previous node',
        });

        if (
          typeof prevNode.data.output === 'object' &&
          prevNode.data.output !== null
        ) {
          const addNestedFields = (obj, prefix) => {
            Object.keys(obj).forEach(key => {
              const value = obj[key];
              const fullPath = `${prefix}.${key}`;
              variables.push({
                name: fullPath,
                path: fullPath,
                value,
                type: 'previous-output-field',
                description: `Field from previous node: ${key}`,
              });

              if (
                typeof value === 'object' &&
                value !== null &&
                !Array.isArray(value)
              ) {
                addNestedFields(value, fullPath);
              }
            });
          };

          addNestedFields(prevNode.data.output, 'previous.output');
        }
      }
    }

    return variables;
  };

  useEffect(() => {
    if (selectedNode && selectedNode.id !== lastNodeIdRef.current) {
      setLocalData(selectedNode.data || {});
      lastNodeIdRef.current = selectedNode.id;
    } else if (!selectedNode) {
      setLocalData({});
      lastNodeIdRef.current = null;
    }
  }, [selectedNode?.id]);

  const handleUpdate = (field, value) => {
    const newData = { ...localData, [field]: value };
    setLocalData(newData);
    if (onNodeUpdate) {
      onNodeUpdate(selectedNode.id, newData);
    }
  };

  // Get input data from previous nodes
  const getInputData = () => {
    if (!selectedNode || !nodes || !edges) return null;

    const incomingEdges = edges.filter(edge => edge.target === selectedNode.id);
    if (incomingEdges.length === 0) return null;

    // Get output from first previous node
    const previousNodeId = incomingEdges[0].source;
    const previousNode = nodes.find(n => n.id === previousNodeId);

    if (!previousNode) return null;

    // Check for output in node.data.output
    const output = previousNode.data?.output;
    if (output === undefined || output === null) return null;

    return output;
  };

  // Get output data from current node
  const getOutputData = () => {
    if (!selectedNode) return null;

    // Check for output in node.data.output
    const output = selectedNode.data?.output;
    if (output === undefined || output === null) return null;

    return output;
  };

  const inputData = getInputData();
  const outputData = getOutputData();
  const availableVariables = getAvailableVariables();

  // Render data as table
  const renderTable = data => {
    if (!data || typeof data !== 'object')
      return (
        <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No data</div>
      );

    const entries = Object.entries(data);
    if (entries.length === 0)
      return (
        <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No data</div>
      );

    return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #333' }}>
            <th
              style={{
                textAlign: 'left',
                padding: '0.5rem',
                fontSize: '0.75rem',
                color: '#94a3b8',
              }}
            >
              Field
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '0.5rem',
                fontSize: '0.75rem',
                color: '#94a3b8',
              }}
            >
              Value
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '0.5rem',
                fontSize: '0.75rem',
                color: '#94a3b8',
              }}
            >
              Type
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} style={{ borderBottom: '1px solid #2a2a2a' }}>
              <td
                style={{
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                {key}
              </td>
              <td
                style={{
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  color: 'white',
                }}
              >
                {typeof value === 'object'
                  ? JSON.stringify(value)
                  : String(value)}
              </td>
              <td
                style={{
                  padding: '0.5rem',
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                }}
              >
                {typeof value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  // Render draggable field
  const renderDraggableField = (key, value, path = '') => {
    const fullPath = path ? `${path}.${key}` : key;
    const displayValue =
      typeof value === 'object' ? JSON.stringify(value) : String(value);
    const variableExpression = path ? `{{${path}.${key}}}` : `{{${key}}}`;

    return (
      <div
        key={fullPath}
        draggable
        onDragStart={e => {
          setDraggedVariable(variableExpression);
          e.dataTransfer.setData('text/plain', variableExpression);
          e.dataTransfer.effectAllowed = 'copy';
        }}
        onDragEnd={() => {
          setDraggedVariable(null);
        }}
        style={{
          padding: '0.5rem',
          margin: '0.25rem 0',
          background: '#2a2a2a',
          border: '1px solid #333',
          borderRadius: '6px',
          cursor: 'grab',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = '#333';
          e.currentTarget.style.cursor = 'grab';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = '#2a2a2a';
        }}
        onClick={() => {
          // Copy to clipboard
          navigator.clipboard.writeText(variableExpression);
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{ fontWeight: 600, fontSize: '0.875rem', color: 'white' }}
          >
            {key}
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: '#94a3b8',
              marginTop: '0.25rem',
            }}
          >
            {displayValue.length > 50
              ? displayValue.substring(0, 50) + '...'
              : displayValue}
          </div>
          <div
            style={{
              fontSize: '0.7rem',
              color: '#3b82f6',
              marginTop: '0.25rem',
            }}
          >
            {variableExpression}
          </div>
        </div>
        <div
          style={{
            fontSize: '0.75rem',
            color: '#94a3b8',
            marginLeft: '0.5rem',
          }}
        >
          ⋮⋮
        </div>
      </div>
    );
  };

  // Recursively render nested objects
  const renderNestedFields = (obj, path = '') => {
    const fields = [];

    Object.entries(obj).forEach(([key, value]) => {
      const fullPath = path ? `${path}.${key}` : key;

      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        // Nested object - render recursively
        fields.push(...renderNestedFields(value, fullPath));
      } else {
        // Leaf value - render as draggable field
        fields.push(renderDraggableField(key, value, path));
      }
    });

    return fields;
  };

  // Handle drop on input field
  const handleDrop = (e, variableExpression) => {
    e.preventDefault();
    // Get the field name from the event target's data attribute or parent
    const fieldName = e.target.closest('[data-field-name]')?.dataset.fieldName;
    if (!fieldName) return;

    if (variableExpression) {
      const currentValue = localData[fieldName] || '';
      const cursorPos = e.target.selectionStart || currentValue.length;
      const newValue =
        currentValue.substring(0, cursorPos) +
        variableExpression +
        currentValue.substring(cursorPos);
      handleUpdate(fieldName, newValue);
    }
  };

  // Render node-specific configuration
  const renderNodeConfig = () => {
    if (!selectedNode) return null;

    switch (selectedNode.type) {
      case 'webhook':
        return (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                Webhook URL
              </label>
              <input
                type="text"
                value={localData.url || ''}
                onChange={e => handleUpdate('url', e.target.value)}
                placeholder="https://example.com/webhook"
                onDrop={e => handleDrop(e, 'url')}
                onDragOver={e => e.preventDefault()}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  background: '#2a2a2a',
                  color: 'white',
                }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                Method
              </label>
              <select
                value={localData.method || 'POST'}
                onChange={e => handleUpdate('method', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  background: '#2a2a2a',
                  color: 'white',
                }}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                Body Template
              </label>
              <VariableAutocomplete
                value={localData.body_template || ''}
                onChange={e => handleUpdate('body_template', e.target.value)}
                availableVariables={availableVariables}
                placeholder="Use {{variable}} for variables"
                multiline
              />
            </div>
          </>
        );

      case 'http-request':
        return (
          <>
            <div style={{ marginBottom: '1rem' }} data-field-name="url">
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                URL
              </label>
              <VariableAutocomplete
                value={localData.url || ''}
                onChange={e => handleUpdate('url', e.target.value)}
                availableVariables={availableVariables}
                placeholder="https://api.example.com/endpoint"
                onDrop={(e, variableExpression) => {
                  const currentValue = localData.url || '';
                  const cursorPos =
                    e.target.selectionStart || currentValue.length;
                  const newValue =
                    currentValue.substring(0, cursorPos) +
                    variableExpression +
                    currentValue.substring(cursorPos);
                  handleUpdate('url', newValue);
                }}
                onDragOver={e => e.preventDefault()}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                Method
              </label>
              <select
                value={localData.method || 'GET'}
                onChange={e => handleUpdate('method', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  background: '#2a2a2a',
                  color: 'white',
                }}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }} data-field-name="headers">
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                Headers (JSON)
              </label>
              <VariableAutocomplete
                value={localData.headers || ''}
                onChange={e => handleUpdate('headers', e.target.value)}
                availableVariables={availableVariables}
                placeholder='{"Authorization": "Bearer {{token}}"}'
                multiline
                onDrop={(e, variableExpression) => {
                  const currentValue = localData.headers || '';
                  const cursorPos =
                    e.target.selectionStart || currentValue.length;
                  const newValue =
                    currentValue.substring(0, cursorPos) +
                    variableExpression +
                    currentValue.substring(cursorPos);
                  handleUpdate('headers', newValue);
                }}
                onDragOver={e => e.preventDefault()}
              />
            </div>
            <div style={{ marginBottom: '1rem' }} data-field-name="body">
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                Body (JSON)
              </label>
              <VariableAutocomplete
                value={localData.body || ''}
                onChange={e => handleUpdate('body', e.target.value)}
                availableVariables={availableVariables}
                placeholder='{"name": "{{name}}", "email": "{{email}}"}'
                multiline
                onDrop={(e, variableExpression) => {
                  const currentValue = localData.body || '';
                  const cursorPos =
                    e.target.selectionStart || currentValue.length;
                  const newValue =
                    currentValue.substring(0, cursorPos) +
                    variableExpression +
                    currentValue.substring(cursorPos);
                  handleUpdate('body', newValue);
                }}
                onDragOver={e => e.preventDefault()}
              />
            </div>
          </>
        );

      case 'call-agent':
        return (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                Use Existing Workflow
              </label>
              <select
                value={localData.use_existing ? 'true' : 'false'}
                onChange={e =>
                  handleUpdate('use_existing', e.target.value === 'true')
                }
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  background: '#2a2a2a',
                  color: 'white',
                }}
              >
                <option value="false">Create New Prompt</option>
                <option value="true">Use Existing Call Flow Workflow</option>
              </select>
            </div>
            {localData.use_existing ? (
              <div style={{ marginBottom: '1rem' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'white',
                  }}
                >
                  Call Flow Workflow
                </label>
                <select
                  value={localData.workflow_id || ''}
                  onChange={e =>
                    handleUpdate('workflow_id', parseInt(e.target.value, 10))
                  }
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    background: '#2a2a2a',
                    color: 'white',
                  }}
                >
                  <option value="">Select a workflow...</option>
                  {workflows.map(workflow => (
                    <option key={workflow.id} value={workflow.id}>
                      {workflow.name} (ID: {workflow.id})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ marginBottom: '1rem' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'white',
                  }}
                >
                  Prompt
                </label>
                <VariableAutocomplete
                  value={localData.prompt || ''}
                  onChange={e => handleUpdate('prompt', e.target.value)}
                  availableVariables={availableVariables}
                  placeholder="Enter call prompt..."
                  multiline
                />
              </div>
            )}
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                Voice
              </label>
              <select
                value={localData.voice || 'alloy'}
                onChange={e => handleUpdate('voice', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  background: '#2a2a2a',
                  color: 'white',
                }}
              >
                <option value="alloy">Alloy</option>
                <option value="echo">Echo</option>
                <option value="fable">Fable</option>
                <option value="onyx">Onyx</option>
                <option value="nova">Nova</option>
                <option value="shimmer">Shimmer</option>
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                Phone Number
              </label>
              <VariableAutocomplete
                value={localData.phone_number || ''}
                onChange={e => handleUpdate('phone_number', e.target.value)}
                availableVariables={availableVariables}
                placeholder="+1234567890 or {{phoneNumber}}"
              />
            </div>
          </>
        );

      case 'variable-set':
        return (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                Variable Name
              </label>
              <input
                type="text"
                value={localData.variable_name || ''}
                onChange={e => handleUpdate('variable_name', e.target.value)}
                placeholder="userName"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  background: '#2a2a2a',
                  color: 'white',
                }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                Value
              </label>
              <VariableAutocomplete
                value={localData.value || ''}
                onChange={e => handleUpdate('value', e.target.value)}
                availableVariables={availableVariables}
                placeholder="Use {{previous.output}} or {{variable}}"
                multiline
              />
            </div>
          </>
        );

      case 'if':
        return (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                Condition 1
              </label>
              <VariableAutocomplete
                value={localData.condition1 || ''}
                onChange={e => handleUpdate('condition1', e.target.value)}
                availableVariables={availableVariables}
                placeholder="{{value}} or {{count}}"
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                Operator
              </label>
              <select
                value={localData.operator || '=='}
                onChange={e => handleUpdate('operator', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  background: '#2a2a2a',
                  color: 'white',
                }}
              >
                <option value="==">Equals (==)</option>
                <option value="!=">Not Equals (!=)</option>
                <option value=">">Greater Than (&gt;)</option>
                <option value="<">Less Than (&lt;)</option>
                <option value=">=">Greater or Equal (&gt;=)</option>
                <option value="<=">Less or Equal (&lt;=)</option>
                <option value="contains">Contains</option>
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                Condition 2
              </label>
              <VariableAutocomplete
                value={localData.condition2 || ''}
                onChange={e => handleUpdate('condition2', e.target.value)}
                availableVariables={availableVariables}
                placeholder='"test" or 10 or {{otherValue}}'
              />
            </div>
          </>
        );

      case 'wait':
        return (
          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'white',
              }}
            >
              Duration (seconds)
            </label>
            <input
              type="number"
              value={localData.duration || 0}
              onChange={e =>
                handleUpdate('duration', parseInt(e.target.value, 10) || 0)
              }
              placeholder="5"
              min="0"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #333',
                borderRadius: '8px',
                fontSize: '0.875rem',
                background: '#2a2a2a',
                color: 'white',
              }}
            />
          </div>
        );

      case 'database-query':
        return (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                SQL Query
              </label>
              <VariableAutocomplete
                value={localData.query || ''}
                onChange={e => handleUpdate('query', e.target.value)}
                availableVariables={availableVariables}
                placeholder="SELECT * FROM users WHERE id = $1"
                multiline
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                Parameters (JSON Array)
              </label>
              <VariableAutocomplete
                value={localData.parameters || ''}
                onChange={e => handleUpdate('parameters', e.target.value)}
                availableVariables={availableVariables}
                placeholder='["{{userId}}", "{{email}}"]'
                multiline
              />
            </div>
          </>
        );

      case 'google-sheets':
        return (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                Spreadsheet ID
              </label>
              <VariableAutocomplete
                value={localData.spreadsheet_id || ''}
                onChange={e => handleUpdate('spreadsheet_id', e.target.value)}
                availableVariables={availableVariables}
                placeholder="Enter spreadsheet ID or {{spreadsheetId}}"
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                Range
              </label>
              <input
                type="text"
                value={localData.range || ''}
                onChange={e => handleUpdate('range', e.target.value)}
                placeholder="Sheet1!A1:B10"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  background: '#2a2a2a',
                  color: 'white',
                }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                Values (JSON Array)
              </label>
              <VariableAutocomplete
                value={localData.values || ''}
                onChange={e => handleUpdate('values', e.target.value)}
                availableVariables={availableVariables}
                placeholder='[["{{name}}", "{{email}}"], ["John", "john@example.com"]]'
                multiline
              />
            </div>
          </>
        );

      case 'knowledge-base-query':
        return (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                Query
              </label>
              <VariableAutocomplete
                value={localData.query || ''}
                onChange={e => handleUpdate('query', e.target.value)}
                availableVariables={availableVariables}
                placeholder="Search query or {{searchTerm}}"
                multiline
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                Limit
              </label>
              <input
                type="number"
                value={localData.limit || 5}
                onChange={e =>
                  handleUpdate('limit', parseInt(e.target.value, 10) || 5)
                }
                placeholder="5"
                min="1"
                max="20"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  background: '#2a2a2a',
                  color: 'white',
                }}
              />
            </div>
          </>
        );

      default:
        return (
          <div
            style={{
              padding: '1rem',
              background: '#2a2a2a',
              borderRadius: '8px',
              fontSize: '0.875rem',
              color: '#94a3b8',
            }}
          >
            No configuration available for this node type.
          </div>
        );
    }
  };

  if (!selectedNode) {
    return null;
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#1a1a1a',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '1rem',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>✏️</span>
          <span style={{ fontWeight: 600 }}>
            {selectedNode?.type || 'Node'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Execute Single Node Button */}
          <button
            onClick={async () => {
              if (!selectedNode) return;
              setExecutingSingleNode(true);
              try {
                // Execute only this node
                const response = await fetch(
                  '/api/full-workflows/execute-node',
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      node: selectedNode,
                      nodes,
                      edges,
                      input: inputData || {},
                    }),
                  }
                );
                const result = await response.json();
                if (result.success && result.data?.output) {
                  // Update node with output
                  handleUpdate('output', result.data.output);
                  handleUpdate('status', 'success');
                } else {
                  handleUpdate('status', 'failed');
                  alert(result.error || 'Failed to execute node');
                }
              } catch (error) {
                handleUpdate('status', 'failed');
                alert('Error executing node: ' + error.message);
              } finally {
                setExecutingSingleNode(false);
              }
            }}
            disabled={executingSingleNode}
            style={{
              background: executingSingleNode ? '#4a5568' : '#10b981',
              border: 'none',
              color: 'white',
              cursor: executingSingleNode ? 'not-allowed' : 'pointer',
              fontSize: '0.75rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            {executingSingleNode ? '⏳' : '▶️'} Execute
          </button>
          {/* Delete Node Button */}
          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete this node?')) {
                if (onDeleteNode) {
                  onDeleteNode(selectedNode.id);
                }
              }
            }}
            style={{
              background: '#ef4444',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.75rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              fontWeight: 600,
            }}
          >
            🗑️ Delete
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1.25rem',
              padding: '0.25rem',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #333' }}>
        {['parameters', 'settings', 'docs'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.75rem 1rem',
              background: activeTab === tab ? '#2a2a2a' : 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              textTransform: 'capitalize',
              borderBottom: activeTab === tab ? '2px solid #3b82f6' : 'none',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content Area - 3 Panels */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* INPUT Panel (Left) */}
        <div
          style={{
            width: '300px',
            borderRight: '1px solid #333',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '0.75rem',
              background: '#2a2a2a',
              borderBottom: '1px solid #333',
              fontWeight: 600,
            }}
          >
            INPUT
          </div>
          <div style={{ padding: '0.75rem', overflow: 'auto', flex: 1 }}>
            {inputData ? (
              <>
                <div
                  style={{
                    marginBottom: '0.5rem',
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                  }}
                >
                  From:{' '}
                  {edges.find(e => e.target === selectedNode.id)?.source ||
                    'Previous Node'}
                </div>
                <div
                  style={{
                    marginBottom: '0.5rem',
                    display: 'flex',
                    gap: '0.25rem',
                  }}
                >
                  <button
                    onClick={() => setInputView('table')}
                    style={{
                      padding: '0.25rem 0.5rem',
                      background:
                        inputView === 'table' ? '#3b82f6' : 'transparent',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      borderRadius: '4px',
                    }}
                  >
                    Table
                  </button>
                  <button
                    onClick={() => setInputView('json')}
                    style={{
                      padding: '0.25rem 0.5rem',
                      background:
                        inputView === 'json' ? '#3b82f6' : 'transparent',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      borderRadius: '4px',
                    }}
                  >
                    JSON
                  </button>
                </div>
                {inputView === 'table' ? (
                  <>
                    {renderTable(inputData)}
                    <div
                      style={{
                        marginTop: '1rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid #333',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: '#94a3b8',
                          marginBottom: '0.5rem',
                        }}
                      >
                        Drag fields to use (or click to copy):
                      </div>
                      {renderNestedFields(inputData)}
                    </div>
                  </>
                ) : (
                  <pre
                    style={{
                      fontSize: '0.75rem',
                      overflow: 'auto',
                      color: 'white',
                    }}
                  >
                    {JSON.stringify(inputData, null, 2)}
                  </pre>
                )}
              </>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                No input data
              </div>
            )}
          </div>
        </div>

        {/* Configuration Panel (Center) */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: '#1a1a1a',
          }}
        >
          <div style={{ padding: '1rem', overflow: 'auto', flex: 1 }}>
            {activeTab === 'parameters' && (
              <div>
                {/* Node Name */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'white',
                    }}
                  >
                    Node Name
                  </label>
                  <input
                    type="text"
                    value={localData.name || ''}
                    onChange={e => handleUpdate('name', e.target.value)}
                    placeholder="Optional node name"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #333',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      background: '#2a2a2a',
                      color: 'white',
                    }}
                  />
                </div>

                {/* Node-Specific Configuration */}
                {renderNodeConfig()}
              </div>
            )}
            {activeTab === 'settings' && (
              <div>
                {selectedNode?.type === 'call-agent' ? (
                  <>
                    {/* Knowledge Base Configuration */}
                    <div style={{ marginBottom: '2rem' }}>
                      <div
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'white',
                          marginBottom: '1rem',
                        }}
                      >
                        Knowledge Base
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: '#94a3b8',
                          marginBottom: '1rem',
                        }}
                      >
                        Select knowledge base entries to include in the call
                        prompt
                      </div>
                      <div style={{ marginBottom: '1rem' }}>
                        {knowledgeBaseEntries.length === 0 ? (
                          <div
                            style={{
                              padding: '1rem',
                              background: '#2a2a2a',
                              borderRadius: '8px',
                              color: '#94a3b8',
                              fontSize: '0.875rem',
                            }}
                          >
                            No knowledge base entries found. Create entries in
                            the Knowledge Base Manager.
                          </div>
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.5rem',
                            }}
                          >
                            {knowledgeBaseEntries.map(entry => {
                              const isSelected =
                                localData.knowledge_base_ids?.includes(
                                  entry.id
                                ) || false;
                              return (
                                <label
                                  key={entry.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.75rem',
                                    background: isSelected
                                      ? '#2a2a2a'
                                      : '#1a1a1a',
                                    border: `1px solid ${isSelected ? '#3b82f6' : '#333'}`,
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={e => {
                                      const currentIds =
                                        localData.knowledge_base_ids || [];
                                      const newIds = e.target.checked
                                        ? [...currentIds, entry.id]
                                        : currentIds.filter(
                                            id => id !== entry.id
                                          );
                                      handleUpdate(
                                        'knowledge_base_ids',
                                        newIds
                                      );
                                    }}
                                    style={{
                                      width: '18px',
                                      height: '18px',
                                      cursor: 'pointer',
                                    }}
                                  />
                                  <div style={{ flex: 1 }}>
                                    <div
                                      style={{
                                        fontWeight: 600,
                                        fontSize: '0.875rem',
                                        color: 'white',
                                      }}
                                    >
                                      {entry.name}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: '0.75rem',
                                        color: '#94a3b8',
                                        marginTop: '0.25rem',
                                      }}
                                    >
                                      {entry.text.length > 100
                                        ? entry.text.substring(0, 100) + '...'
                                        : entry.text}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* OpenAI Configuration */}
                    <div
                      style={{
                        marginTop: '2rem',
                        paddingTop: '2rem',
                        borderTop: '1px solid #333',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'white',
                          marginBottom: '1rem',
                        }}
                      >
                        OpenAI Configuration
                      </div>

                      <div style={{ marginBottom: '1rem' }}>
                        <label
                          style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'white',
                          }}
                        >
                          Temperature (0-2)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="2"
                          step="0.1"
                          value={localData.temperature ?? 1.0}
                          onChange={e =>
                            handleUpdate(
                              'temperature',
                              parseFloat(e.target.value)
                            )
                          }
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #333',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            background: '#2a2a2a',
                            color: 'white',
                          }}
                        />
                      </div>

                      <div style={{ marginBottom: '1rem' }}>
                        <label
                          style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'white',
                          }}
                        >
                          Max Response Tokens (1-4096)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="4096"
                          value={localData.max_response_output_tokens ?? 4096}
                          onChange={e =>
                            handleUpdate(
                              'max_response_output_tokens',
                              parseInt(e.target.value, 10)
                            )
                          }
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #333',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            background: '#2a2a2a',
                            color: 'white',
                          }}
                        />
                      </div>

                      <div style={{ marginBottom: '1rem' }}>
                        <label
                          style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'white',
                          }}
                        >
                          VAD Threshold (0-1)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                          value={localData.vad_threshold ?? 0.5}
                          onChange={e =>
                            handleUpdate(
                              'vad_threshold',
                              parseFloat(e.target.value)
                            )
                          }
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #333',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            background: '#2a2a2a',
                            color: 'white',
                          }}
                        />
                      </div>

                      <div style={{ marginBottom: '1rem' }}>
                        <label
                          style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'white',
                          }}
                        >
                          Tool Choice
                        </label>
                        <select
                          value={localData.tool_choice || 'auto'}
                          onChange={e =>
                            handleUpdate('tool_choice', e.target.value)
                          }
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #333',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            background: '#2a2a2a',
                            color: 'white',
                          }}
                        >
                          <option value="auto">Auto</option>
                          <option value="none">None</option>
                          <option value="required">Required</option>
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ color: '#94a3b8' }}>
                    No settings available for this node type
                  </div>
                )}
              </div>
            )}
            {activeTab === 'docs' && (
              <div style={{ color: '#94a3b8' }}>Documentation</div>
            )}
          </div>
        </div>

        {/* OUTPUT Panel (Right) */}
        <div
          style={{
            width: '300px',
            borderLeft: '1px solid #333',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '0.75rem',
              background: '#2a2a2a',
              borderBottom: '1px solid #333',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 600 }}>OUTPUT</span>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {['table', 'json', 'schema'].map(view => (
                <button
                  key={view}
                  onClick={() => setOutputView(view)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    background: outputView === view ? '#3b82f6' : 'transparent',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                  }}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: '0.75rem', overflow: 'auto', flex: 1 }}>
            {outputData ? (
              outputView === 'table' ? (
                renderTable(outputData)
              ) : outputView === 'json' ? (
                <pre
                  style={{
                    fontSize: '0.75rem',
                    overflow: 'auto',
                    color: 'white',
                  }}
                >
                  {JSON.stringify(outputData, null, 2)}
                </pre>
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'white' }}>
                  <div style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
                    Schema:
                  </div>
                  {Object.entries(outputData).map(([key, value]) => (
                    <div key={key} style={{ marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 600 }}>{key}:</span>{' '}
                      <span style={{ color: '#94a3b8' }}>{typeof value}</span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                No output data yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
