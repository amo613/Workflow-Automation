/**
 * Variable Extraction Utilities
 * Intelligently extracts only the variables that are actually used in a node's configuration
 * This prevents "request body too large" errors by sending only necessary data
 */

/**
 * Extract all variable references from a string template
 * @param {string} template - Template string (e.g., "Hello {{name}}, you have {{count}} messages")
 * @returns {Array<string>} - Array of variable paths (e.g., ["name", "count"])
 */
function extractVariablesFromString(template) {
  if (!template || typeof template !== 'string') {
    return [];
  }

  const variablePattern = /\{\{([^}]+)\}\}/g;
  const variables = [];
  let match;

  while ((match = variablePattern.exec(template)) !== null) {
    const variablePath = match[1].trim();
    // Skip special syntax like {{workflow.input.field}}, {{nodeId.output.field}}, {{previous.output}}
    if (
      !variablePath.startsWith('workflow.') &&
      !variablePath.includes('.output') &&
      !variablePath.startsWith('previous')
    ) {
      variables.push(variablePath);
    }
  }

  return variables;
}

/**
 * Recursively extract variables from an object
 * @param {Object} obj - Object to extract variables from
 * @returns {Array<string>} - Array of variable paths
 */
function extractVariablesFromObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return [];
  }

  const variables = [];

  for (const value of Object.values(obj)) {
    if (typeof value === 'string') {
      variables.push(...extractVariablesFromString(value));
    } else if (Array.isArray(value)) {
      value.forEach(item => {
        if (typeof item === 'string') {
          variables.push(...extractVariablesFromString(item));
        } else if (item && typeof item === 'object') {
          variables.push(...extractVariablesFromObject(item));
        }
      });
    } else if (value && typeof value === 'object') {
      variables.push(...extractVariablesFromObject(value));
    }
  }

  return variables;
}

/**
 * Extract all variables used in a node's configuration
 * @param {Object} node - Node object
 * @returns {Array<string>} - Array of variable paths used in this node
 */
export function extractUsedVariables(node) {
  if (!node || !node.data) {
    return [];
  }

  const variables = [];
  const data = node.data;

  // Check common fields that might contain templates
  const fieldsToCheck = [
    'url',
    'body',
    'headers',
    'queryParams',
    'spreadsheetId',
    'sheetName',
    'valuesToSet',
    'filters',
    'message',
    'subject',
    'to',
    'from',
    'query',
    'prompt',
    'condition',
    'value',
    'name',
  ];

  // Extract from specific fields
  fieldsToCheck.forEach(field => {
    if (data[field]) {
      if (typeof data[field] === 'string') {
        variables.push(...extractVariablesFromString(data[field]));
      } else if (typeof data[field] === 'object') {
        variables.push(...extractVariablesFromObject(data[field]));
      }
    }
  });

  // Also check all string values in data object
  variables.push(...extractVariablesFromObject(data));

  // Remove duplicates
  return [...new Set(variables)];
}

/**
 * Extract only the values needed for the used variables from node outputs
 * For nested paths like {{data.userId}}, we extract the parent object (data)
 * to preserve the structure needed for template resolution
 * @param {Array<string>} usedVariables - Variables that are actually used
 * @param {Object} nodeOutput - Output from a previous node
 * @returns {Object} - Extracted values (merged structure from nodeOutput)
 */
export function extractNeededValues(usedVariables, nodeOutput) {
  if (!nodeOutput || typeof nodeOutput !== 'object') {
    return {};
  }

  const extracted = {};

  for (const variablePath of usedVariables) {
    // For nested paths like "data.userId", extract the parent object "data"
    // This ensures the structure is preserved for template resolution
    const parts = variablePath.split('.');

    if (parts.length === 1) {
      // Simple field: {{updatedRows}} -> extract updatedRows
      // First try direct access
      if (nodeOutput[variablePath] !== undefined) {
        extracted[variablePath] = nodeOutput[variablePath];
      }
      // Also check in nested data object (for Google Sheets: { data: { updatedRows: 1 } })
      else if (
        nodeOutput.data &&
        typeof nodeOutput.data === 'object' &&
        nodeOutput.data[variablePath] !== undefined
      ) {
        extracted[variablePath] = nodeOutput.data[variablePath];
      }
    } else {
      // Nested path: {{data.userId}} -> extract the parent object "data"
      const parentPath = parts[0];
      if (nodeOutput[parentPath] !== undefined) {
        // Extract the entire parent object to preserve structure
        extracted[parentPath] = nodeOutput[parentPath];
      } else if (
        nodeOutput.data &&
        typeof nodeOutput.data === 'object' &&
        nodeOutput.data[parentPath] !== undefined
      ) {
        // Also check nested data object (e.g., { data: { data: { userId } } })
        extracted[parentPath] = nodeOutput.data[parentPath];
      }
    }
  }

  return extracted;
}

/**
 * Get minimal input data for node execution
 * Extracts only the variables that are actually used in the node's configuration
 * @param {Object} node - Node to execute
 * @param {Array} nodes - All nodes in the workflow
 * @param {Array} edges - All edges in the workflow
 * @returns {Object} - Minimal input data with only used variables
 */
/**
 * Find all preceding nodes recursively (entire chain)
 * @param {string} nodeId - Current node ID
 * @param {Array} edges - All edges
 * @param {Map} nodeMap - Map of all nodes
 * @param {Set} visited - Visited nodes (to prevent cycles)
 * @returns {Array} - Array of all preceding node IDs
 */
function findAllPrecedingNodes(nodeId, edges, nodeMap, visited = new Set()) {
  const preceding = [];

  edges.forEach(edge => {
    // Skip self-referencing edges
    if (
      edge.target === nodeId &&
      edge.source !== nodeId &&
      !visited.has(edge.source)
    ) {
      visited.add(edge.source);
      const sourceNode = nodeMap.get(edge.source);
      if (sourceNode) {
        preceding.push(edge.source);
        // Recursively find nodes that connect to this node
        preceding.push(
          ...findAllPrecedingNodes(edge.source, edges, nodeMap, visited)
        );
      }
    }
  });

  return preceding;
}

export function getMinimalInputData(node, nodes, edges) {
  if (!node || !nodes || !edges) return { minimalData: {}, nodeOutputsMap: {} };

  // Extract all variables used in this node's configuration
  const usedVariables = extractUsedVariables(node);

  if (usedVariables.length === 0) {
    // No variables used, return empty objects
    return { minimalData: {}, nodeOutputsMap: {} };
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // CRITICAL: Find ALL preceding nodes in the entire chain (not just direct connections)
  // Example: Webhook → Switch → Google Sheets
  // Google Sheets should have access to both Switch AND Webhook outputs
  const allPrecedingNodeIds = findAllPrecedingNodes(node.id, edges, nodeMap);

  const minimalData = {};
  const nodeOutputsMap = {};

  // Extract minimal data from ALL preceding nodes in the chain
  allPrecedingNodeIds.forEach(nodeId => {
    const precedingNode = nodeMap.get(nodeId);
    if (precedingNode?.data?.output) {
      // Extract only the values needed for the used variables
      const neededValues = extractNeededValues(
        usedVariables,
        precedingNode.data.output
      );

      // Merge into minimalData (for backward compatibility)
      Object.assign(minimalData, neededValues);

      // Store per-node for nodeOutputsMap
      if (Object.keys(neededValues).length > 0) {
        nodeOutputsMap[nodeId] = neededValues;
      }
    }
  });

  // Return both minimalData and nodeOutputsMap
  return { minimalData, nodeOutputsMap };
}
