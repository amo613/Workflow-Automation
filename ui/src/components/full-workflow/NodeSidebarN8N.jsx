import { useState, useEffect, useRef, useMemo } from 'react';
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
  workflowId = null,
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
  const [googleSheetsStatus, setGoogleSheetsStatus] = useState(null);
  const [spreadsheets, setSpreadsheets] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [showSpreadsheetModal, setShowSpreadsheetModal] = useState(false);
  const [showSheetModal, setShowSheetModal] = useState(false);

  // Fetch knowledge base entries when component mounts or when call-agent node is selected
  useEffect(() => {
    if (selectedNode?.type === 'call-agent') {
      fetchKnowledgeBaseEntries();
      fetchWorkflows();
    }
  }, [selectedNode?.id, selectedNode?.type]);

  // Fetch Google Sheets status when google-sheets or google-sheets-trigger node is selected
  useEffect(() => {
    if (selectedNode?.type === 'google-sheets' || selectedNode?.type === 'google-sheets-trigger') {
      fetchGoogleSheetsStatus();
    }
  }, [selectedNode?.id, selectedNode?.type]);

  // Fetch spreadsheets when connected
  useEffect(() => {
    if (
      (selectedNode?.type === 'google-sheets' || selectedNode?.type === 'google-sheets-trigger') &&
      googleSheetsStatus?.connected
    ) {
      console.log('Auto-fetching spreadsheets because connected:', googleSheetsStatus);
      fetchSpreadsheets();
    }
  }, [selectedNode?.type, googleSheetsStatus?.connected]);

  // Fetch sheets when spreadsheetId changes
  useEffect(() => {
    if (localData.spreadsheetId && localData.spreadsheetId !== '') {
      fetchSheets(localData.spreadsheetId);
    }
  }, [localData.spreadsheetId]);

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

  const fetchGoogleSheetsStatus = async () => {
    try {
      const response = await fetch('/api/integrations/google-sheets/status', {
        credentials: 'include',
        cache: 'no-cache',
      });
      if (!response.ok) {
        console.error('Status response not OK:', response.status);
        throw new Error('Failed to fetch status');
      }
      const data = await response.json();
      console.log('Google Sheets status:', data);
      setGoogleSheetsStatus(data);
      
      // If connected, automatically fetch spreadsheets
      if (data.connected) {
        fetchSpreadsheets();
      }
    } catch (error) {
      console.error('Error fetching Google Sheets status:', error);
      setGoogleSheetsStatus({ connected: false });
    }
  };

  const fetchSpreadsheets = async () => {
    try {
      console.log('Fetching spreadsheets...');
      const response = await fetch('/api/integrations/google-sheets/spreadsheets', {
        credentials: 'include',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Spreadsheets response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch spreadsheets:', response.status, errorText);
        throw new Error(`Failed to fetch spreadsheets: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Spreadsheets response data:', data);
      
      if (data.success && data.data && Array.isArray(data.data)) {
        console.log(`Setting ${data.data.length} spreadsheets`);
        setSpreadsheets(data.data);
      } else if (Array.isArray(data.data)) {
        console.log(`Setting ${data.data.length} spreadsheets (direct array)`);
        setSpreadsheets(data.data);
      } else {
        console.warn('No spreadsheets data in response:', data);
        setSpreadsheets([]);
      }
    } catch (error) {
      console.error('Error fetching spreadsheets:', error);
      setSpreadsheets([]);
      alert(`Failed to load spreadsheets: ${error.message}`);
    }
  };

  const fetchSheets = async (spreadsheetId) => {
    if (!spreadsheetId) {
      console.warn('No spreadsheetId provided to fetchSheets');
      setSheets([]);
      return;
    }
    
    try {
      console.log('Fetching sheets for spreadsheet:', spreadsheetId);
      const response = await fetch(
        `/api/integrations/google-sheets/spreadsheets/${spreadsheetId}/sheets`,
        {
          credentials: 'include',
          cache: 'no-cache',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      console.log('Sheets response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch sheets:', response.status, errorText);
        throw new Error(`Failed to fetch sheets: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Sheets response data:', data);
      
      if (data.success && data.data && Array.isArray(data.data)) {
        console.log(`Setting ${data.data.length} sheets`);
        setSheets(data.data);
      } else if (Array.isArray(data.data)) {
        console.log(`Setting ${data.data.length} sheets (direct array)`);
        setSheets(data.data);
      } else {
        console.warn('No sheets data in response:', data);
        setSheets([]);
      }
    } catch (error) {
      console.error('Error fetching sheets:', error);
      setSheets([]);
      alert(`Failed to load sheets: ${error.message}`);
    }
  };

  const handleGoogleSheetsAuth = async () => {
    try {
      // Build return URL for redirect after OAuth
      const returnUrl = workflowId ? `/fullWorkflows/${workflowId}` : '/fullWorkflows';
      const authUrl = `/api/integrations/google-sheets/auth?returnUrl=${encodeURIComponent(returnUrl)}${workflowId ? `&workflowId=${workflowId}` : ''}`;
      
      const response = await fetch(authUrl, {
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to initiate auth' }));
        throw new Error(errorData.error || 'Failed to initiate auth');
      }
      const data = await response.json();
      if (data.authUrl) {
        // Redirect directly to OAuth (no popup)
        window.location.href = data.authUrl;
      } else {
        throw new Error('No auth URL received');
      }
    } catch (error) {
      console.error('Error initiating Google Sheets auth:', error);
      alert(`Failed to initiate Google Sheets authentication: ${error.message || 'Unknown error'}`);
    }
  };

  const handleGoogleSheetsDisconnect = async () => {
    try {
      const response = await fetch('/api/integrations/google-sheets', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to disconnect');
      setGoogleSheetsStatus({ connected: false });
      alert('Google Sheets disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting Google Sheets:', error);
      alert('Failed to disconnect Google Sheets');
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
      // Check if this is the selected node (for immediate updates)
      const isSelectedNode = nodeId === selectedNode.id;
      
      // Use selectedNode if it's the current node, otherwise use nodes array
      let node;
      if (isSelectedNode) {
        node = selectedNode;
      } else {
        node = nodes.find(n => n.id === nodeId);
      }
      
      if (!node || !node.data) return;
      
      // Use localData.output if this is the selected node and localData has output
      // Otherwise use node.data.output
      let output;
      if (isSelectedNode && localData.output !== undefined) {
        output = localData.output;
      } else {
        output = node.data.output;
      }
      
      if (!output) return;
      
      // Add node output
      variables.push({
        name: `${nodeId}.output`,
        path: `${nodeId}.output`,
        value: output,
        type: 'node-output',
        description: `Output from ${node.data.name || nodeId}`,
      });

      // Add nested fields if output is an object
      if (output && typeof output === 'object') {
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

          addNestedFields(output, `${nodeId}.output`);
        }
      }
    );

    // Add previous.output if there's exactly one previous node
    if (previousNodeIds.length === 1) {
      const prevNodeId = previousNodeIds[0];
      const isSelectedNode = prevNodeId === selectedNode.id;
      
      // Use selectedNode if it's the current node, otherwise use nodes array
      let prevNode;
      if (isSelectedNode) {
        prevNode = selectedNode;
      } else {
        prevNode = nodes.find(n => n.id === prevNodeId);
      }
      
      if (!prevNode || !prevNode.data) return variables;
      
      // Use localData.output if this is the selected node and localData has output
      // Otherwise use prevNode.data.output
      let output;
      if (isSelectedNode && localData.output !== undefined) {
        output = localData.output;
      } else {
        output = prevNode.data.output;
      }
      
      if (!output) return variables;
      
      variables.push({
        name: 'previous.output',
        path: 'previous.output',
        value: output,
        type: 'previous-output',
        description: 'Output from previous node',
      });

      if (
        typeof output === 'object' &&
        output !== null
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

        addNestedFields(output, 'previous.output');
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
    } else if (selectedNode && selectedNode.id === lastNodeIdRef.current) {
      // Update localData when selectedNode changes (e.g., after node update)
      // But preserve localData.output if it exists (for immediate updates)
      // Only update if selectedNode.data.output is different from localData.output
      setLocalData(prevData => {
        const newData = { ...selectedNode.data };
        // Preserve localData.output if it exists and is not null/undefined
        // This ensures that when a node is executed, the output is preserved
        if (prevData.output !== undefined && prevData.output !== null) {
          newData.output = prevData.output;
        }
        return newData;
      });
    }
  }, [selectedNode?.id]);

  const handleUpdate = (field, value) => {
    const newData = { ...localData, [field]: value };
    setLocalData(newData);
    if (onNodeUpdate) {
      onNodeUpdate(selectedNode.id, newData);
    }
  };

  // Get input data from all previous nodes
  const getInputData = () => {
    if (!selectedNode || !nodes || !edges) return null;

    const incomingEdges = edges.filter(edge => edge.target === selectedNode.id);
    if (incomingEdges.length === 0) return null;

    // Get all previous nodes with their outputs
    const previousNodes = incomingEdges.map(edge => {
      // Check if this is the selected node (for immediate updates)
      const isSelectedNode = edge.source === selectedNode.id;
      
      // Use selectedNode if it's the current node, otherwise use nodes array
      let node;
      if (isSelectedNode) {
        node = selectedNode;
      } else {
        node = nodes.find(n => n.id === edge.source);
      }
      
      if (!node) return null;
      
      // Use localData.output if this is the selected node and localData has output
      // Otherwise use node.data.output
      let output;
      if (isSelectedNode && localData.output !== undefined) {
        output = localData.output;
      } else {
        output = node.data?.output;
      }
      
      if (output === undefined || output === null) return null;

      // Get node type label
      const nodeTypeLabels = {
        'http-request': 'HTTP Request',
        'webhook': 'Webhook',
        'call-agent': 'Call Agent',
        'variable-set': 'Set Variable',
        'if': 'If Condition',
        'wait': 'Wait',
        'database-query': 'Database Query',
        'google-sheets': 'Google Sheets',
        'knowledge-base-query': 'Knowledge Base Query',
        'start': 'Start',
        'end': 'End',
      };

      return {
        nodeId: node.id,
        nodeType: node.type,
        nodeName: node.data?.name || nodeTypeLabels[node.type] || node.type,
        output: output,
      };
    }).filter(Boolean);

    if (previousNodes.length === 0) return null;

    // If only one node, return its output directly (backward compatibility)
    if (previousNodes.length === 1) {
      return previousNodes[0].output;
    }

    // If multiple nodes, return array of node outputs
    return previousNodes;
  };

  // Get output data from current node
  const getOutputData = () => {
    if (!selectedNode) return null;

    // Check localData first (for immediate updates), then node.data
    const output = localData.output !== undefined 
      ? localData.output 
      : selectedNode.data?.output;
    
    if (output === undefined || output === null) return null;

    return output;
  };

  // Force re-calculation of input/output data when nodes or localData changes
  // Use useMemo to ensure recalculation when dependencies change
  const inputData = useMemo(() => getInputData(), [localData, nodes, edges, selectedNode]);
  const outputData = useMemo(() => getOutputData(), [localData, selectedNode]);
  const availableVariables = useMemo(() => getAvailableVariables(), [localData, nodes, edges, selectedNode]);

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
            {/* Resource Dropdown */}
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
                Resource
              </label>
              <select
                value={localData.resource || 'Sheet Within Document'}
                onChange={e => handleUpdate('resource', e.target.value)}
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
                <option value="Document">Document</option>
                <option value="Sheet Within Document">Sheet Within Document</option>
              </select>
            </div>

            {/* Operation Dropdown */}
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
                Operation
              </label>
              <select
                value={localData.operation || ''}
                onChange={e => handleUpdate('operation', e.target.value)}
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
                {localData.resource === 'Document' ? (
                  <>
                    <option value="">Select operation...</option>
                    <option value="Create">Create</option>
                    <option value="Delete">Delete</option>
                  </>
                ) : (
                  <>
                    <option value="">Select operation...</option>
                    <option value="Append or Update Row">Append or Update Row</option>
                    <option value="Append Row">Append Row</option>
                    <option value="Update Row">Update Row</option>
                    <option value="Get Row(s)">Get Row(s)</option>
                    <option value="Delete Rows">Delete Rows</option>
                  </>
                )}
              </select>
            </div>

            {/* Document: Create */}
            {localData.resource === 'Document' &&
              localData.operation === 'Create' && (
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
                      Title
                    </label>
                    <VariableAutocomplete
                      value={localData.title || ''}
                      onChange={e => handleUpdate('title', e.target.value)}
                      availableVariables={availableVariables}
                      placeholder="My Report"
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
                      Initial Sheets
                    </label>
                    <div
                      style={{
                        background: '#2a2a2a',
                        border: '1px solid #333',
                        borderRadius: '8px',
                        padding: '0.75rem',
                      }}
                    >
                      {(localData.sheets || []).map((sheet, index) => (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            gap: '0.5rem',
                            marginBottom: '0.5rem',
                            alignItems: 'center',
                          }}
                        >
                          <input
                            type="text"
                            value={sheet.title || ''}
                            onChange={e => {
                              const newSheets = [...(localData.sheets || [])];
                              newSheets[index] = {
                                ...newSheets[index],
                                title: e.target.value,
                              };
                              handleUpdate('sheets', newSheets);
                            }}
                            placeholder="Sheet Title"
                            style={{
                              flex: 1,
                              padding: '0.5rem',
                              border: '1px solid #333',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              background: '#1a1a1a',
                              color: 'white',
                            }}
                          />
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              fontSize: '0.75rem',
                              color: '#94a3b8',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={sheet.hidden || false}
                              onChange={e => {
                                const newSheets = [...(localData.sheets || [])];
                                newSheets[index] = {
                                  ...newSheets[index],
                                  hidden: e.target.checked,
                                };
                                handleUpdate('sheets', newSheets);
                              }}
                            />
                            Hidden
                          </label>
                          <button
                            onClick={() => {
                              const newSheets = (localData.sheets || []).filter(
                                (_, i) => i !== index
                              );
                              handleUpdate('sheets', newSheets);
                            }}
                            style={{
                              background: '#ef4444',
                              border: 'none',
                              color: 'white',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const newSheets = [
                            ...(localData.sheets || []),
                            { title: '', hidden: false },
                          ];
                          handleUpdate('sheets', newSheets);
                        }}
                        style={{
                          background: '#3b82f6',
                          border: 'none',
                          color: 'white',
                          padding: '0.5rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          width: '100%',
                        }}
                      >
                        + Add Sheet
                      </button>
                    </div>
                  </div>
                </>
              )}

            {/* Sheet Within Document: All Operations */}
            {localData.resource === 'Sheet Within Document' &&
              localData.operation && (
                <>
                  {/* Document Selection */}
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
                      Document
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <select
                        value={localData.spreadsheetId || ''}
                        onChange={e => {
                          handleUpdate('spreadsheetId', e.target.value);
                          if (e.target.value) {
                            fetchSheets(e.target.value);
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          border: '1px solid #333',
                          borderRadius: '8px',
                          fontSize: '0.875rem',
                          background: '#2a2a2a',
                          color: 'white',
                        }}
                      >
                        <option value="">Select document...</option>
                        {spreadsheets.map(spreadsheet => (
                          <option key={spreadsheet.id} value={spreadsheet.id}>
                            {spreadsheet.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={async () => {
                          await fetchSpreadsheets();
                          setShowSpreadsheetModal(true);
                        }}
                        style={{
                          background: '#3b82f6',
                          border: 'none',
                          color: 'white',
                          padding: '0.5rem 1rem',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                        }}
                      >
                        Choose...
                      </button>
                    </div>
                  </div>

                  {/* Sheet Selection */}
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
                      Sheet
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <select
                        value={localData.sheetName || ''}
                        onChange={e => handleUpdate('sheetName', e.target.value)}
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          border: '1px solid #333',
                          borderRadius: '8px',
                          fontSize: '0.875rem',
                          background: '#2a2a2a',
                          color: 'white',
                        }}
                      >
                        <option value="">Select sheet...</option>
                        {sheets && sheets.length > 0 ? (
                          sheets.map(sheet => (
                            <option key={sheet.sheetId || sheet.id} value={sheet.title || sheet.name}>
                              {sheet.title || sheet.name}
                            </option>
                          ))
                        ) : (
                          <option value="">No sheets available</option>
                        )}
                      </select>
                      <button
                        onClick={async () => {
                          if (localData.spreadsheetId) {
                            await fetchSheets(localData.spreadsheetId);
                            setShowSheetModal(true);
                          }
                        }}
                        disabled={!localData.spreadsheetId}
                        style={{
                          background: localData.spreadsheetId
                            ? '#3b82f6'
                            : '#4a5568',
                          border: 'none',
                          color: 'white',
                          padding: '0.5rem 1rem',
                          borderRadius: '8px',
                          cursor: localData.spreadsheetId
                            ? 'pointer'
                            : 'not-allowed',
                          fontSize: '0.75rem',
                        }}
                      >
                        Choose...
                      </button>
                    </div>
                  </div>

                  {/* Append or Update Row */}
                  {localData.operation === 'Append or Update Row' && (
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
                          Unique Column
                        </label>
                        <VariableAutocomplete
                          value={localData.uniqueColumn || ''}
                          onChange={e =>
                            handleUpdate('uniqueColumn', e.target.value)
                          }
                          availableVariables={availableVariables}
                          placeholder="Email or ID or col_3"
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
                          Unique Value
                        </label>
                        <VariableAutocomplete
                          value={localData.uniqueValue || ''}
                          onChange={e =>
                            handleUpdate('uniqueValue', e.target.value)
                          }
                          availableVariables={availableVariables}
                          placeholder="john@example.com or {{email}}"
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
                          Values to Set (JSON Object)
                        </label>
                        <VariableAutocomplete
                          value={
                            typeof localData.valuesToSet === 'string'
                              ? localData.valuesToSet
                              : JSON.stringify(localData.valuesToSet || {}, null, 2)
                          }
                          onChange={e => {
                            try {
                              const parsed = JSON.parse(e.target.value);
                              handleUpdate('valuesToSet', parsed);
                            } catch {
                              handleUpdate('valuesToSet', e.target.value);
                            }
                          }}
                          availableVariables={availableVariables}
                          placeholder='{"Status": "Contacted", "Name": "{{name}}"}'
                          multiline
                        />
                      </div>
                      <div style={{ marginBottom: '1rem' }}>
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.875rem',
                            color: 'white',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={localData.appendIfNotFound !== false}
                            onChange={e =>
                              handleUpdate('appendIfNotFound', e.target.checked)
                            }
                          />
                          Append if not found
                        </label>
                      </div>
                    </>
                  )}

                  {/* Append Row */}
                  {localData.operation === 'Append Row' && (
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
                        value={
                          typeof localData.valuesToSet === 'string'
                            ? localData.valuesToSet
                            : JSON.stringify(localData.valuesToSet || [], null, 2)
                        }
                        onChange={e => {
                          try {
                            const parsed = JSON.parse(e.target.value);
                            handleUpdate('valuesToSet', parsed);
                          } catch {
                            handleUpdate('valuesToSet', e.target.value);
                          }
                        }}
                        availableVariables={availableVariables}
                        placeholder='["Value1", "Value2", "Value3"]'
                        multiline
                      />
                    </div>
                  )}

                  {/* Update Row */}
                  {localData.operation === 'Update Row' && (
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
                          Row Index (1-based)
                        </label>
                        <VariableAutocomplete
                          value={localData.rowIndex || ''}
                          onChange={e => handleUpdate('rowIndex', e.target.value)}
                          availableVariables={availableVariables}
                          placeholder="2 or {{rowIndex}}"
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
                          value={
                            typeof localData.valuesToSet === 'string'
                              ? localData.valuesToSet
                              : JSON.stringify(localData.valuesToSet || [], null, 2)
                          }
                          onChange={e => {
                            try {
                              const parsed = JSON.parse(e.target.value);
                              handleUpdate('valuesToSet', parsed);
                            } catch {
                              handleUpdate('valuesToSet', e.target.value);
                            }
                          }}
                          availableVariables={availableVariables}
                          placeholder='["Value1", "Value2", "Value3"]'
                          multiline
                        />
                      </div>
                    </>
                  )}

                  {/* Get Row(s) */}
                  {localData.operation === 'Get Row(s)' && (
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
                          Filters
                        </label>
                        <div
                          style={{
                            background: '#2a2a2a',
                            border: '1px solid #333',
                            borderRadius: '8px',
                            padding: '0.75rem',
                          }}
                        >
                          {(localData.filters || []).map((filter, index) => (
                            <div
                              key={index}
                              style={{
                                display: 'flex',
                                gap: '0.5rem',
                                marginBottom: '0.5rem',
                                alignItems: 'center',
                              }}
                            >
                              <VariableAutocomplete
                                value={filter.column || ''}
                                onChange={e => {
                                  const newFilters = [...(localData.filters || [])];
                                  newFilters[index] = {
                                    ...newFilters[index],
                                    column: e.target.value,
                                  };
                                  handleUpdate('filters', newFilters);
                                }}
                                availableVariables={availableVariables}
                                placeholder="Column name"
                                style={{ flex: 1 }}
                              />
                              <VariableAutocomplete
                                value={filter.value || ''}
                                onChange={e => {
                                  const newFilters = [...(localData.filters || [])];
                                  newFilters[index] = {
                                    ...newFilters[index],
                                    value: e.target.value,
                                  };
                                  handleUpdate('filters', newFilters);
                                }}
                                availableVariables={availableVariables}
                                placeholder="Value"
                                style={{ flex: 1 }}
                              />
                              <button
                                onClick={() => {
                                  const newFilters = (localData.filters || []).filter(
                                    (_, i) => i !== index
                                  );
                                  handleUpdate('filters', newFilters);
                                }}
                                style={{
                                  background: '#ef4444',
                                  border: 'none',
                                  color: 'white',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              const newFilters = [
                                ...(localData.filters || []),
                                { column: '', value: '' },
                              ];
                              handleUpdate('filters', newFilters);
                            }}
                            style={{
                              background: '#3b82f6',
                              border: 'none',
                              color: 'white',
                              padding: '0.5rem',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              width: '100%',
                            }}
                          >
                            + Add Filter
                          </button>
                        </div>
                      </div>
                      {localData.filters && localData.filters.length > 0 && (
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
                            Combine Filters
                          </label>
                          <select
                            value={localData.combineFilters || 'AND'}
                            onChange={e =>
                              handleUpdate('combineFilters', e.target.value)
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
                            <option value="AND">AND</option>
                            <option value="OR">OR</option>
                          </select>
                        </div>
                      )}
                    </>
                  )}

                  {/* Delete Rows */}
                  {localData.operation === 'Delete Rows' && (
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
                        Row Indices (JSON Array, 1-based)
                      </label>
                      <VariableAutocomplete
                        value={
                          typeof localData.rowIndices === 'string'
                            ? localData.rowIndices
                            : JSON.stringify(localData.rowIndices || [], null, 2)
                        }
                        onChange={e => {
                          try {
                            const parsed = JSON.parse(e.target.value);
                            handleUpdate('rowIndices', parsed);
                          } catch {
                            handleUpdate('rowIndices', e.target.value);
                          }
                        }}
                        availableVariables={availableVariables}
                        placeholder='[2, 3, 5]'
                        multiline
                      />
                    </div>
                  )}
                </>
              )}
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

      case 'google-sheets-trigger':
        return (
          <>
            {/* Poll Time */}
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
                Poll Time
              </label>
              <select
                value={localData.pollTime || '1 minute'}
                onChange={e => handleUpdate('pollTime', e.target.value)}
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
                <option value="1 minute">Every minute</option>
                <option value="15 minutes">Every 15 minutes</option>
                <option value="30 minutes">Every 30 minutes</option>
                <option value="1 hour">Every hour</option>
                <option value="3 hours">Every 3 hours</option>
                <option value="12 hours">Every 12 hours</option>
                <option value="24 hours">Every 24 hours</option>
              </select>
            </div>

            {/* Document Selection */}
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
                Document
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select
                  value={localData.spreadsheetId || ''}
                  onChange={async e => {
                    const newSpreadsheetId = e.target.value;
                    handleUpdate('spreadsheetId', newSpreadsheetId);
                    if (newSpreadsheetId) {
                      console.log('Spreadsheet selected, fetching sheets:', newSpreadsheetId);
                      await fetchSheets(newSpreadsheetId);
                    } else {
                      setSheets([]);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    background: '#2a2a2a',
                    color: 'white',
                  }}
                >
                  <option value="">Select document...</option>
                  {spreadsheets && spreadsheets.length > 0 ? (
                    spreadsheets.map(spreadsheet => (
                      <option key={spreadsheet.id} value={spreadsheet.id}>
                        {spreadsheet.name}
                      </option>
                    ))
                  ) : (
                    <option value="">No spreadsheets available</option>
                  )}
                </select>
                <button
                  onClick={async () => {
                    await fetchSpreadsheets();
                    setShowSpreadsheetModal(true);
                  }}
                  style={{
                    background: '#3b82f6',
                    border: 'none',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  Choose...
                </button>
              </div>
            </div>

            {/* Sheet Selection */}
            {localData.spreadsheetId && (
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
                  Sheet
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select
                    value={localData.sheetName || ''}
                    onChange={e => handleUpdate('sheetName', e.target.value)}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: '1px solid #333',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      background: '#2a2a2a',
                      color: 'white',
                    }}
                  >
                    <option value="">Select sheet...</option>
                    {sheets && sheets.length > 0 ? (
                      sheets.map(sheet => (
                        <option key={sheet.sheetId || sheet.id} value={sheet.title || sheet.name}>
                          {sheet.title || sheet.name}
                        </option>
                      ))
                    ) : (
                      <option value="">No sheets available</option>
                    )}
                  </select>
                  <button
                    onClick={async () => {
                      if (localData.spreadsheetId) {
                        await fetchSheets(localData.spreadsheetId);
                        setShowSheetModal(true);
                      }
                    }}
                    disabled={!localData.spreadsheetId}
                    style={{
                      background: localData.spreadsheetId
                        ? '#3b82f6'
                        : '#4a5568',
                      border: 'none',
                      color: 'white',
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      cursor: localData.spreadsheetId
                        ? 'pointer'
                        : 'not-allowed',
                      fontSize: '0.75rem',
                    }}
                  >
                    Choose...
                  </button>
                </div>
              </div>
            )}

            {/* Trigger On */}
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
                Trigger On
              </label>
              <select
                value={localData.triggerOn || 'Row added or updated'}
                onChange={e => handleUpdate('triggerOn', e.target.value)}
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
                <option value="Row added or updated">Row added or updated</option>
              </select>
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
          {selectedNode?.type === 'google-sheets' ? (
            <>
              <span style={{ fontSize: '1.25rem' }}>📊</span>
              <span style={{ fontWeight: 600 }}>Google Sheets</span>
            </>
          ) : selectedNode?.type === 'google-sheets-trigger' ? (
            <>
              <span style={{ fontSize: '1.25rem' }}>📊</span>
              <span style={{ fontWeight: 600 }}>Google Sheets Trigger</span>
            </>
          ) : selectedNode?.type === 'start' ? (
            <>
              <span style={{ fontSize: '1.25rem' }}>🚀</span>
              <span style={{ fontWeight: 600 }}>Manual Trigger</span>
            </>
          ) : (
            <>
              <span>✏️</span>
              <span style={{ fontWeight: 600 }}>
                {selectedNode?.type || 'Node'}
              </span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
                      node: { ...selectedNode, data: { ...selectedNode.data, ...localData } },
                      nodes: nodes.map(n => 
                        n.id === selectedNode.id 
                          ? { ...n, data: { ...n.data, ...localData } }
                          : n
                      ),
                      edges,
                      input: inputData || {},
                    }),
                  }
                );
                const result = await response.json();
                if (result.success && result.data?.output) {
                  // Update node with output - use both localData and onNodeUpdate
                  const newOutput = result.data.output;
                  
                  // Update localData first for immediate UI update
                  // Use functional update to ensure we get the latest state
                  setLocalData(prev => {
                    const updated = { ...prev, output: newOutput, status: 'success' };
                    return updated;
                  });
                  
                  // Then update via onNodeUpdate to propagate to parent
                  // This will update the nodes array and selectedNode
                  handleUpdate('output', newOutput);
                  handleUpdate('status', 'success');
                  
                  // Force a re-render by updating selectedNode reference
                  // This ensures getInputData() sees the updated output
                  if (onNodeUpdate) {
                    onNodeUpdate(selectedNode.id, { output: newOutput, status: 'success' });
                  }
                } else {
                  setLocalData(prev => ({ ...prev, status: 'failed' }));
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
                {/* Check if inputData is an array (multiple nodes) or object (single node) */}
                {Array.isArray(inputData) ? (
                  // Multiple nodes - display each one separately
                  <>
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
                    {inputData.map((nodeData, index) => (
                      <div
                        key={nodeData.nodeId || index}
                        style={{
                          marginBottom: index < inputData.length - 1 ? '1.5rem' : 0,
                          paddingBottom: index < inputData.length - 1 ? '1.5rem' : 0,
                          borderBottom:
                            index < inputData.length - 1
                              ? '1px solid #333'
                              : 'none',
                        }}
                      >
                        <div
                          style={{
                            marginBottom: '0.5rem',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'white',
                          }}
                        >
                          {nodeData.nodeName}
                        </div>
                        <div
                          style={{
                            marginBottom: '0.5rem',
                            fontSize: '0.75rem',
                            color: '#94a3b8',
                          }}
                        >
                          Preview: The fields below come from the last successful
                          execution. Execute node to refresh them.
                        </div>
                        {inputView === 'table' ? (
                          <>
                            {renderTable(nodeData.output)}
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
                              {renderNestedFields(nodeData.output)}
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
                            {JSON.stringify(nodeData.output, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </>
                ) : (
                  // Single node - display as before
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
                {selectedNode?.type === 'google-sheets' || selectedNode?.type === 'google-sheets-trigger' ? (
                  <>
                    {/* Google Sheets OAuth Configuration */}
                    <div style={{ marginBottom: '2rem' }}>
                      <div
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'white',
                          marginBottom: '1rem',
                        }}
                      >
                        Google Sheets Connection
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: '#94a3b8',
                          marginBottom: '1rem',
                        }}
                      >
                        Connect your Google account to access Google Sheets
                      </div>
                      {googleSheetsStatus?.connected ? (
                        <div
                          style={{
                            padding: '1rem',
                            background: '#2a2a2a',
                            borderRadius: '8px',
                            border: '1px solid #10b981',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              marginBottom: '0.5rem',
                            }}
                          >
                            <span style={{ color: '#10b981', fontSize: '1.25rem' }}>
                              ✓
                            </span>
                            <span
                              style={{
                                color: '#10b981',
                                fontWeight: 600,
                                fontSize: '0.875rem',
                              }}
                            >
                              Connected
                            </span>
                          </div>
                          {googleSheetsStatus.email && (
                            <div
                              style={{
                                fontSize: '0.75rem',
                                color: '#94a3b8',
                                marginBottom: '0.5rem',
                              }}
                            >
                              Account: {googleSheetsStatus.email}
                            </div>
                          )}
                          <button
                            onClick={handleGoogleSheetsDisconnect}
                            style={{
                              background: '#ef4444',
                              border: 'none',
                              color: 'white',
                              padding: '0.5rem 1rem',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                            }}
                          >
                            Disconnect
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={handleGoogleSheetsAuth}
                          style={{
                            background: '#4285f4',
                            border: 'none',
                            color: 'white',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          <span>🔗</span>
                          <span>Connect Google Account</span>
                        </button>
                      )}
                    </div>
                  </>
                ) : selectedNode?.type === 'call-agent' ? (
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
              <div style={{ color: '#94a3b8', padding: '1rem' }}>
                {selectedNode?.type === 'google-sheets' ? (
                  <div>
                    <h3 style={{ color: 'white', marginBottom: '1rem' }}>
                      Google Sheets Node Documentation
                    </h3>
                    <div style={{ marginBottom: '1rem' }}>
                      <h4 style={{ color: 'white', marginBottom: '0.5rem' }}>
                        Resources
                      </h4>
                      <ul style={{ paddingLeft: '1.5rem', color: '#94a3b8' }}>
                        <li>
                          <strong>Document:</strong> Create or delete entire
                          spreadsheets
                        </li>
                        <li>
                          <strong>Sheet Within Document:</strong> Work with
                          individual sheets within a spreadsheet
                        </li>
                      </ul>
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                      <h4 style={{ color: 'white', marginBottom: '0.5rem' }}>
                        Operations
                      </h4>
                      <ul style={{ paddingLeft: '1.5rem', color: '#94a3b8' }}>
                        <li>
                          <strong>Create:</strong> Create a new spreadsheet with
                          optional initial sheets
                        </li>
                        <li>
                          <strong>Append or Update Row:</strong> Smart operation
                          that searches for a unique identifier and updates if
                          found, appends if not found
                        </li>
                        <li>
                          <strong>Append Row:</strong> Add a new row to the end
                          of a sheet
                        </li>
                        <li>
                          <strong>Update Row:</strong> Update an existing row by
                          row index
                        </li>
                        <li>
                          <strong>Get Row(s):</strong> Retrieve rows with
                          optional filters (AND/OR)
                        </li>
                        <li>
                          <strong>Delete Rows:</strong> Delete rows by their
                          indices
                        </li>
                      </ul>
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                      <h4 style={{ color: 'white', marginBottom: '0.5rem' }}>
                        Variables
                      </h4>
                      <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                        You can use variables from previous nodes in any field
                        using {'{{variableName}}'} syntax. For example:{' '}
                        {'{{httpResponse.data.email}}'} or {'{{userId}}'}.
                      </p>
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                      <h4 style={{ color: 'white', marginBottom: '0.5rem' }}>
                        Authentication
                      </h4>
                      <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                        Connect your Google account in the Settings tab to
                        access Google Sheets. Once connected, you can select
                        spreadsheets and sheets from your account.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>Documentation</div>
                )}
              </div>
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

      {/* Spreadsheet Selection Modal */}
      {showSpreadsheetModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowSpreadsheetModal(false)}
        >
          <div
            style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '12px',
              padding: '1.5rem',
              width: '90%',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}
            >
              <h3 style={{ color: 'white', margin: 0 }}>Select Spreadsheet</h3>
              <button
                onClick={() => setShowSpreadsheetModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              {spreadsheets.map(spreadsheet => (
                <button
                  key={spreadsheet.id}
                  onClick={() => {
                    handleUpdate('spreadsheetId', spreadsheet.id);
                    fetchSheets(spreadsheet.id);
                    setShowSpreadsheetModal(false);
                  }}
                  style={{
                    background: '#2a2a2a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    padding: '1rem',
                    color: 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.target.style.background = '#333';
                  }}
                  onMouseLeave={e => {
                    e.target.style.background = '#2a2a2a';
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                    {spreadsheet.name}
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#94a3b8',
                    }}
                  >
                    ID: {spreadsheet.id}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sheet Selection Modal */}
      {showSheetModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowSheetModal(false)}
        >
          <div
            style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '12px',
              padding: '1.5rem',
              width: '90%',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}
            >
              <h3 style={{ color: 'white', margin: 0 }}>Select Sheet</h3>
              <button
                onClick={() => setShowSheetModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              {sheets && sheets.length > 0 ? (
                sheets.map(sheet => (
                  <button
                    key={sheet.sheetId || sheet.id}
                    onClick={() => {
                      handleUpdate('sheetName', sheet.title || sheet.name);
                      setShowSheetModal(false);
                    }}
                  style={{
                    background: '#2a2a2a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    padding: '1rem',
                    color: 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.target.style.background = '#333';
                  }}
                  onMouseLeave={e => {
                    e.target.style.background = '#2a2a2a';
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                    {sheet.title || sheet.name}
                  </div>
                  {sheet.hidden && (
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: '#94a3b8',
                      }}
                    >
                      Hidden
                    </div>
                  )}
                </button>
                ))
              ) : (
                <div style={{ padding: '1rem', color: '#999', textAlign: 'center' }}>
                  No sheets available
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
