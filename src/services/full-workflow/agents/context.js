/**
 * Build scoped context per agent (guardrails). Each agent receives only what it needs.
 */

/**
 * Monitoring agent: only execution stats, errors, logs. No full workflow_json.
 * @param {object} goalResearch - optional { goalSearch, errorSearch } from fetchGoalResearch
 */
export function getMonitoringContext(workflow, stats = null, executionHistory = [], goalResearch = null) {
  const ctx = {
    workflowId: workflow.id,
    name: workflow.name,
    goal_definition: workflow.goal_definition,
    stats: stats || null,
    executionHistory: executionHistory.slice(0, 20),
  };
  if (goalResearch && (goalResearch.goalSearch?.length || goalResearch.errorSearch?.length)) {
    ctx.goalResearch = goalResearch;
  }
  return ctx;
}

/**
 * Optimization agent: workflow structure, stats, goal. No raw user/integration data.
 * @param {object} goalResearch - optional { goalSearch, errorSearch } from fetchGoalResearch
 */
export function getOptimizationContext(workflow, stats = null, goalResearch = null) {
  const ctx = {
    workflowId: workflow.id,
    name: workflow.name,
    description: workflow.description,
    goal_definition: workflow.goal_definition,
    workflow_json: workflow.workflow_json,
    stats: stats || null,
  };
  if (goalResearch && (goalResearch.goalSearch?.length || goalResearch.errorSearch?.length)) {
    ctx.goalResearch = goalResearch;
  }
  return ctx;
}

/**
 * Security agent: workflow structure, trigger config, external calls. No execution logs.
 * @param {object} goalResearch - optional { goalSearch, errorSearch } from fetchGoalResearch
 */
export function getSecurityContext(workflow, goalResearch = null) {
  const ctx = {
    workflowId: workflow.id,
    name: workflow.name,
    workflow_json: workflow.workflow_json,
    trigger_config: workflow.trigger_config || null,
  };
  if (goalResearch && (goalResearch.goalSearch?.length || goalResearch.errorSearch?.length)) {
    ctx.goalResearch = goalResearch;
  }
  return ctx;
}

/**
 * Execution agent: only what executor needs (nodes, edges, config).
 * @param {object} goalResearch - optional { goalSearch, errorSearch } from fetchGoalResearch
 */
export function getExecutionContext(workflow, goalResearch = null) {
  const wj = workflow.workflow_json || {};
  const ctx = {
    workflowId: workflow.id,
    nodes: wj.nodes || [],
    edges: wj.edges || [],
    trigger_config: workflow.trigger_config || null,
  };
  if (goalResearch && (goalResearch.goalSearch?.length || goalResearch.errorSearch?.length)) {
    ctx.goalResearch = goalResearch;
  }
  return ctx;
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
