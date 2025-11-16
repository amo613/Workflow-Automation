import { useState, useEffect, useRef } from 'react';
import VariableAutocomplete from './VariableAutocomplete';
import { fetchWithCSRF } from '../../utils/csrf.utils.js';
import { Lightbulb } from 'lucide-react';

/**
 * Node Sidebar for Full Workflows
 * Displays configuration options for each node type
 */
export default function NodeSidebar({
  selectedNode,
  nodes,
  edges,
  onNodeUpdate,
  onClose,
}) {
  const [localData, setLocalData] = useState({});
  const [knowledgeBaseEntries, setKnowledgeBaseEntries] = useState([]);
  const [showKBSelector, setShowKBSelector] = useState(false);
  const lastNodeIdRef = useRef(null);

  // Fetch knowledge base entries when component mounts or when call-agent node is selected
  useEffect(() => {
    if (selectedNode?.type === 'call-agent') {
      fetchKnowledgeBaseEntries();
    }
  }, [selectedNode?.id, selectedNode?.type]);

  const fetchKnowledgeBaseEntries = async () => {
    try {
      const response = await fetchWithCSRF('/api/knowledge-base');
      if (!response.ok) throw new Error('Failed to fetch entries');
      const data = await response.json();
      setKnowledgeBaseEntries(data.data || []);
    } catch (error) {
      console.error('Error fetching knowledge base entries:', error);
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

  if (!selectedNode) {
    return null;
  }

  const availableVariables = getAvailableVariables();

  // Render node-specific configuration based on node type
  const renderNodeConfig = () => {
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
                  color: '#1a202c',
                }}
              >
                Webhook URL
              </label>
              <input
                type="text"
                value={localData.url || ''}
                onChange={e => handleUpdate('url', e.target.value)}
                placeholder="https://example.com/webhook"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
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
                  color: '#1a202c',
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
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
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
                  color: '#1a202c',
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
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#1a202c',
                }}
              >
                URL
              </label>
              <VariableAutocomplete
                value={localData.url || ''}
                onChange={e => handleUpdate('url', e.target.value)}
                availableVariables={availableVariables}
                placeholder="https://api.example.com/endpoint"
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#1a202c',
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
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
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
                  color: '#1a202c',
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
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#1a202c',
                }}
              >
                Body (JSON)
              </label>
              <VariableAutocomplete
                value={localData.body || ''}
                onChange={e => handleUpdate('body', e.target.value)}
                availableVariables={availableVariables}
                placeholder='{"name": "{{userName}}", "email": "{{email}}"}'
                multiline
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
                  color: '#1a202c',
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
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
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
                    color: '#1a202c',
                  }}
                >
                  Call Flow Workflow ID
                </label>
                <input
                  type="number"
                  value={localData.workflow_id || ''}
                  onChange={e =>
                    handleUpdate('workflow_id', parseInt(e.target.value, 10))
                  }
                  placeholder="Enter workflow ID"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
            ) : (
              <div style={{ marginBottom: '1rem' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#1a202c',
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
                  color: '#1a202c',
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
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
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
                  color: '#1a202c',
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

            {/* Knowledge Base Selection */}
            <div style={{ marginBottom: '1rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                }}
              >
                <label
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#1a202c',
                  }}
                >
                  Knowledge Base Entries
                </label>
                <button
                  onClick={() => setShowKBSelector(!showKBSelector)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    background: showKBSelector
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  {showKBSelector ? '−' : '+'}
                </button>
              </div>

              {/* Selected Knowledge Base Entries */}
              {localData.knowledge_base_ids &&
                localData.knowledge_base_ids.length > 0 && (
                  <div
                    style={{
                      marginBottom: '0.5rem',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    {localData.knowledge_base_ids.map(kbId => {
                      const entry = knowledgeBaseEntries.find(
                        e => e.id === kbId
                      );
                      if (!entry) return null;
                      return (
                        <div
                          key={kbId}
                          style={{
                            padding: '0.5rem 0.75rem',
                            background:
                              'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          <span>{entry.name}</span>
                          <button
                            onClick={() => {
                              const newIds =
                                localData.knowledge_base_ids.filter(
                                  id => id !== kbId
                                );
                              handleUpdate('knowledge_base_ids', newIds);
                            }}
                            style={{
                              background: 'rgba(255, 255, 255, 0.3)',
                              border: 'none',
                              color: 'white',
                              borderRadius: '4px',
                              width: '20px',
                              height: '20px',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

              {/* Knowledge Base Selector */}
              {showKBSelector && (
                <div
                  style={{
                    maxHeight: '200px',
                    overflowY: 'auto',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '0.5rem',
                    background: '#f8fafc',
                  }}
                >
                  {knowledgeBaseEntries.length === 0 ? (
                    <div
                      style={{
                        padding: '1rem',
                        textAlign: 'center',
                        color: '#94a3b8',
                        fontSize: '0.75rem',
                      }}
                    >
                      No knowledge base entries. Create them in the Knowledge
                      Base Manager.
                    </div>
                  ) : (
                    knowledgeBaseEntries.map(entry => {
                      const isSelected =
                        localData.knowledge_base_ids?.includes(entry.id) ||
                        false;
                      return (
                        <div
                          key={entry.id}
                          onClick={() => {
                            const currentIds =
                              localData.knowledge_base_ids || [];
                            const newIds = isSelected
                              ? currentIds.filter(id => id !== entry.id)
                              : [...currentIds, entry.id];
                            handleUpdate('knowledge_base_ids', newIds);
                          }}
                          style={{
                            padding: '0.75rem',
                            marginBottom: '0.5rem',
                            background: isSelected ? 'hsl(var(--accent))' : 'hsl(var(--card))',
                            border: `1px solid ${isSelected ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={e => {
                            if (!isSelected) {
                              e.currentTarget.style.background = 'hsl(var(--muted))';
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isSelected) {
                              e.currentTarget.style.background = 'hsl(var(--card))';
                            }
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: '0.875rem',
                              color: '#1a202c',
                              marginBottom: '0.25rem',
                            }}
                          >
                            {isSelected && '✓ '}
                            {entry.name}
                          </div>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: '#64748b',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={entry.text}
                          >
                            {entry.text}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
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
                  color: '#1a202c',
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
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
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
                  color: '#1a202c',
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
                  color: '#1a202c',
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
                  color: '#1a202c',
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
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
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
                  color: '#1a202c',
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
                color: '#1a202c',
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
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '0.875rem',
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
                  color: '#1a202c',
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
                  color: '#1a202c',
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
                  color: '#1a202c',
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
                  color: '#1a202c',
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
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
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
                  color: '#1a202c',
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
                  color: '#1a202c',
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
                  color: '#1a202c',
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
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
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
              background: '#f8fafc',
              borderRadius: '8px',
              fontSize: '0.875rem',
              color: '#64748b',
            }}
          >
            No configuration available for this node type.
          </div>
        );
    }
  };

  return (
    <div
      style={{
        width: '350px',
        background: 'hsl(var(--card))',
        borderLeft: '1px solid hsl(var(--border))',
        padding: '1.5rem',
        overflowY: 'auto',
        height: '100%',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h3
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#1a202c',
              marginBottom: '0.25rem',
            }}
          >
            {selectedNode.type}
          </h3>
          {localData.name && (
            <div
              style={{
                fontSize: '0.875rem',
                color: '#64748b',
              }}
            >
              {localData.name}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: '#64748b',
            padding: '0.25rem 0.5rem',
            borderRadius: '8px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
            e.currentTarget.style.color = '#1f2937';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#64748b';
          }}
        >
          ×
        </button>
      </div>

      {/* Node Name */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#1a202c',
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
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '0.875rem',
          }}
        />
      </div>

      {/* Node-Specific Configuration */}
      {renderNodeConfig()}

      {/* Available Variables Info */}
      {availableVariables.length > 0 && (
        <div
          style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: '#f0f9ff',
            borderRadius: '8px',
            border: '1px solid #bae6fd',
          }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#0369a1',
              marginBottom: '0.5rem',
            }}
          >
            <Lightbulb className="w-4 h-4 mr-1" /> Available Variables
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: '#0284c7',
              lineHeight: '1.5',
            }}
          >
            You can use variables from previous nodes in your templates. Type{' '}
            <code
              style={{
                background: '#e0f2fe',
                padding: '0.125rem 0.25rem',
                borderRadius: '4px',
              }}
            >
              {`{{`}
            </code>{' '}
            to see available variables.
          </div>
        </div>
      )}
    </div>
  );
}
