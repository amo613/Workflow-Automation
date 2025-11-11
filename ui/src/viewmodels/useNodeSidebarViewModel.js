import { useState, useMemo, useEffect } from 'react';
import { useKnowledgeBase } from '../hooks/useKnowledgeBase.js';
import { useWorkflows } from '../hooks/useWorkflows.js';
import { useGoogleSheets } from '../hooks/useGoogleSheets.js';
import { useNodeData } from '../hooks/useNodeData.js';
import {
  getAvailableVariables,
  getInputData,
  getOutputData,
} from '../utils/variableUtils.js';

export function useNodeSidebarViewModel(
  selectedNode,
  nodes,
  edges,
  onNodeUpdate
) {
  const [activeTab, setActiveTab] = useState('parameters');
  const [outputView, setOutputView] = useState('table');
  const [inputView, setInputView] = useState('table');
  const [showKBSelector, setShowKBSelector] = useState(false);
  const [executingSingleNode, setExecutingSingleNode] = useState(false);
  const [draggedVariable, setDraggedVariable] = useState(null);
  const [showSpreadsheetModal, setShowSpreadsheetModal] = useState(false);
  const [showSheetModal, setShowSheetModal] = useState(false);

  // Data hooks
  const shouldFetchKB = selectedNode?.type === 'call-agent';
  const { entries: knowledgeBaseEntries, refetch: refetchKB } =
    useKnowledgeBase(shouldFetchKB);
  const { workflows, refetch: refetchWorkflows } = useWorkflows(shouldFetchKB);

  const shouldFetchSheets =
    selectedNode?.type === 'google-sheets' ||
    selectedNode?.type === 'google-sheets-trigger';
  const googleSheets = useGoogleSheets(shouldFetchSheets);

  // Node data management
  const { localData, setLocalData, handleUpdate } = useNodeData(
    selectedNode,
    onNodeUpdate
  );

  // Auto-fetch spreadsheets when connected (like in old version)
  useEffect(() => {
    if (
      (selectedNode?.type === 'google-sheets' ||
        selectedNode?.type === 'google-sheets-trigger') &&
      googleSheets.status?.connected
    ) {
      // Only fetch if we don't have spreadsheets yet
      if (
        !googleSheets.spreadsheets ||
        googleSheets.spreadsheets.length === 0
      ) {
        googleSheets.fetchSpreadsheets();
      }
    }
  }, [selectedNode?.type, googleSheets.status?.connected]);

  // Fetch sheets when spreadsheetId changes
  const spreadsheetId = localData.spreadsheetId;
  useEffect(() => {
    if (spreadsheetId && spreadsheetId !== '') {
      googleSheets.fetchSheets(spreadsheetId);
    }
  }, [spreadsheetId]);

  // Fetch columns when spreadsheetId and sheetName change
  const sheetName = localData.sheetName;
  useEffect(() => {
    if (spreadsheetId && sheetName) {
      googleSheets.fetchColumns(spreadsheetId, sheetName);
    }
  }, [spreadsheetId, sheetName]);

  // Computed values
  const availableVariables = useMemo(
    () => getAvailableVariables(localData, nodes, edges, selectedNode),
    [localData, nodes, edges, selectedNode]
  );

  const inputData = useMemo(
    () => getInputData(localData, nodes, edges, selectedNode),
    [localData, nodes, edges, selectedNode]
  );

  const outputData = useMemo(
    () => getOutputData(localData, selectedNode),
    [localData, selectedNode]
  );

  return {
    // State
    activeTab,
    setActiveTab,
    outputView,
    setOutputView,
    inputView,
    setInputView,
    localData,
    setLocalData,
    handleUpdate,
    showKBSelector,
    setShowKBSelector,
    executingSingleNode,
    setExecutingSingleNode,
    draggedVariable,
    setDraggedVariable,
    showSpreadsheetModal,
    setShowSpreadsheetModal,
    showSheetModal,
    setShowSheetModal,

    // Data
    knowledgeBaseEntries,
    refetchKB,
    workflows,
    refetchWorkflows,
    googleSheets,

    // Computed
    availableVariables,
    inputData,
    outputData,
  };
}
