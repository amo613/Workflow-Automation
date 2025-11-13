/**
 * Variable Utilities
 * Helper functions for working with variables in workflows
 */

/**
 * Extract array field values (e.g., extract all 'username' values from array)
 */
function extractArrayField(arr, fieldName) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return [];
  }

  const values = [];
  for (const item of arr) {
    if (item && typeof item === 'object' && fieldName in item) {
      values.push(item[fieldName]);
    }
  }
  return values;
}

/**
 * Get unique field names from array items
 */
function getArrayFieldNames(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return new Set();
  }

  const fieldNames = new Set();
  for (const item of arr) {
    if (item && typeof item === 'object') {
      Object.keys(item).forEach(key => {
        fieldNames.add(key);
      });
    }
  }
  return fieldNames;
}

/**
 * Get available variables from previous nodes
 * Supports array extraction: shows array fields, index examples, and array extractions
 */
export function getAvailableVariables(localData, nodes, edges, selectedNode) {
  if (!selectedNode || !nodes || !edges) return [];

  const variables = [];
  const visitedNodes = new Set();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Find all nodes that connect to the selected node
  const findPrecedingNodes = nodeId => {
    const preceding = [];
    edges.forEach(edge => {
      if (edge.target === nodeId && !visitedNodes.has(edge.source)) {
        visitedNodes.add(edge.source);
        const sourceNode = nodeMap.get(edge.source);
        if (sourceNode) {
          preceding.push(sourceNode);
          preceding.push(...findPrecedingNodes(edge.source));
        }
      }
    });
    return preceding;
  };

  const precedingNodes = findPrecedingNodes(selectedNode.id);

  // Extract variables from preceding nodes with array support
  const addNestedFields = (obj, prefix, nodeId, nodeType) => {
    if (!obj || typeof obj !== 'object') return;

    Object.keys(obj).forEach(key => {
      const value = obj[key];
      const fullPath = prefix ? `${prefix}.${key}` : key;

      // Add the field itself
      variables.push({
        name: key,
        value,
        path: fullPath,
        nodeId,
        nodeType,
      });

      // Handle arrays: add index examples and array extractions
      if (Array.isArray(value) && value.length > 0) {
        // Add index-based examples (max 5 items)
        const maxExamples = Math.min(5, value.length);
        for (let i = 0; i < maxExamples; i++) {
          const item = value[i];
          if (item && typeof item === 'object') {
            Object.keys(item).forEach(itemKey => {
              variables.push({
                name: `${key}[${i}].${itemKey}`,
                value: item[itemKey],
                path: `${fullPath}[${i}].${itemKey}`,
                nodeId,
                nodeType,
                isArrayExample: true,
              });
            });
          }
        }

        // Add array extractions (e.g., data.username → all usernames)
        const fieldNames = getArrayFieldNames(value);
        fieldNames.forEach(fieldName => {
          const extractedValues = extractArrayField(value, fieldName);
          variables.push({
            name: `${key}.${fieldName}`,
            value: extractedValues,
            path: `${fullPath}.${fieldName}`,
            nodeId,
            nodeType,
            isArrayExtraction: true,
          });
        });
      } else if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        // Recursively add nested object fields
        addNestedFields(value, fullPath, nodeId, nodeType);
      }
    });
  };

  precedingNodes.forEach(node => {
    if (node.data?.output) {
      const output = node.data.output;
      if (typeof output === 'object') {
        addNestedFields(output, null, node.id, node.type);
      }
    }
  });

  // Add workflow input variables with array support
  if (localData.workflowInput && typeof localData.workflowInput === 'object') {
    addNestedFields(localData.workflowInput, null, 'workflow', 'workflow');
  }

  return variables;
}

/**
 * Get input data for a node (data from previous nodes)
 * Combines outputs from ALL connected previous nodes
 */
export function getInputData(localData, nodes, edges, selectedNode) {
  if (!selectedNode || !nodes || !edges) return {};

  const inputData = {};
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Find ALL previous nodes (all nodes that connect to the selected node)
  const previousEdges = edges.filter(e => e.target === selectedNode.id);

  // Combine outputs from all previous nodes
  previousEdges.forEach(edge => {
    const previousNode = nodeMap.get(edge.source);
    if (previousNode?.data?.output) {
      // Merge outputs, with later nodes taking precedence for duplicate keys
      Object.assign(inputData, previousNode.data.output);
    }
  });

  return inputData;
}

/**
 * Get output data for a node
 */
export function getOutputData(localData, selectedNode) {
  return selectedNode?.data?.output || {};
}
