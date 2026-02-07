/**
 * Log and query workflow agent actions (explainable AI).
 */
import { db } from '#config/database.js';
import { workflowAgentActions } from '#models/workflow-agent-action.model.js';
import { fullWorkflows } from '#models/full-workflow.model.js';
import { eq, and, desc } from 'drizzle-orm';
import logger from '#config/logger.js';

const AGENT_TYPES = ['orchestrator', 'monitoring', 'optimization', 'security', 'execution'];
const ACTION_TYPES = ['workflow_updated', 'node_updated', 'suggestion', 'chat', 'check_performed'];
const OPTIMIZATION_IMPACT = ['helped', 'neutral', 'unknown', 'not_applicable'];

/**
 * Log an agent action.
 * @param {object} params
 * @param {number} params.workflowId
 * @param {string} params.agentType - orchestrator | monitoring | optimization | security | execution
 * @param {string} params.actionType - workflow_updated | node_updated | suggestion | chat | check_performed
 * @param {object} [params.details] - JSON (what changed, node IDs, reason, etc.)
 * @param {string} [params.optimizationImpact] - helped | neutral | unknown | not_applicable
 * @param {number} [params.workflowVersionId]
 */
export async function logAgentAction(params) {
  const {
    workflowId,
    agentType,
    actionType,
    details,
    optimizationImpact,
    workflowVersionId,
  } = params;

  if (!AGENT_TYPES.includes(agentType)) {
    logger.warn('logAgentAction: invalid agent_type', { agentType });
  }
  if (!ACTION_TYPES.includes(actionType)) {
    logger.warn('logAgentAction: invalid action_type', { actionType });
  }

  try {
    const [row] = await db
      .insert(workflowAgentActions)
      .values({
        workflow_id: workflowId,
        agent_type: agentType,
        action_type: actionType,
        details: details ?? null,
        optimization_impact: optimizationImpact && OPTIMIZATION_IMPACT.includes(optimizationImpact)
          ? optimizationImpact
          : null,
        workflow_version_id:
          workflowVersionId != null && Number(workflowVersionId) > 0
            ? Number(workflowVersionId)
            : null,
      })
      .returning();

    logger.info('Agent action logged', { workflowId, agentType, actionType, id: row?.id });
    return row;
  } catch (err) {
    logger.error('Failed to log agent action', { workflowId, error: err.message });
    throw err;
  }
}

/**
 * Get recent agent actions for a workflow (for UI / version history).
 */
export async function getWorkflowAgentActions(workflowId, userId, options = {}) {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const [workflow] = await db
    .select()
    .from(fullWorkflows)
    .where(eq(fullWorkflows.id, workflowId))
    .limit(1);

  if (!workflow || workflow.user_id !== userId) {
    throw new Error('Workflow not found or unauthorized');
  }

  const actions = await db
    .select()
    .from(workflowAgentActions)
    .where(eq(workflowAgentActions.workflow_id, workflowId))
    .orderBy(desc(workflowAgentActions.created_at))
    .limit(limit)
    .offset(offset);

  return actions;
}

/**
 * Get chat messages for agent chat UI (from workflow_agent_actions with action_type=chat).
 * Returns list of { role: 'user'|'assistant', content } in chronological order.
 */
export async function getWorkflowAgentChatMessages(workflowId, userId, options = {}) {
  const limit = options.limit ?? 50;
  const actions = await getWorkflowAgentActions(workflowId, userId, { limit, offset: 0 });
  const chatActions = actions.filter(a => a.action_type === 'chat').reverse();
  const messages = [];
  for (const a of chatActions) {
    const d = a.details || {};
    if (d.userMessage) messages.push({ role: 'user', content: d.userMessage });
    if (d.assistantMessage) messages.push({ role: 'assistant', content: d.assistantMessage });
  }
  return messages;
}
