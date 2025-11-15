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
    } else if (selectedNode?.data) {
      // Also sync when data changes but id stays the same (e.g., after external update)
      setLocalData(selectedNode.data);
    }
  }, [selectedNode?.id, selectedNode?.data]);

  const handleUpdate = (field, value) => {
    setLocalData(prevData => {
      const updated = { ...prevData, [field]: value };
      if (onNodeUpdate) {
        onNodeUpdate(selectedNode?.id, updated);
      }
      return updated;
    });
  };

  return { localData, setLocalData, handleUpdate };
}
