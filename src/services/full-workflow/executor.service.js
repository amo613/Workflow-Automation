import logger from '#config/logger.js';
import VariableContext from './variable-context.service.js';
import { resolveTemplate } from '#utils/template-engine.js';
import { executeNode } from './node-handlers/index.js';

/**
 * Execute a full workflow
 * @param {Object} workflow - Workflow object from database
 * @param {Object} input - Workflow input data
 * @param {number} userId - User ID (optional, for node handlers that need it)
 * @returns {Promise<Object>} - Execution result
 */
export async function executeWorkflow(workflow, input = {}, userId = null) {
  try {
    const workflowJson = workflow.workflow_json || {};
    const { nodes, edges } = workflowJson;

    if (!nodes || nodes.length === 0) {
      throw new Error('Workflow has no nodes');
    }

    // Initialize variable context
    const context = new VariableContext();
    context.setWorkflowInput(input);

    // Store userId in context for node handlers
    if (userId) {
      context.setVariable('userId', userId);
      // Also add to workflowInput for backward compatibility
      if (typeof input === 'object' && input !== null) {
        input.userId = userId;
        context.setWorkflowInput(input);
      }
    }

    // Find start node
    const startNode = nodes.find(node => node.type === 'start');
    if (!startNode) {
      throw new Error('Workflow has no start node');
    }

    // Build adjacency list for graph traversal
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
          targetHandle: edge.targetHandle,
        });
      }
    });

    // Execute workflow starting from start node
    const executionLog = [];
    const visited = new Set();
    const executionResult = await executeNodeRecursive(
      startNode.id,
      nodeMap,
      adjacencyList,
      context,
      edges,
      visited,
      executionLog
    );

    logger.info('Workflow execution completed', {
      workflowId: workflow.id,
      nodesExecuted: executionLog.length,
      result: executionResult,
    });

    return {
      success: true,
      executionLog,
      result: executionResult,
      variables: Object.fromEntries(context.variables),
      nodeOutputs: Object.fromEntries(context.nodeOutputs),
    };
  } catch (error) {
    logger.error('Error executing workflow', {
      workflowId: workflow.id,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Recursively execute nodes in the workflow
 * @param {string} nodeId - Current node ID
 * @param {Object} nodeMap - Map of all nodes
 * @param {Object} adjacencyList - Graph adjacency list
 * @param {VariableContext} context - Variable context
 * @param {Array} edges - All edges
 * @param {Set} visited - Visited nodes (for cycle detection)
 * @param {Array} executionLog - Execution log
 * @returns {Promise<*>} - Node output
 */
async function executeNodeRecursive(
  nodeId,
  nodeMap,
  adjacencyList,
  context,
  edges,
  visited,
  executionLog
) {
  // Cycle detection
  if (visited.has(nodeId)) {
    logger.warn('Cycle detected in workflow', { nodeId });
    return null;
  }

  visited.add(nodeId);
  const node = nodeMap[nodeId];

  if (!node) {
    throw new Error(`Node ${nodeId} not found`);
  }

  logger.debug('Executing node', {
    nodeId,
    type: node.type,
    data: node.data,
  });

  // Get context for template resolution
  const templateContext = context.getContext(nodeId, edges);

  // Execute node
  let nodeOutput;
  try {
    nodeOutput = await executeNode(node, templateContext, context);
    context.setNodeOutput(nodeId, nodeOutput);

    executionLog.push({
      nodeId,
      type: node.type,
      status: 'completed',
      output: nodeOutput,
      timestamp: new Date().toISOString(),
    });

    logger.info('Node executed successfully', {
      nodeId,
      type: node.type,
      hasOutput: !!nodeOutput,
    });
  } catch (error) {
    executionLog.push({
      nodeId,
      type: node.type,
      status: 'failed',
      error: error.message,
      timestamp: new Date().toISOString(),
    });

    logger.error('Node execution failed', {
      nodeId,
      type: node.type,
      error: error.message,
    });
    throw error;
  }

  // Handle end node
  if (node.type === 'end') {
    return nodeOutput;
  }

  // Handle if node (conditional branching)
  if (node.type === 'if') {
    const conditionResult = evaluateCondition(
      node.data.condition1,
      node.data.operator || '==',
      node.data.condition2,
      templateContext
    );

    const nextNodeId = conditionResult
      ? findNextNode(nodeId, adjacencyList, 'true', edges)
      : findNextNode(nodeId, adjacencyList, 'false', edges);

    if (nextNodeId) {
      return executeNodeRecursive(
        nextNodeId,
        nodeMap,
        adjacencyList,
        context,
        edges,
        new Set(visited), // Reset visited for new branch
        executionLog
      );
    }

    return nodeOutput;
  }

  // Handle wait node
  if (node.type === 'wait') {
    const duration = node.data.duration || 0;
    if (duration > 0) {
      await new Promise(resolve => setTimeout(resolve, duration * 1000));
    }
  }

  // Continue to next node
  const nextNodes = adjacencyList[nodeId] || [];
  if (nextNodes.length > 0) {
    // For now, execute first next node (sequential execution)
    // TODO: Handle parallel execution for multiple outgoing edges
    const nextNode = nextNodes[0];
    return executeNodeRecursive(
      nextNode.target,
      nodeMap,
      adjacencyList,
      context,
      edges,
      visited,
      executionLog
    );
  }

  return nodeOutput;
}

/**
 * Find next node based on edge handle
 * @param {string} nodeId - Current node ID
 * @param {Object} adjacencyList - Graph adjacency list
 * @param {string} handleId - Handle ID (for if nodes: 'true' or 'false')
 * @param {Array} edges - All edges
 * @returns {string|null} - Next node ID or null
 */
function findNextNode(nodeId, adjacencyList, handleId, edges) {
  const outgoingEdges = edges.filter(
    edge => edge.source === nodeId && edge.sourceHandle === handleId
  );

  if (outgoingEdges.length > 0) {
    return outgoingEdges[0].target;
  }

  return null;
}

/**
 * Evaluate condition for if node
 * @param {string} condition1 - First condition (left side)
 * @param {string} operator - Comparison operator
 * @param {string} condition2 - Second condition (right side)
 * @param {Object} context - Template context
 * @returns {boolean} - Condition result
 */
function evaluateCondition(condition1, operator, condition2, context) {
  if (!condition1 || !condition2) {
    return false;
  }

  // Resolve template variables in both conditions
  const resolvedCondition1 = resolveTemplate(condition1, context);
  const resolvedCondition2 = resolveTemplate(condition2, context);

  try {
    // Parse values (try to convert to numbers if possible)
    let value1 = resolvedCondition1;
    let value2 = resolvedCondition2;

    // Try to parse as numbers
    const num1 = parseFloat(resolvedCondition1);
    const num2 = parseFloat(resolvedCondition2);
    if (!isNaN(num1) && !isNaN(num2)) {
      value1 = num1;
      value2 = num2;
    } else if (!isNaN(num1)) {
      value1 = num1;
    } else if (!isNaN(num2)) {
      value2 = num2;
    }

    // Remove quotes from strings if present
    if (
      typeof value1 === 'string' &&
      value1.startsWith('"') &&
      value1.endsWith('"')
    ) {
      value1 = value1.slice(1, -1);
    }
    if (
      typeof value2 === 'string' &&
      value2.startsWith('"') &&
      value2.endsWith('"')
    ) {
      value2 = value2.slice(1, -1);
    }

    // Evaluate based on operator
    switch (operator) {
      case '==':
        return value1 == value2; // Use == for type coercion
      case '!=':
        return value1 != value2;
      case '>':
        return value1 > value2;
      case '<':
        return value1 < value2;
      case '>=':
        return value1 >= value2;
      case '<=':
        return value1 <= value2;
      case 'contains':
        return String(value1).includes(String(value2));
      default:
        logger.warn('Unknown operator', { operator });
        return false;
    }
  } catch (error) {
    logger.warn('Failed to evaluate condition', {
      condition1: resolvedCondition1,
      condition2: resolvedCondition2,
      operator,
      error: error.message,
    });
    return false;
  }
}
