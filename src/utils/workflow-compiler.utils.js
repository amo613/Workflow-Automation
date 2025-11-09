/**
 * Workflow Compiler
 * Converts workflow graph JSON into a prompt string for OpenAI
 */

import { toCamelCase, normalizeVariablesInText } from './variable-utils.js';

/**
 * Check if there's a path from start node to end node
 * @param {Array} nodes - Array of workflow nodes
 * @param {Array} edges - Array of workflow edges
 * @returns {boolean} True if there's a path from start to end
 */
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
 * Compile workflow graph to prompt text
 * @param {Object} graphJson - Workflow graph with nodes and edges
 * @returns {string} Compiled prompt text
 */
export function compileWorkflowToPrompt(graphJson) {
  const { nodes, edges } = graphJson;

  if (!nodes || nodes.length === 0) {
    return '';
  }

  // Build adjacency list to traverse the graph
  const adjacencyList = {};
  const nodeMap = {};
  nodes.forEach(node => {
    adjacencyList[node.id] = [];
    nodeMap[node.id] = node;
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
    return '';
  }

  const lines = [];

  // Helper function to get indentation based on depth
  function getIndent(depth) {
    return '  '.repeat(depth);
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
      if (node.data?.text) {
        lines.push(`${indent}START: ${node.data.text}`);
      } else {
        lines.push(`${indent}START`);
      }
    } else if (node.type === 'step') {
      if (node.data?.text) {
        lines.push(`${indent}STEP: ${node.data.text}`);
      } else {
        lines.push(`${indent}STEP`);
      }
    } else if (node.type === 'if') {
      if (node.data?.condition) {
        lines.push(`${indent}IF ${node.data.condition}:`);
      } else {
        lines.push(`${indent}IF:`);
      }
    } else if (node.type === 'end') {
      if (node.data?.text) {
        lines.push(`${indent}END: ${node.data.text}`);
      } else {
        lines.push(`${indent}END`);
      }
      return; // End node, stop traversal
    }

    // Traverse children
    const children = adjacencyList[nodeId] || [];

    // For IF nodes, group children by sourceHandle (true/false)
    if (node.type === 'if') {
      const trueChildren = children.filter(c => c.sourceHandle === 'true');
      const falseChildren = children.filter(c => c.sourceHandle === 'false');

      // Process true branch if it exists
      if (trueChildren.length > 0) {
        const trueLabel = node.data?.trueLabel || 'True';
        lines.push(`${indent}  → ${trueLabel}:`);
        for (const child of trueChildren) {
          if (!visited.has(child.target)) {
            traverse(child.target, new Set(visited), depth + 2);
          }
        }
      }

      // Process false branch if it exists
      if (falseChildren.length > 0) {
        const falseLabel = node.data?.falseLabel || 'False';
        lines.push(`${indent}  → ${falseLabel}:`);
        for (const child of falseChildren) {
          if (!visited.has(child.target)) {
            traverse(child.target, new Set(visited), depth + 2);
          }
        }
      }
    } else {
      // For non-IF nodes, traverse all children normally
      for (const child of children) {
        if (!visited.has(child.target)) {
          traverse(child.target, new Set(visited), depth + 1);
        }
      }
    }
  }

  // Start traversal from start node
  traverse(startNode.id);

  // If no lines generated, return empty
  if (lines.length === 0) {
    return 'Workflow is empty or invalid.';
  }

  let compiledPrompt = lines.join('\n');

  // Normalize variables in prompt (convert to camelCase)
  if (
    graphJson.knowledge_base &&
    Array.isArray(graphJson.knowledge_base) &&
    graphJson.knowledge_base.length > 0
  ) {
    // Create map of original names to normalized names
    const variableMap = {};
    graphJson.knowledge_base.forEach(kb => {
      if (kb.name && kb.name.trim()) {
        const original = kb.name.trim();
        const normalized = kb.normalizedName || toCamelCase(original);
        if (original !== normalized) {
          variableMap[original] = normalized;
        }
      }
    });

    // Normalize all variables in the prompt
    if (Object.keys(variableMap).length > 0) {
      compiledPrompt = normalizeVariablesInText(compiledPrompt, variableMap);
    }

    // Add Knowledge Base to prompt with normalized names
    const knowledgeBaseText = graphJson.knowledge_base
      .map(kb => {
        const normalizedName = kb.normalizedName || toCamelCase(kb.name || '');
        return `- ${normalizedName}: ${kb.text}`;
      })
      .join('\n');

    compiledPrompt = `${compiledPrompt}

KNOWLEDGE BASE:
${knowledgeBaseText}`;
  }

  return compiledPrompt;
}

/**
 * Validate workflow has path from start to end
 * @param {Object} graphJson - Workflow graph with nodes and edges
 * @returns {boolean} True if valid path exists
 */
export function validateWorkflowPath(graphJson) {
  const { nodes, edges } = graphJson;
  return hasPathFromStartToEnd(nodes || [], edges || []);
}
