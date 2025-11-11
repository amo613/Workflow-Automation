/**
 * Variable Utilities
 * Helper functions for working with variables in workflows
 */

/**
 * Get available variables from previous nodes
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

  // Extract variables from preceding nodes
  precedingNodes.forEach(node => {
    if (node.data?.output) {
      const output = node.data.output;
      if (typeof output === 'object') {
        Object.keys(output).forEach(key => {
          variables.push({
            name: key,
            value: output[key],
            path: `${node.id}.${key}`,
            nodeId: node.id,
            nodeType: node.type,
          });
        });
      }
    }
  });

  // Add workflow input variables
  if (localData.workflowInput) {
    Object.keys(localData.workflowInput).forEach(key => {
      variables.push({
        name: key,
        value: localData.workflowInput[key],
        path: `workflowInput.${key}`,
        nodeId: 'workflow',
        nodeType: 'workflow',
      });
    });
  }

  return variables;
}

/**
 * Get input data for a node (data from previous nodes)
 */
export function getInputData(localData, nodes, edges, selectedNode) {
  if (!selectedNode || !nodes || !edges) return {};

  const inputData = {};
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Find the immediate previous node
  const previousEdge = edges.find(e => e.target === selectedNode.id);
  if (previousEdge) {
    const previousNode = nodeMap.get(previousEdge.source);
    if (previousNode?.data?.output) {
      Object.assign(inputData, previousNode.data.output);
    }
  }

  return inputData;
}

/**
 * Get output data for a node
 */
export function getOutputData(localData, selectedNode) {
  return selectedNode?.data?.output || {};
}
