import { performance } from 'perf_hooks';
import logger from '#config/logger.js';
import VariableContext from './variable-context.service.js';
import { resolveTemplate } from '#utils/template-engine.js';
import { executeNode } from './node-handlers/index.js';
import { trackNodePerformance } from './performance.service.js';
import { executeWithRetry } from './retry.service.js';
import {
  classifyError,
  shouldContinueOnError,
} from './error-classification.service.js';

/**
 * Evaluate if workflow achieved its goal based on outputs and goal definition
 * Simple heuristic: workflow succeeded if all critical nodes completed successfully
 */
function evaluateGoalAchievement(workflow, nodeOutputs) {
  if (!workflow || !workflow.goal_definition) {
    return { achieved: true, confidence: 0, reason: 'No goal defined' };
  }

  // Check if any nodes failed
  const hasFailures = Object.values(nodeOutputs).some(
    output => output?.status === 'failed' || output?.success === false
  );

  if (hasFailures) {
    return { achieved: false, confidence: 0.9, reason: 'Nodes failed during execution' };
  }

  // Check if workflow has meaningful outputs (completed successfully)
  const completedNodes = Object.values(nodeOutputs).filter(
    output => output?.status === 'success' || output?.success === true
  );

  const completionRate = Object.keys(nodeOutputs).length > 0
    ? completedNodes.length / Object.keys(nodeOutputs).length
    : 0;

  if (completionRate >= 0.9) {
    return { achieved: true, confidence: 0.8, reason: 'All nodes completed successfully' };
  } else if (completionRate >= 0.7) {
    return { achieved: true, confidence: 0.6, reason: 'Most nodes completed successfully' };
  } else {
    return { achieved: false, confidence: 0.7, reason: 'Too many nodes did not complete' };
  }
}

/**
 * Execute a full workflow
 * @param {number|Object} workflowIdOrWorkflow - Workflow ID or Workflow object
 * @param {Object} input - Workflow input data
 * @param {number} userId - User ID (optional, for node handlers that need it)
 * @param {Array} nodes - Optional: nodes array (if workflow is ID)
 * @param {Array} edges - Optional: edges array (if workflow is ID)
 * @returns {Promise<Object>} - Execution result
 */
