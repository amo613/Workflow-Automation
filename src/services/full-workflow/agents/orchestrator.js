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
import { applyOptimizationChanges } from './apply-changes.service.js';
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
 * @param {object} options - { skipMonitoring, skipOptimization, skipSecurity, skipExecution, executionContext?: { lastError, executionSuccess }, autoApply, focusOnGoal }
 * @returns {Promise<{ monitoring?, optimization?, security?, execution?, autoApplyResult?, error? }>}
 */
export async function runAgentPipeline(workflowId, userId, options = {}) {
  const startTime = Date.now();
  let workflow;

  try {
    workflow = await getFullWorkflow(workflowId, userId);
  } catch (err) {
    logger.warn('Orchestrator: workflow not found or unauthorized', {
      workflowId,
      userId,
      error: err.message,
    });
    return { error: err.message };
  }

  if (!workflow.agents_enabled) {
    logger.debug('Orchestrator: agents not enabled', { workflowId });
    return { skipped: true, reason: 'agents_not_enabled' };
  }

  // Load stats and history first (needed for all agents)
  let stats = null;
  let executionHistory = [];
  try {
    [stats, executionHistory] = await Promise.all([
      getWorkflowStatistics(workflowId),
      getWorkflowExecutionHistory(workflowId, 20),
    ]);
  } catch (err) {
    logger.warn('Orchestrator: failed to load stats/history', {
      workflowId,
      error: err.message,
    });
    // Continue without stats
  }

  // Fetch goal research (web search for goal + error)
  const goalResearch = await fetchGoalResearch(
    workflow,
    options.executionContext || {}
  );

  const results = {
    startTime,
    workflowId,
    goalMetrics: stats?.goalMetrics,
  };

  // Run agents in logical order
  // 1. Monitoring: Understand current state and goal achievement
  if (!options.skipMonitoring) {
    const ctx = getMonitoringContext(
      workflow,
      stats,
      executionHistory,
      goalResearch
    );
    ctx.goalMetrics = stats?.goalMetrics;
    ctx.executionContext = options.executionContext;

    try {
      results.monitoring = await runMonitoringAgent(workflowId, ctx);
    } catch (err) {
      logger.error('Orchestrator: monitoring agent failed', {
        workflowId,
        error: err.message,
      });
      results.monitoring = { success: false, error: err.message };
    }
  }

  // 2. Security: Check for vulnerabilities (run in parallel with execution)
  const securityPromise = !options.skipSecurity
    ? (async () => {
        try {
          const ctx = getSecurityContext(workflow, goalResearch);
          return await runSecurityAgent(workflowId, ctx);
        } catch (err) {
          logger.error('Orchestrator: security agent failed', {
            workflowId,
            error: err.message,
          });
          return { success: false, error: err.message };
        }
      })()
    : Promise.resolve(null);

  // 3. Execution: Validate workflow structure (run in parallel with security)
  const executionPromise = !options.skipExecution
    ? (async () => {
        try {
          const ctx = getExecutionContext(workflow, goalResearch);
          return await runExecutionAgent(workflowId, ctx);
        } catch (err) {
          logger.error('Orchestrator: execution agent failed', {
            workflowId,
            error: err.message,
          });
          return { success: false, error: err.message };
        }
      })()
    : Promise.resolve(null);

  // Wait for security and execution in parallel
  [results.security, results.execution] = await Promise.all([
    securityPromise,
    executionPromise,
  ]);

  // 4. Optimization: Suggest and apply changes (after understanding current state)
  if (!options.skipOptimization) {
    const ctx = getOptimizationContext(workflow, stats, goalResearch);
    ctx.goalMetrics = stats?.goalMetrics;
    ctx.executionContext = options.executionContext;
    ctx.focusOnGoal = options.focusOnGoal;

    try {
      results.optimization = await runOptimizationAgent(
        workflowId,
        ctx,
        options.optimizationOptions || {}
      );

      // Auto-apply changes if enabled and changes exist
      if (
        options.autoApply !== false &&
        results.optimization?.changes?.length > 0
      ) {
        try {
          // Re-fetch workflow to ensure we have latest version
          const latestWorkflow = await getFullWorkflow(workflowId, userId);

          results.autoApplyResult = await applyOptimizationChanges(
            workflowId,
            userId,
            latestWorkflow,
            results.optimization.changes
          );

          logger.info('Orchestrator: auto-applied changes', {
            workflowId,
            appliedCount: results.autoApplyResult?.appliedCount || 0,
            versionId: results.autoApplyResult?.versionId,
          });
        } catch (applyErr) {
          logger.error('Orchestrator: failed to auto-apply changes', {
            workflowId,
            error: applyErr.message,
            stack: applyErr.stack,
          });
          results.autoApplyResult = { success: false, error: applyErr.message };
        }
      }
    } catch (err) {
      logger.error('Orchestrator: optimization agent failed', {
        workflowId,
        error: err.message,
      });
      results.optimization = { success: false, error: err.message };
    }
  }

  // Log final results
  const duration = Date.now() - startTime;

  await logAgentAction({
    workflowId,
    agentType: 'orchestrator',
    actionType: 'pipeline_completed',
    details: {
      summary: 'Agent pipeline run completed',
      duration,
      results: {
        monitoring: results.monitoring?.success,
        optimization: results.optimization?.success,
        security: results.security?.success,
        execution: results.execution?.success,
      },
      autoApplied: results.autoApplyResult?.appliedCount || 0,
      goalMetrics: stats?.goalMetrics,
      executionContext: options.executionContext,
    },
    optimizationImpact:
      results.autoApplyResult?.appliedCount > 0 ? 'helped' : 'neutral',
  });

  results.duration = duration;
  results.success = true;

  return results;
}
