import { useState } from 'react';
import { useNodeSidebarViewModel } from '../../viewmodels/useNodeSidebarViewModel.js';
import InputPanel from './sidebar/InputPanel.jsx';
import OutputPanel from './sidebar/OutputPanel.jsx';
import NodeConfigFactory from './sidebar/NodeConfigFactory.jsx';
import SettingsTab from './sidebar/SettingsTab.jsx';
import DocsTab from './sidebar/DocsTab.jsx';
import TestingTab from './sidebar/TestingTab.jsx';
import { nodeExecutionService } from '../../services/nodeExecution.service.js';
import { googleSheetsService } from '../../services/googleSheets.service.js';
import { useHubspot } from '../../hooks/useHubspot.js';
import { fetchWithCSRF } from '../../utils/csrf.utils.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Play, Trash2, X, Loader2, Sheet, Rocket } from 'lucide-react';

/**
 * n8n-style Node Sidebar with INPUT/OUTPUT Panels
 * 3-Column Layout: Input (left) | Config (center) | Output (right)
 * Centered overlay
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

  // HubSpot integration hook (for both hubspot and hubspot-trigger nodes)
  const hubspot = useHubspot(
    selectedNode?.type === 'hubspot' || selectedNode?.type === 'hubspot-trigger'
  );

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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
      const returnUrl = workflowId
        ? `/fullWorkflows/${workflowId}`
        : '/fullWorkflows';
      const authUrl = `/api/integrations/google-sheets/auth?returnUrl=${encodeURIComponent(returnUrl)}${workflowId ? `&workflowId=${workflowId}` : ''}`;

      const response = await fetchWithCSRF(authUrl);
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Failed to initiate auth' }));
        throw new Error(errorData.error || 'Failed to initiate auth');
      }
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('No auth URL received');
      }
    } catch (error) {
      console.error('Error initiating Google Sheets auth:', error);
      toast.error(
        `Failed to initiate Google Sheets authentication: ${error.message || 'Unknown error'}`
      );
    }
  };

  // Handle Google Sheets disconnect
  const handleGoogleSheetsDisconnect = async () => {
    try {
      await googleSheets.disconnect();
      googleSheets.fetchStatus();
      toast.success('Google Sheets disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting Google Sheets:', error);
      toast.error('Failed to disconnect Google Sheets: ' + error.message);
    }
  };

  // Handle HubSpot authentication
  const handleHubspotAuth = async () => {
    try {
      const returnUrl = workflowId
        ? `/fullWorkflows/${workflowId}`
        : '/fullWorkflows';
      await hubspot.authenticate(returnUrl, workflowId);
    } catch (error) {
      console.error('Error initiating HubSpot auth:', error);
      toast.error(
        `Failed to initiate HubSpot authentication: ${error.message || 'Unknown error'}`
      );
    }
  };

  // Handle HubSpot disconnect
  const handleHubspotDisconnect = async () => {
    try {
      await hubspot.disconnect();
      hubspot.fetchStatus();
      toast.success('HubSpot disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting HubSpot:', error);
      toast.error('Failed to disconnect HubSpot: ' + error.message);
    }
  };

  // Handle single node execution
  const handleExecuteNode = async () => {
    if (!selectedNode) return;
    setExecutingSingleNode(true);
    try {
      // Remove output and status from node data before sending to backend
      // (they can be very large and cause 413 errors, and are not used by the backend)
      const { output, status, ...nodeDataWithoutOutput } = {
        ...selectedNode.data,
        ...localData,
      };
      const nodeToExecute = {
        ...selectedNode,
        data: nodeDataWithoutOutput,
      };

      const result = await nodeExecutionService.executeNode(
        nodeToExecute,
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
        toast.success('Node executed successfully');
      } else {
        setLocalData(prev => ({ ...prev, status: 'failed' }));
        handleUpdate('status', 'failed');
        toast.error(result.error || 'Failed to execute node');
      }
    } catch (error) {
      handleUpdate('status', 'failed');
      toast.error('Error executing node: ' + error.message);
    } finally {
      setExecutingSingleNode(false);
    }
  };

  // Get node type display info
  const getNodeTypeDisplay = () => {
    const type = selectedNode?.type;
    if (type === 'google-sheets') {
      return { icon: <Sheet className="w-5 h-5" />, label: 'Google Sheets' };
    } else if (type === 'google-sheets-trigger') {
      return {
        icon: <Sheet className="w-5 h-5" />,
        label: 'Google Sheets Trigger',
      };
    } else if (type === 'start') {
      return { icon: <Rocket className="w-5 h-5" />, label: 'Manual Trigger' };
    }
    return { icon: null, label: type || 'Node' };
  };

  if (!selectedNode) {
    return null;
  }

  const nodeDisplay = getNodeTypeDisplay();

  return (
    <>
      {/* 3-Column Sidebar Layout - Centered Overlay (no backdrop to avoid conflicts with modals) */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90vw',
          maxWidth: '1000px',
          height: '85vh',
          maxHeight: '800px',
          zIndex: 100,
          display: 'flex',
          background: 'hsl(var(--card))',
          borderRadius: '0.75rem',
          border: '1px solid hsl(var(--border))',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* INPUT Panel (Left - 250px) */}
        <div
          style={{
            width: '250px',
            borderRight: '1px solid hsl(var(--border))',
            display: 'flex',
            flexDirection: 'column',
            background: 'hsl(var(--muted))',
          }}
        >
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'hsl(var(--card))',
              borderBottom: '1px solid hsl(var(--border))',
              fontWeight: 600,
              fontSize: '0.875rem',
              color: 'hsl(var(--foreground))',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            INPUT
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
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
        </div>

        {/* CENTER Panel - Node Configuration (flex: 1) */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'hsl(var(--card))',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '1rem',
              borderBottom: '1px solid hsl(var(--border))',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {nodeDisplay.icon}
              <span
                style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}
              >
                {nodeDisplay.label}
              </span>
            </div>
            <div
              style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
            >
              <Button
                size="sm"
                onClick={handleExecuteNode}
                disabled={executingSingleNode}
                variant="default"
              >
                {executingSingleNode ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Execute
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 mr-1" />
                    Execute
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
                style={{ padding: '0.25rem 0.5rem' }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div
              style={{
                padding: '0 1rem',
                borderBottom: '1px solid hsl(var(--border))',
              }}
            >
              <TabsList
                className={`grid w-full ${selectedNode?.type === 'call-agent' ? 'grid-cols-4' : 'grid-cols-3'} bg-transparent`}
              >
                <TabsTrigger value="parameters">Parameters</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                {selectedNode?.type === 'call-agent' && (
                  <TabsTrigger value="testing">Testing</TabsTrigger>
                )}
                <TabsTrigger value="docs">Docs</TabsTrigger>
              </TabsList>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
              <TabsContent value="parameters" className="mt-0">
                <NodeConfigFactory
                  nodeType={selectedNode.type}
                  localData={localData}
                  handleUpdate={handleUpdate}
                  availableVariables={availableVariables}
                  onDrop={handleDrop}
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
                  nodes={nodes}
                  currentNodeId={selectedNode?.id}
                  hubspot={hubspot}
                />
              </TabsContent>

              <TabsContent value="settings" className="mt-0">
                <SettingsTab
                  nodeType={selectedNode.type}
                  localData={localData}
                  handleUpdate={handleUpdate}
                  googleSheets={googleSheets}
                  knowledgeBaseEntries={knowledgeBaseEntries}
                  onGoogleSheetsAuth={handleGoogleSheetsAuth}
                  onGoogleSheetsDisconnect={handleGoogleSheetsDisconnect}
                  hubspot={hubspot}
                  onHubspotAuth={handleHubspotAuth}
                  onHubspotDisconnect={handleHubspotDisconnect}
                />
              </TabsContent>

              {selectedNode?.type === 'call-agent' && (
                <TabsContent value="testing" className="mt-0">
                  <TestingTab
                    localData={localData}
                    handleUpdate={handleUpdate}
                  />
                </TabsContent>
              )}

              <TabsContent value="docs" className="mt-0">
                <DocsTab nodeType={selectedNode.type} />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* OUTPUT Panel (Right - 250px) */}
        <div
          style={{
            width: '250px',
            borderLeft: '1px solid hsl(var(--border))',
            display: 'flex',
            flexDirection: 'column',
            background: 'hsl(var(--muted))',
          }}
        >
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'hsl(var(--card))',
              borderBottom: '1px solid hsl(var(--border))',
              fontWeight: 600,
              fontSize: '0.875rem',
              color: 'hsl(var(--foreground))',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            OUTPUT
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <OutputPanel
              outputData={outputData}
              outputView={outputView}
              setOutputView={setOutputView}
              nodeStatus={localData.status}
            />
          </div>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Node?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this node? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (onDeleteNode) {
                  onDeleteNode(selectedNode.id);
                }
                setDeleteDialogOpen(false);
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
