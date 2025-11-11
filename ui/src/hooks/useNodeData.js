import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook for managing node local data and syncing with selected node
 */
export function useNodeData(selectedNode, onNodeUpdate) {
  const [localData, setLocalData] = useState({});
  const lastNodeIdRef = useRef(null);

  // Sync localData with selectedNode when it changes
  useEffect(() => {
    if (selectedNode?.id !== lastNodeIdRef.current) {
      lastNodeIdRef.current = selectedNode?.id;
      setLocalData(selectedNode?.data || {});
    }
  }, [selectedNode?.id, selectedNode?.data]);

  const handleUpdate = (field, value) => {
    const updated = { ...localData, [field]: value };
    setLocalData(updated);
    if (onNodeUpdate) {
      onNodeUpdate(selectedNode?.id, updated);
    }
  };

  return { localData, setLocalData, handleUpdate };
}
