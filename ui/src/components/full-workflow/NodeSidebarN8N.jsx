import { useNodeSidebarViewModel } from '../../viewmodels/useNodeSidebarViewModel.js';
import InputPanel from './sidebar/InputPanel.jsx';
import OutputPanel from './sidebar/OutputPanel.jsx';
import NodeConfigFactory from './sidebar/NodeConfigFactory.jsx';
import SettingsTab from './sidebar/SettingsTab.jsx';
import DocsTab from './sidebar/DocsTab.jsx';
import { nodeExecutionService } from '../../services/nodeExecution.service.js';
import { googleSheetsService } from '../../services/googleSheets.service.js';

/**
 * n8n-style Node Sidebar with INPUT/OUTPUT Panels
 * Refactored version using ViewModel architecture
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
  // Use ViewModel for all business logic
  const viewModel = useNodeSidebarViewModel(
    selectedNode,
    nodes,
    edges,
    onNodeUpdate
  );

  const {
    activeTab,
    setActiveTab,
    outputView,
    setOutputView,
    inputView,
    setInputView,
    localData,
    setLocalData,
    handleUpdate,
    executingSingleNode,
    setExecutingSingleNode,
    draggedVariable,
    setDraggedVariable,
    knowledgeBaseEntries,
    workflows,
    googleSheets,
    availableVariables,
    inputData,
    outputData,
  } = viewModel;

  // Handle drop on input field
  const handleDrop = (e, variableExpression) => {
    e.preventDefault();
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

  // Handle Google Sheets authentication
  const handleGoogleSheetsAuth = async () => {
    try {
      // Build return URL for redirect after OAuth
      const returnUrl = workflowId
        ? `/fullWorkflows/${workflowId}`
        : '/fullWorkflows';
      const authUrl = `/api/integrations/google-sheets/auth?returnUrl=${encodeURIComponent(returnUrl)}${workflowId ? `&workflowId=${workflowId}` : ''}`;

      const response = await fetch(authUrl, {
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Failed to initiate auth' }));
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
      alert(
        `Failed to initiate Google Sheets authentication: ${error.message || 'Unknown error'}`
      );
    }
  };

  // Handle Google Sheets disconnect
  const handleGoogleSheetsDisconnect = async () => {
    try {
      await googleSheets.disconnect();
      googleSheets.fetchStatus(); // Refresh status
      alert('Google Sheets disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting Google Sheets:', error);
      alert('Failed to disconnect Google Sheets: ' + error.message);
    }
  };

  // Handle single node execution
  const handleExecuteNode = async () => {
    if (!selectedNode) return;
    setExecutingSingleNode(true);
    try {
      const result = await nodeExecutionService.executeNode(
        { ...selectedNode, data: { ...selectedNode.data, ...localData } },
        edges,
        inputData || {}
      );
      if (result.success && result.data?.output) {
        const newOutput = result.data.output;
        setLocalData(prev => ({
          ...prev,
          output: newOutput,
          status: 'success',
        }));
        handleUpdate('output', newOutput);
        handleUpdate('status', 'success');
        if (onNodeUpdate) {
          onNodeUpdate(selectedNode.id, {
            output: newOutput,
            status: 'success',
          });
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
  };

  // Get node type display info
  const getNodeTypeDisplay = () => {
    const type = selectedNode?.type;
    if (type === 'google-sheets') {
      return { icon: '📊', label: 'Google Sheets' };
    } else if (type === 'google-sheets-trigger') {
      return { icon: '📊', label: 'Google Sheets Trigger' };
    } else if (type === 'start') {
      return { icon: '🚀', label: 'Manual Trigger' };
    }
    return { icon: '✏️', label: type || 'Node' };
  };

  if (!selectedNode) {
    return null;
  }

  const nodeDisplay = getNodeTypeDisplay();

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
          <span style={{ fontSize: '1.25rem' }}>{nodeDisplay.icon}</span>
          <span style={{ fontWeight: 600 }}>{nodeDisplay.label}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={handleExecuteNode}
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
          <InputPanel
            inputData={inputData}
            availableVariables={availableVariables}
            selectedNode={selectedNode}
            edges={edges}
            onDragStart={(e, variableExpression) => {
              setDraggedVariable(variableExpression);
              e.dataTransfer.setData('text/plain', variableExpression);
            }}
          />
        </div>

        {/* CENTER Panel - Node Configuration */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '1rem',
            background: '#1a1a1a',
          }}
        >
          {activeTab === 'parameters' && (
            <NodeConfigFactory
              nodeType={selectedNode.type}
              localData={localData}
              handleUpdate={handleUpdate}
              availableVariables={availableVariables}
              knowledgeBaseEntries={knowledgeBaseEntries}
              workflows={workflows}
              workflowId={workflowId}
              spreadsheets={googleSheets.spreadsheets || []}
              sheets={googleSheets.sheets || []}
              columns={googleSheets.columns || []}
              fetchSheets={googleSheets.fetchSheets}
              fetchSpreadsheets={googleSheets.fetchSpreadsheets}
              fetchColumns={googleSheets.fetchColumns}
              setShowSpreadsheetModal={viewModel.setShowSpreadsheetModal}
              setShowSheetModal={viewModel.setShowSheetModal}
              handleDrop={handleDrop}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsTab
              nodeType={selectedNode.type}
              localData={localData}
              handleUpdate={handleUpdate}
              googleSheets={googleSheets}
              knowledgeBaseEntries={knowledgeBaseEntries}
              onGoogleSheetsAuth={handleGoogleSheetsAuth}
              onGoogleSheetsDisconnect={handleGoogleSheetsDisconnect}
            />
          )}
          {activeTab === 'docs' && <DocsTab nodeType={selectedNode.type} />}
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
              fontWeight: 600,
            }}
          >
            OUTPUT
          </div>
          <OutputPanel outputData={outputData} />
        </div>
      </div>

      {/* Spreadsheet Selection Modal */}
      {viewModel.showSpreadsheetModal && (
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
          onClick={() => viewModel.setShowSpreadsheetModal(false)}
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
                onClick={() => viewModel.setShowSpreadsheetModal(false)}
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
              {(googleSheets.spreadsheets || []).map(spreadsheet => (
                <button
                  key={spreadsheet.id}
                  onClick={() => {
                    handleUpdate('spreadsheetId', spreadsheet.id);
                    googleSheets.fetchSheets(spreadsheet.id);
                    viewModel.setShowSpreadsheetModal(false);
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
      {viewModel.showSheetModal && (
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
          onClick={() => viewModel.setShowSheetModal(false)}
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
                onClick={() => viewModel.setShowSheetModal(false)}
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
              {(googleSheets.sheets || []).length > 0 ? (
                (googleSheets.sheets || []).map(sheet => (
                  <button
                    key={sheet.sheetId || sheet.id}
                    onClick={() => {
                      handleUpdate('sheetName', sheet.title || sheet.name);
                      viewModel.setShowSheetModal(false);
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
                <div
                  style={{
                    padding: '1rem',
                    color: '#999',
                    textAlign: 'center',
                  }}
                >
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
