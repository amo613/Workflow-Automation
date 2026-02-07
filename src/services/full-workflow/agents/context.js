/**
 * Build scoped context per agent (guardrails). Each agent receives only what it needs.
 */

/**
 * Monitoring agent: only execution stats, errors, logs. No full workflow_json.
 */
export function getMonitoringContext(workflow, stats = null, executionHistory = []) {
  return {
    workflowId: workflow.id,
    name: workflow.name,
    goal_definition: workflow.goal_definition,
    stats: stats || null,
    executionHistory: executionHistory.slice(0, 20),
    // No workflow_json
  };
}

/**
 * Optimization agent: workflow structure, stats, goal. No raw user/integration data.
 */
export function getOptimizationContext(workflow, stats = null) {
  return {
    workflowId: workflow.id,
    name: workflow.name,
    description: workflow.description,
    goal_definition: workflow.goal_definition,
    workflow_json: workflow.workflow_json,
    stats: stats || null,
  };
}

/**
 * Security agent: workflow structure, trigger config, external calls. No execution logs.
 */
export function getSecurityContext(workflow) {
  return {
    workflowId: workflow.id,
    name: workflow.name,
    workflow_json: workflow.workflow_json,
    trigger_config: workflow.trigger_config || null,
  };
}

/**
 * Execution agent: only what executor needs (nodes, edges, config).
 */
export function getExecutionContext(workflow) {
  const wj = workflow.workflow_json || {};
  return {
    workflowId: workflow.id,
    nodes: wj.nodes || [],
    edges: wj.edges || [],
    trigger_config: workflow.trigger_config || null,
  };
}

/**
 * Get context for a single node (for "explain this node" / "optimize this node").
 */
export function getSingleNodeContext(workflow, nodeId) {
  const wj = workflow.workflow_json || {};
  const nodes = wj.nodes || [];
  const edges = wj.edges || [];
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return null;
  const incoming = edges.filter(e => e.target === nodeId);
  const outgoing = edges.filter(e => e.source === nodeId);
  return {
    workflowId: workflow.id,
    node,
    nodeId,
    incomingEdges: incoming,
    outgoingEdges: outgoing,
    goal_definition: workflow.goal_definition,
  };
}
