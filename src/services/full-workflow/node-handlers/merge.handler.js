import logger from '#config/logger.js';

/**
 * Execute Merge Node
 * Merges outputs from multiple parallel branches
 *
 * The merge node receives outputs from multiple incoming branches.
 * It combines them according to the configured merge strategy.
 */
export async function executeMerge(node, templateContext, variableContext) {
  const { data } = node;
  const mergeStrategy = data?.mergeStrategy || 'array'; // 'array', 'first', 'last', 'merge', 'wait-all'

  logger.info('Executing merge node', {
    nodeId: node.id,
    mergeStrategy,
  });

  // Get all incoming node outputs from parallel branches
  // Option 1: Check if previous output is from parallel execution
  const previousOutput = templateContext.previousNodeOutput;

  if (previousOutput && previousOutput.parallel && previousOutput.results) {
    // This is a direct result from parallel execution
    const results = previousOutput.results;

    logger.info('Merging parallel execution results', {
      nodeId: node.id,
      resultCount: results.length,
      mergeStrategy,
    });

    return mergeResults(results, mergeStrategy);
  }

  // Option 2: Get collected inputs from context (set by executor)
  const mergeInputs = variableContext.getVariable('_mergeInputs');
  if (mergeInputs && Array.isArray(mergeInputs) && mergeInputs.length > 0) {
    logger.info('Merging collected inputs from context', {
      nodeId: node.id,
      inputCount: mergeInputs.length,
      mergeStrategy,
      inputs: mergeInputs.map((inp, idx) => ({
        index: idx,
        type: typeof inp,
        isObject: typeof inp === 'object',
        keys: typeof inp === 'object' && inp !== null ? Object.keys(inp) : null,
      })),
    });

    return mergeResults(mergeInputs, mergeStrategy);
  }

  // Option 2b: Try to get from all node outputs in context
  // This handles cases where parallel branches stored outputs directly
  const allNodeOutputs = templateContext.nodeOutputs || {};
  const incomingNodeIds = Object.keys(allNodeOutputs).filter(() => {
    // Check if this node's output should be included
    // For now, include all outputs (merge node will filter as needed)
    return true;
  });

  if (incomingNodeIds.length > 0) {
    const collectedOutputs = incomingNodeIds
      .map(nodeId => allNodeOutputs[nodeId])
      .filter(output => output !== undefined && output !== null);

    if (collectedOutputs.length > 0) {
      logger.info('Merging from all node outputs', {
        nodeId: node.id,
        outputCount: collectedOutputs.length,
        mergeStrategy,
      });

      return mergeResults(collectedOutputs, mergeStrategy);
    }
  }

  // Option 3: Try to get from workflow input (fallback)
  const workflowInput = templateContext.workflowInput || {};
  if (workflowInput._parallelResults) {
    return mergeResults(workflowInput._parallelResults, mergeStrategy);
  }

  // Fallback: return empty result or previous output
  logger.warn('Merge node: No parallel results found', {
    nodeId: node.id,
    previousOutputType: typeof previousOutput,
  });

  return {
    merged: true,
    strategy: mergeStrategy,
    results: [],
    count: 0,
  };
}

/**
 * Merge results according to strategy
 * @param {Array} results - Array of results from parallel branches
 * @param {string} strategy - Merge strategy: 'array', 'first', 'last', 'merge'
 * @returns {*} - Merged result
 */
function mergeResults(results, strategy) {
  // Filter out error results if needed
  // But log them for debugging
  const errorResults = results.filter(r => r?.error);
  if (errorResults.length > 0) {
    logger.warn('Merge node: filtering out error results', {
      errorCount: errorResults.length,
      errors: errorResults.map(e => ({
        error: e.error,
        errorMessage: e.errorMessage,
        nodeId: e.nodeId,
      })),
    });
  }
  const validResults = results.filter(r => !r?.error);

  switch (strategy) {
    case 'array':
      // Return all results as an array
      return {
        merged: true,
        strategy: 'array',
        results: validResults,
        count: validResults.length,
      };

    case 'first':
      // Return only the first result
      return validResults.length > 0
        ? {
            merged: true,
            strategy: 'first',
            result: validResults[0],
          }
        : null;

    case 'last':
      // Return only the last result
      return validResults.length > 0
        ? {
            merged: true,
            strategy: 'last',
            result: validResults[validResults.length - 1],
          }
        : null;

    case 'merge': {
      // Merge all results into a single object
      const merged = {};
      validResults.forEach((result, index) => {
        if (result && typeof result === 'object' && !Array.isArray(result)) {
          Object.assign(merged, result);
        } else {
          merged[`branch_${index}`] = result;
        }
      });
      return {
        merged: true,
        strategy: 'merge',
        data: merged,
        count: validResults.length,
      };
    }

    default:
      // Default: return as array
      return {
        merged: true,
        strategy: 'array',
        results: validResults,
        count: validResults.length,
      };
  }
}
