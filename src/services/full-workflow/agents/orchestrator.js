/**
 * Orchestrator: runs the agent pipeline with guardrails (each agent gets only its context).
 */
import { getFullWorkflow } from '#services/full-workflow.service.js';
import {
  getWorkflowStatistics,
  getWorkflowExecutionHistory,
} from '#services/full-workflow/statistics.service.js';
import { logAgentAction } from '#services/workflow-agent-action.service.js';
import {
  getMonitoringContext,
  getOptimizationContext,
  getSecurityContext,
  getExecutionContext,
} from './context.js';
import { fetchGoalResearch } from './goal-research.js';
import { runMonitoringAgent } from './monitoring.agent.js';
import { runOptimizationAgent } from './optimization.agent.js';
import { runSecurityAgent } from './security.agent.js';
import { runExecutionAgent } from './execution.agent.js';
import logger from '#config/logger.js';

/**
 * Run the full agent pipeline for a workflow (when agents_enabled).
 * Each agent receives only its scoped context (guardrails).
 * @param {number} workflowId
 * @param {number} userId
 * @param {object} options - { skipMonitoring, skipOptimization, skipSecurity, skipExecution, executionContext?: { lastError } }
 * @returns {Promise<{ monitoring?, optimization?, security?, execution?, error? }>}
 */
export async function runAgentPipeline(workflowId, userId, options = {}) {
  let workflow;
  try {
    workflow = await getFullWorkflow(workflowId, userId);
  } catch (err) {
    logger.warn('Orchestrator: workflow not found or unauthorized', { workflowId, userId });
    return { error: err.message };
  }

  if (!workflow.agents_enabled) {
    return { skipped: true, reason: 'agents_not_enabled' };
  }

  let stats = null;
  let executionHistory = [];
  try {
    stats = await getWorkflowStatistics(workflowId);
  } catch {
    // ignore
  }
  try {
    executionHistory = await getWorkflowExecutionHistory(workflowId, 20);
  } catch {
    // ignore
  }

  const goalResearch = await fetchGoalResearch(workflow, options.executionContext || {});
  const results = {};

  if (!options.skipMonitoring) {
    const ctx = getMonitoringContext(workflow, stats, executionHistory, goalResearch);
    results.monitoring = await runMonitoringAgent(workflowId, ctx);
  }

  if (!options.skipOptimization) {
    const ctx = getOptimizationContext(workflow, stats, goalResearch);
    results.optimization = await runOptimizationAgent(workflowId, ctx, options.optimizationOptions || {});
  }

  if (!options.skipSecurity) {
    const ctx = getSecurityContext(workflow, goalResearch);
    results.security = await runSecurityAgent(workflowId, ctx);
  }

  if (!options.skipExecution) {
    const ctx = getExecutionContext(workflow, goalResearch);
    results.execution = await runExecutionAgent(workflowId, ctx);
  }

  await logAgentAction({
    workflowId,
    agentType: 'orchestrator',
    actionType: 'check_performed',
    details: {
      summary: 'Pipeline run completed',
      results: {
        monitoring: results.monitoring?.success,
        optimization: results.optimization?.success,
        security: results.security?.success,
        execution: results.execution?.success,
      },
    },
    optimizationImpact: 'unknown',
  });

  return results;
}