export async function executeWorkflow(
  workflowIdOrWorkflow,
  input = {},
  userId = null,
  nodes = null,
  edges = null,
  incrementalCacheUpdater = null // Optional function to update cache after each node
) {
  try {
    // Handle both workflow ID and workflow object
    let workflow;
    let workflowJson;

    if (typeof workflowIdOrWorkflow === 'number') {
      // If it's an ID, we need to fetch the workflow
      // For now, assume nodes and edges are provided
      workflowJson = { nodes: nodes || [], edges: edges || [] };
    } else {
      // It's a workflow object
      workflow = workflowIdOrWorkflow;
      workflowJson = workflow.workflow_json || {};
      nodes = nodes || workflowJson.nodes || [];
      edges = edges || workflowJson.edges || [];
    }

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

    // Find start node or trigger node
    // Priority: specific triggerNodeId from input > trigger nodes > start node
    let startNode = null;

    // Check if a specific triggerNodeId was provided in input
    // This allows multiple trigger nodes in the same workflow to work independently
    if (input && typeof input === 'object' && input.triggerNodeId) {
      startNode = nodes.find(node => node.id === input.triggerNodeId);
      if (
        startNode &&
        (startNode.type === 'google-sheets-trigger' ||
          startNode.type === 'webhook-trigger' ||
          startNode.type === 'hubspot-trigger' ||
          startNode.type === 'schedule-trigger' ||
          startNode.type === 'call-trigger' ||
          startNode.type === 'start')
      ) {
        logger.info('Using specific trigger node from input', {
          triggerNodeId: input.triggerNodeId,
          nodeType: startNode.type,
          workflowId:
            typeof workflowIdOrWorkflow === 'object'
              ? workflowIdOrWorkflow.id
              : workflowIdOrWorkflow,
        });
      } else {
        logger.warn(
          'Specified triggerNodeId not found or invalid, falling back to default',
          {
            triggerNodeId: input.triggerNodeId,
            foundNode: !!startNode,
            nodeType: startNode?.type,
          }
        );
        startNode = null; // Fall back to default behavior
      }
    }

    // Fallback: use first trigger node or start node
    if (!startNode) {
      const triggerNodes = nodes.filter(
        node =>
          node.type === 'google-sheets-trigger' ||
          node.type === 'webhook-trigger' ||
          node.type === 'hubspot-trigger' ||
          node.type === 'schedule-trigger' ||
          node.type === 'call-trigger' ||
          node.type === 'start'
      );
      startNode = triggerNodes.length > 0 ? triggerNodes[0] : null;
    }

    if (!startNode) {
      throw new Error('Workflow has no start node or trigger node');
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

    // Get workflow ID for performance tracking
    const workflowId =
      typeof workflowIdOrWorkflow === 'object'
        ? workflowIdOrWorkflow.id
        : workflowIdOrWorkflow;

    // Execute workflow starting from start node
    const executionLog = [];
    const visited = new Set();
    const executedEdges = new Set(); // Track which edges were executed
    const executionResult = await executeNodeRecursive(
      startNode.id,
      nodeMap,
      adjacencyList,
      context,
      edges,
      visited,
      executionLog,
      executedEdges,
      workflowId, // Pass workflowId for performance tracking
      incrementalCacheUpdater // Pass cache updater for incremental updates
    );

    logger.info('Workflow execution completed', {
      workflowId:
        typeof workflowIdOrWorkflow === 'object'
          ? workflowIdOrWorkflow.id
          : workflowIdOrWorkflow,
      nodesExecuted: executionLog.length,
      edgesExecuted: executedEdges.size,
    });

    return {
      success: true,
      executionLog,
      result: executionResult,
      variables: Object.fromEntries(context.variables),
      nodeOutputs: Object.fromEntries(context.nodeOutputs),
      executedEdges: Array.from(executedEdges), // Return executed edge IDs
      // Add goal achievement evaluation
      goalEvaluation: evaluateGoalAchievement(workflow, Object.fromEntries(context.nodeOutputs)),
    };
  } catch (error) {
    logger.error('Error executing workflow', {
      workflowId:
        typeof workflowIdOrWorkflow === 'object'
          ? workflowIdOrWorkflow.id
          : workflowIdOrWorkflow,
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
  executionLog,
  executedEdges,
  workflowId = null,
  incrementalCacheUpdater = null // Optional function to update cache after each node
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

  // Get error configuration
  const errorConfig = node.data?.errorConfig || {
    onError: 'stop', // Default: stop on error
  };

  // Track performance: measure execution time
  const startTime = performance.now();
  let nodeOutput;
  let retryCount = 0;

  try {
    // Execute node with retry logic if configured
    if (errorConfig.onError === 'retry' && errorConfig.retryCount > 0) {
      const retryResult = await executeWithRetry(
        () => executeNode(node, templateContext, context),
        errorConfig,
        nodeId,
        node.type
      );
      nodeOutput = retryResult.result;
      retryCount = retryResult.retryCount;
    } else {
      nodeOutput = await executeNode(node, templateContext, context);
    }

    context.setNodeOutput(nodeId, nodeOutput);

    // Track performance after successful execution
    const executionTime = performance.now() - startTime;
    if (workflowId && typeof workflowId === 'number' && !isNaN(workflowId)) {
      // Track asynchronously to not block execution
      trackNodePerformance(workflowId, nodeId, node.type, executionTime).catch(
        err => {
          logger.warn('Failed to track node performance', {
            workflowId,
            nodeId,
            error: err.message,
          });
        }
      );
    }

    executionLog.push({
      nodeId,
      type: node.type,
      status: 'completed',
      // Don't store output here - it's already in nodeOutputs to avoid duplication
      timestamp: new Date().toISOString(),
    });

    logger.info('Node executed successfully', {
      nodeId,
      type: node.type,
      hasOutput: !!nodeOutput,
    });

    // Mark outgoing edges as executed IMMEDIATELY after node execution
    // This ensures edges are visualized as soon as the node completes
    // (moved here from later in the function to fix delayed edge visualization)
    // NOTE: Skip this for if/switch nodes - they handle edge marking themselves
    if (node.type !== 'if' && node.type !== 'switch') {
      const nextNodes = adjacencyList[nodeId] || [];
      if (nextNodes.length > 0) {
        nextNodes.forEach(nextNode => {
          const matchingEdge = edges.find(
            edge => edge.source === nodeId && edge.target === nextNode.target
          );
          if (matchingEdge) {
            const edgeId =
              matchingEdge.id ||
              `reactflow__edge-${matchingEdge.source}-${matchingEdge.target}`;
            executedEdges.add(edgeId);
          } else {
            logger.warn('Could not find matching edge', {
              source: nodeId,
              target: nextNode.target,
              nodeType: node.type,
            });
          }
        });
      }
    }

    // Update cache incrementally after each node (non-blocking)
    // This now includes the edges we just marked above
    if (incrementalCacheUpdater) {
      try {
        incrementalCacheUpdater({
          nodeOutputs: Object.fromEntries(context.nodeOutputs),
          executedEdges,
          executionLog,
        });
      } catch (err) {
        // Don't let cache update errors break execution
        logger.debug('Error in incremental cache update', {
          error: err.message,
        });
      }
    }
  } catch (error) {
    // Classify error
    const errorType = classifyError(error);

    // Create error log entry with extended details
    const errorLogEntry = {
      nodeId,
      type: node.type,
      status: 'failed',
      error: error.message,
      errorStack: error.stack,
      errorType,
      errorContext: {
        inputs: node.data,
        timestamp: new Date().toISOString(),
      },
      retryAttempts: retryCount,
      timestamp: new Date().toISOString(),
    };

    executionLog.push(errorLogEntry);

    logger.error('Node execution failed', {
      nodeId,
      type: node.type,
      error: error.message,
      errorType,
      errorConfig: errorConfig.onError,
    });

    // Update cache with failed node BEFORE handling error
    // This ensures frontend sees the failed node even if workflow stops
    if (incrementalCacheUpdater) {
      try {
        incrementalCacheUpdater({
          nodeOutputs: Object.fromEntries(context.nodeOutputs),
          executedEdges,
          executionLog,
        });
      } catch (err) {
        // Don't let cache update errors break error handling
        logger.debug('Error updating cache with failed node', {
          error: err.message,
        });
      }
    }

    // Handle error based on errorConfig
    if (errorConfig.onError === 'continue') {
      // Check if error should allow continuation
      const shouldContinue = shouldContinueOnError(
        error,
        errorConfig.continueOnErrors || []
      );

      if (
        shouldContinue ||
        !errorConfig.continueOnErrors ||
        errorConfig.continueOnErrors.length === 0
      ) {
        // Workflow continues, node marked as failed
        logger.info('Continuing workflow after node error', {
          nodeId,
          nodeType: node.type,
          error: error.message,
        });

        // Return default value or null, so next nodes can execute
        const defaultValue =
          errorConfig.defaultValue !== undefined
            ? errorConfig.defaultValue
            : null;

        if (defaultValue !== null) {
          context.setNodeOutput(nodeId, defaultValue);
        }

        // Continue to next nodes (don't throw error)
        // The error is already logged, node is marked as failed
        // Execution will continue below
      } else {
        // Error not in continueOnErrors list → stop workflow
        throw error;
      }
    } else if (
      errorConfig.onError === 'fallback' &&
      errorConfig.fallbackNodeId
    ) {
      // Execute fallback node
      const fallbackNode = nodeMap[errorConfig.fallbackNodeId];
      if (fallbackNode) {
        logger.info('Executing fallback node after error', {
          failedNodeId: nodeId,
          fallbackNodeId: errorConfig.fallbackNodeId,
          error: error.message,
        });

        // Store error info in context for fallback node to access
        context.setVariable('_error', {
          nodeId,
          error: error.message,
          errorStack: error.stack,
          errorType,
          timestamp: new Date().toISOString(),
        });

        // Mark the fallback edge as executed (for UI visualization)
        const fallbackEdge = edges.find(
          edge =>
            edge.source === nodeId && edge.target === errorConfig.fallbackNodeId
        );
        if (fallbackEdge) {
          const edgeId =
            fallbackEdge.id ||
            `reactflow__edge-${nodeId}-${errorConfig.fallbackNodeId}`;
          executedEdges.add(edgeId);
        }

        // Execute fallback node
        try {
          const fallbackOutput = await executeNodeRecursive(
            errorConfig.fallbackNodeId,
            nodeMap,
            adjacencyList,
            context,
            edges,
            visited,
            executionLog,
            executedEdges,
            workflowId,
            incrementalCacheUpdater
          );

          // Use fallback output as node output
          context.setNodeOutput(nodeId, fallbackOutput);
          nodeOutput = fallbackOutput;

          logger.info('Fallback node executed successfully', {
            failedNodeId: nodeId,
            fallbackNodeId: errorConfig.fallbackNodeId,
          });

          // Continue execution from fallback node's output
          // Don't throw error, continue to next nodes
        } catch (fallbackError) {
          // Fallback node also failed → stop workflow
          logger.error('Fallback node also failed', {
            failedNodeId: nodeId,
            fallbackNodeId: errorConfig.fallbackNodeId,
            error: fallbackError.message,
          });
          throw fallbackError;
        }
      } else {
        // Fallback node not found → stop workflow
        logger.error('Fallback node not found', {
          nodeId,
          fallbackNodeId: errorConfig.fallbackNodeId,
        });
        throw error;
      }
    } else {
      // Default: stop on error (onError === 'stop' or not configured)
      throw error;
    }
  }

  // Handle end node
  if (node.type === 'end') {
    return nodeOutput;
  }

  // Handle merge node (waits for all incoming parallel branches)
  if (node.type === 'merge') {
    // Merge node needs to collect outputs from all incoming nodes
    // Find all nodes that connect to this merge node
    const incomingEdges = edges.filter(edge => edge.target === nodeId);
    const incomingNodeIds = incomingEdges.map(edge => edge.source);

    logger.info('Merge node collecting inputs', {
      nodeId,
      incomingNodeIds,
      incomingEdgesCount: incomingEdges.length,
      allNodeOutputsKeys: Array.from(context.nodeOutputs.keys()),
    });

    // Collect outputs from all incoming nodes
    const incomingOutputs = incomingNodeIds
      .map(sourceNodeId => {
        const sourceOutput = context.getNodeOutput(sourceNodeId);
        logger.debug('Merge node: checking source node output', {
          sourceNodeId,
          hasOutput: !!sourceOutput,
          outputType: typeof sourceOutput,
          isParallel: sourceOutput?.parallel,
          outputKeys:
            sourceOutput && typeof sourceOutput === 'object'
              ? Object.keys(sourceOutput)
              : null,
        });

        // If source output is from parallel execution, extract results
        if (sourceOutput && sourceOutput.parallel && sourceOutput.results) {
          // This is a parallel result object - extract the actual results
          return sourceOutput.results;
        }
        return sourceOutput;
      })
      .filter(output => output !== undefined);

    logger.info('Merge node collected inputs', {
      nodeId,
      inputCount: incomingOutputs.length,
      inputs: incomingOutputs.map((inp, idx) => ({
        index: idx,
        type: typeof inp,
        isObject: typeof inp === 'object',
        isArray: Array.isArray(inp),
        keys: typeof inp === 'object' && inp !== null ? Object.keys(inp) : null,
      })),
    });

    // Flatten if we have nested arrays from parallel executions
    const flattenedOutputs = incomingOutputs.flat();

    // Store in context for merge handler to access
    if (flattenedOutputs.length > 0) {
      context.setVariable('_mergeInputs', flattenedOutputs);
      logger.info('Merge node stored inputs in context', {
        nodeId,
        flattenedCount: flattenedOutputs.length,
      });
    } else {
      logger.warn('Merge node: No inputs collected', {
        nodeId,
        incomingNodeIds,
        nodeOutputsKeys: Array.from(context.nodeOutputs.keys()),
      });
    }

    // Merge node execution is handled in the node handler
    // It will use the collected outputs
  }

  // Handle if node (conditional branching)
  if (node.type === 'if') {
    const conditionResult = evaluateCondition(
      node.data.condition1,
      node.data.operator || '==',
      node.data.condition2,
      templateContext
    );

    // Find the edge that matches the condition result
    const handleId = conditionResult ? 'true' : 'false';
    const matchingEdge = edges.find(
      edge => edge.source === nodeId && edge.sourceHandle === handleId
    );

    const nextNodeId = conditionResult
      ? findNextNode(nodeId, adjacencyList, 'true', edges)
      : findNextNode(nodeId, adjacencyList, 'false', edges);

    // Mark the executed edge
    if (matchingEdge) {
      // Generate unique edge ID including sourceHandle to avoid conflicts
      // when multiple edges go from same source to same target
      const edgeId =
        matchingEdge.id ||
        `reactflow__edge-${matchingEdge.source}-${matchingEdge.sourceHandle || 'default'}-${matchingEdge.target}`;
      executedEdges.add(edgeId);
      logger.debug('If node condition evaluated', {
        nodeId,
        conditionResult,
        handleId,
        nextNodeId,
        edgeId,
      });
    } else {
      logger.warn('If node: Could not find matching edge', {
        nodeId,
        handleId,
        availableEdges: edges
          .filter(e => e.source === nodeId)
          .map(e => ({
            id: e.id,
            sourceHandle: e.sourceHandle,
            target: e.target,
          })),
      });
    }

    // Only execute the matching path, not both
    if (nextNodeId) {
      return executeNodeRecursive(
        nextNodeId,
        nodeMap,
        adjacencyList,
        context,
        edges,
        new Set(visited), // Reset visited for new branch
        executionLog,
        executedEdges,
        workflowId,
        incrementalCacheUpdater
      );
    }

    return nodeOutput;
  }

  // Handle switch node (multi-way conditional branching)
  if (node.type === 'switch') {
    const cases = node.data.cases || [];
    const hasDefault = node.data.hasDefault !== false;

    // Collect all matching cases (allow multiple matches)
    const matchedCases = [];
    cases.forEach((caseItem, index) => {
      if (
        evaluateCondition(
          caseItem.condition1,
          caseItem.operator || '==',
          caseItem.condition2,
          templateContext
        )
      ) {
        const handleId =
          caseItem.handleId ||
          (caseItem.id ? `case-${caseItem.id}` : `case-${index}`);
        matchedCases.push({
          caseItem,
          handleId,
        });
      }
    });

    if (matchedCases.length === 0 && hasDefault) {
      matchedCases.push({
        caseItem: null,
        handleId: 'default',
      });
    }

    if (matchedCases.length === 0) {
      logger.warn('Switch node: No matching case and no default output', {
        nodeId,
        casesCount: cases.length,
      });
      return nodeOutput;
    }

    const matchedBranches = [];

    matchedCases.forEach(({ caseItem, handleId }) => {
      const matchingEdges = edges.filter(
        edge => edge.source === nodeId && edge.sourceHandle === handleId
      );

      if (matchingEdges.length === 0) {
        logger.warn('Switch node: No edges found for handle', {
          nodeId,
          handleId,
        });
        return;
      }

      matchingEdges.forEach(matchingEdge => {
        const edgeId =
          matchingEdge.id ||
          `reactflow__edge-${matchingEdge.source}-${matchingEdge.sourceHandle || 'default'}-${matchingEdge.target}`;
        executedEdges.add(edgeId);

        logger.debug('Switch node case matched', {
          nodeId,
          matchedCase: caseItem
            ? `${caseItem.condition1} ${caseItem.operator} ${caseItem.condition2}`
            : 'default',
          handleId,
          nextNodeId: matchingEdge.target,
          edgeId,
        });

        matchedBranches.push({
          target: matchingEdge.target,
          sourceHandle: matchingEdge.sourceHandle,
        });
      });
    });

    if (matchedBranches.length === 0) {
      logger.warn('Switch node: No executable branches found after matching', {
        nodeId,
        matchedCaseCount: matchedCases.length,
      });
      return nodeOutput;
    }

    return executeOutgoingBranches(
      nodeId,
      matchedBranches,
      nodeMap,
      adjacencyList,
      context,
      edges,
      visited,
      executionLog,
      executedEdges,
      workflowId,
      incrementalCacheUpdater
    );
  }

  // Handle wait node
  if (node.type === 'wait') {
    const duration = node.data.duration || 0;
    if (duration > 0) {
      await new Promise(resolve => setTimeout(resolve, duration * 1000));
    }
  }

  // Continue to next nodes
  // Note: Edges are already marked as executed earlier (after node execution completes)
  // This ensures immediate visualization in the UI
  const nextNodes = adjacencyList[nodeId] || [];

  if (nextNodes.length > 0) {
    return executeOutgoingBranches(
      nodeId,
      nextNodes,
      nodeMap,
      adjacencyList,
      context,
      edges,
      visited,
      executionLog,
      executedEdges,
      workflowId,
      incrementalCacheUpdater
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
  // Handle 'exists' operator - doesn't need condition2
  if (operator === 'exists') {
    if (!condition1) {
      return false;
    }
    const resolvedCondition1 = resolveTemplate(condition1, context);
    // Check if value exists (not null, undefined, or empty string)
    return (
      resolvedCondition1 !== null &&
      resolvedCondition1 !== undefined &&
      resolvedCondition1 !== ''
    );
  }

  // For other operators, both conditions are required
  if (!condition1 || condition2 === undefined || condition2 === null) {
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
      case 'startsWith':
        return String(value1).startsWith(String(value2));
      case 'endsWith':
        return String(value1).endsWith(String(value2));
      case 'regex': {
        // Remove leading/trailing slashes if present
        let pattern = String(value2);
        if (pattern.startsWith('/') && pattern.endsWith('/')) {
          pattern = pattern.slice(1, -1);
        }
        try {
          const regex = new RegExp(pattern);
          return regex.test(String(value1));
        } catch (error) {
          logger.warn('Invalid regex pattern', {
            pattern,
            error: error.message,
          });
          return false;
        }
      }
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

async function executeOutgoingBranches(
  nodeId,
  nextNodes,
  nodeMap,
  adjacencyList,
  context,
  edges,
  visited,
  executionLog,
  executedEdges,
  workflowId,
  incrementalCacheUpdater
) {
  if (!nextNodes || nextNodes.length === 0) {
    return null;
  }

  if (nextNodes.length === 1) {
    const nextNode = nextNodes[0];
    return executeNodeRecursive(
      nextNode.target,
      nodeMap,
      adjacencyList,
      context,
      edges,
      visited,
      executionLog,
      executedEdges,
      workflowId,
      incrementalCacheUpdater
    );
  }

  logger.info('Executing multiple branches in parallel', {
    nodeId,
    branchCount: nextNodes.length,
    targets: nextNodes.map(n => n.target),
  });

  const branchContexts = [];
  const parallelExecutions = nextNodes.map((nextNode, index) => {
    const branchContext = context.clone();
    branchContexts[index] = branchContext;
    const branchVisited = new Set(visited);

    return executeNodeRecursive(
      nextNode.target,
      nodeMap,
      adjacencyList,
      branchContext,
      edges,
      branchVisited,
      executionLog,
      executedEdges,
      workflowId,
      incrementalCacheUpdater
    ).catch(error => {
      logger.error('Error in parallel branch execution', {
        sourceNodeId: nodeId,
        targetNodeId: nextNode.target,
        error: error.message,
      });
      return {
        error: true,
        errorMessage: error.message,
        nodeId: nextNode.target,
      };
    });
  });

  const results = await Promise.all(parallelExecutions);

  nextNodes.forEach((nextNode, index) => {
    const branchContext = branchContexts[index];
    const branchResult = results[index];

    logger.info('Copying outputs from parallel branch', {
      branchIndex: index,
      targetNodeId: nextNode.target,
      hasBranchContext: !!branchContext,
      hasBranchResult: !!branchResult,
      branchResultError: branchResult?.error,
      branchOutputsCount: branchContext?.nodeOutputs?.size || 0,
    });

    if (branchContext) {
      branchContext.nodeOutputs.forEach((output, outputNodeId) => {
        if (!context.nodeOutputs.has(outputNodeId)) {
          context.setNodeOutput(outputNodeId, output);
          logger.debug('Copied node output from branch to main context', {
            branchIndex: index,
            sourceNodeId: outputNodeId,
            targetNodeId: nextNode.target,
            hasOutput: !!output,
            outputType: typeof output,
          });
        } else {
          logger.debug('Skipped copying output (already exists)', {
            branchIndex: index,
            sourceNodeId: outputNodeId,
            existingOutputType: typeof context.nodeOutputs.get(outputNodeId),
          });
        }
      });
    }

    if (branchResult && !branchResult.error) {
      if (!context.nodeOutputs.has(nextNode.target)) {
        if (branchResult.parallel && branchResult.results) {
          const lastResult =
            branchResult.results[branchResult.results.length - 1];
          context.setNodeOutput(nextNode.target, lastResult);
        } else {
          context.setNodeOutput(nextNode.target, branchResult);
        }
        logger.debug(
          'Stored branch result for first node (no existing output)',
          {
            branchIndex: index,
            targetNodeId: nextNode.target,
          }
        );
      }
    } else if (branchResult?.error) {
      if (!context.nodeOutputs.has(nextNode.target)) {
        logger.warn('Branch execution had error', {
          branchIndex: index,
          targetNodeId: nextNode.target,
          error: branchResult.errorMessage,
        });
        context.setNodeOutput(nextNode.target, branchResult);
      }
    }
  });

  logger.info('Copied node outputs from parallel branches to main context', {
    nodeId,
    branchCount: nextNodes.length,
    totalOutputsCopied: Array.from(context.nodeOutputs.keys()).length,
  });

  return {
    parallel: true,
    results,
    count: results.length,
  };
}

/**
 * Match a value against a switch case
 * @param {*} value - Value to match
 * @param {Object} caseItem - Case configuration
 * @param {Object} context - Template context
 * @returns {boolean} - Whether the case matches
 */
function matchCase(value, caseItem, context) {
  if (!caseItem || !caseItem.value) {
    return false;
  }

  const matchType = caseItem.matchType || 'exact';
  const caseValue = resolveTemplate(caseItem.value, context);

  try {
    switch (matchType) {
      case 'exact':
        return String(value) === String(caseValue);

      case 'contains':
        return String(value).includes(String(caseValue));

      case 'startsWith':
        return String(value).startsWith(String(caseValue));

      case 'endsWith':
        return String(value).endsWith(String(caseValue));

      case 'regex': {
        // Remove leading/trailing slashes if present
        let pattern = String(caseValue);
        if (pattern.startsWith('/') && pattern.endsWith('/')) {
          pattern = pattern.slice(1, -1);
        }
        try {
          const regex = new RegExp(pattern);
          return regex.test(String(value));
        } catch (error) {
          logger.warn('Invalid regex pattern in switch case', {
            pattern,
            error: error.message,
          });
          return false;
        }
      }

      case 'greater': {
        const num1 = parseFloat(value);
        const num2 = parseFloat(caseValue);
        if (isNaN(num1) || isNaN(num2)) {
          return false;
        }
        return num1 > num2;
      }

      case 'less': {
        const num1 = parseFloat(value);
        const num2 = parseFloat(caseValue);
        if (isNaN(num1) || isNaN(num2)) {
          return false;
        }
        return num1 < num2;
      }

      case 'range': {
        // Parse range like "0-100" or "10-20"
        const rangeMatch = String(caseValue).match(
          /^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/
        );
        if (!rangeMatch) {
          logger.warn('Invalid range format in switch case', { caseValue });
          return false;
        }
        const num = parseFloat(value);
        if (isNaN(num)) {
          return false;
        }
        const min = parseFloat(rangeMatch[1]);
        const max = parseFloat(rangeMatch[2]);
        return num >= min && num <= max;
      }

      default:
        logger.warn('Unknown match type in switch case', { matchType });
        return false;
    }
  } catch (error) {
    logger.warn('Failed to match switch case', {
      value,
      caseValue,
      matchType,
      error: error.message,
    });
    return false;
  }
}
