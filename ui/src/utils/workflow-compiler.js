/**
 * Workflow Compiler (Client-side)
 * Converts workflow graph JSON into a prompt string for OpenAI
 * Uses the new format with 'next' references and node names
 */

/**
 * Check if there's a path from start node to end node
 * @param {Array} nodes - Array of workflow nodes
 * @param {Array} edges - Array of workflow edges
 * @returns {boolean} True if there's a path from start to end
 * @private
 */
// eslint-disable-next-line no-unused-vars
function hasPathFromStartToEnd(nodes, edges) {
  // Find start and end nodes
  const startNode = nodes.find(node => node.type === 'start');
  const endNodes = nodes.filter(node => node.type === 'end');

  if (!startNode || endNodes.length === 0) {
    return false;
  }

  // Build adjacency list
  const graph = {};
  nodes.forEach(node => {
    graph[node.id] = [];
  });

  edges.forEach(edge => {
    if (graph[edge.source]) {
      graph[edge.source].push(edge.target);
    }
  });

  // BFS from start node
  const visited = new Set();
  const queue = [startNode.id];
  visited.add(startNode.id);

  while (queue.length > 0) {
    const current = queue.shift();

    // Check if we reached any end node
    if (endNodes.some(end => end.id === current)) {
      return true;
    }

    // Visit neighbors
    if (graph[current]) {
      for (const neighbor of graph[current]) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  return false;
}

/**
 * Get node name for display (name or id)
 */
function getNodeName(node) {
  if (node.type === 'step' && node.data?.name) {
    return node.data.name;
  }
  return node.id;
}

/**
 * Find node by name or id
 */
function findNodeByNameOrId(nodes, nameOrId) {
  // First try to find by name (for step nodes)
  let node = nodes.find(n => n.type === 'step' && n.data?.name === nameOrId);
  if (node) return node;

  // Then try to find by id
  node = nodes.find(n => n.id === nameOrId);
  return node;
}

/**
 * Compile workflow graph to prompt text
 * @param {Object} graphJson - Workflow graph with nodes and edges
 * @returns {string} Compiled prompt text
 */
export function compileWorkflowToPrompt(graphJson) {
  const { nodes, edges } = graphJson;

  if (!nodes || nodes.length === 0) {
    return 'Workflow is empty or invalid.';
  }

  // Build node map
  const nodeMap = {};
  nodes.forEach(node => {
    nodeMap[node.id] = node;
  });

  // Build adjacency list for fallback (if next is not set)
  const adjacencyList = {};
  nodes.forEach(node => {
    adjacencyList[node.id] = [];
  });

  edges.forEach(edge => {
    if (adjacencyList[edge.source]) {
      adjacencyList[edge.source].push({
        target: edge.target,
        sourceHandle: edge.sourceHandle,
      });
    }
  });

  // Find start node
  const startNode = nodes.find(node => node.type === 'start');
  if (!startNode) {
    return 'Workflow must have a start node.';
  }

  const lines = [];

  // Helper function to get indentation based on depth
  function getIndent(depth) {
    return '  '.repeat(depth);
  }

  // Helper function to get next node reference
  function getNextNode(currentNode, _depth) {
    // Try to use 'next' field first
    if (currentNode.data?.next) {
      const nextNode = findNodeByNameOrId(nodes, currentNode.data.next);
      if (nextNode) {
        return { node: nextNode, name: getNodeName(nextNode) };
      }
    }

    // Fallback to edges (for backward compatibility)
    const children = adjacencyList[currentNode.id] || [];
    if (children.length > 0) {
      const nextNode = nodeMap[children[0].target];
      if (nextNode) {
        return { node: nextNode, name: getNodeName(nextNode) };
      }
    }

    return null;
  }

  // Helper function to traverse and compile (DFS with proper hierarchy)
  function traverse(nodeId, visited = new Set(), depth = 0) {
    if (visited.has(nodeId)) {
      return; // Avoid cycles
    }

    const node = nodeMap[nodeId];
    if (!node) {
      return;
    }

    visited.add(nodeId);
    const indent = getIndent(depth);

    // Process node based on type
    if (node.type === 'start') {
      const action = node.data?.action || node.data?.text || '';
      const next = getNextNode(node, depth);

      if (action) {
        lines.push(`${indent}START: ${action}`);
      } else {
        lines.push(`${indent}START`);
      }

      if (next) {
        lines.push(`${indent}next: "${next.name}"`);
      }
    } else if (node.type === 'step') {
      const name = node.data?.name || node.id;
      const action = node.data?.action || node.data?.text || '';
      const next = getNextNode(node, depth);

      lines.push(`${indent}STEP: ${name}`);
      if (action) {
        lines.push(`${indent}  action: "${action}"`);
      }
      if (next) {
        lines.push(`${indent}  next: "${next.name}"`);
      }
    } else if (node.type === 'if') {
      const condition = node.data?.condition || '';
      const ifTrue = node.data?.ifTrue?.next || '';
      const ifFalse = node.data?.ifFalse?.next || '';

      // Fallback to edges if next is not set
      const children = adjacencyList[nodeId] || [];
      const trueEdge = children.find(c => c.sourceHandle === 'true');
      const falseEdge = children.find(c => c.sourceHandle === 'false');

      const trueNext = ifTrue
        ? findNodeByNameOrId(nodes, ifTrue)
        : trueEdge
          ? nodeMap[trueEdge.target]
          : null;
      const falseNext = ifFalse
        ? findNodeByNameOrId(nodes, ifFalse)
        : falseEdge
          ? nodeMap[falseEdge.target]
          : null;

      if (condition) {
        lines.push(`${indent}IF ${condition}:`);
      } else {
        lines.push(`${indent}IF:`);
      }

      if (trueNext) {
        const trueLabel = node.data?.trueLabel || 'True';
        lines.push(`${indent}  → ${trueLabel}:`);
        lines.push(`${indent}    next: "${getNodeName(trueNext)}"`);
        if (!visited.has(trueNext.id)) {
          traverse(trueNext.id, new Set(visited), depth + 2);
        }
      }

      if (falseNext) {
        const falseLabel = node.data?.falseLabel || 'False';
        lines.push(`${indent}  → ${falseLabel}:`);
        lines.push(`${indent}    next: "${getNodeName(falseNext)}"`);
        if (!visited.has(falseNext.id)) {
          traverse(falseNext.id, new Set(visited), depth + 2);
        }
      }
    } else if (node.type === 'end') {
      const action = node.data?.action || node.data?.text || '';
      if (action) {
        lines.push(`${indent}END: ${action}`);
      } else {
        lines.push(`${indent}END`);
      }
      return; // End node, stop traversal
    }

    // For non-IF nodes, continue traversal if not already handled
    if (node.type !== 'if' && node.type !== 'end') {
      const next = getNextNode(node, depth);
      if (next && !visited.has(next.node.id)) {
        traverse(next.node.id, new Set(visited), depth + 1);
      }
    }
  }

  // Start traversal from start node
  traverse(startNode.id);

  // If no lines generated, return empty
  if (lines.length === 0) {
    return 'Workflow is empty or invalid.';
  }

  return lines.join('\n');
}
