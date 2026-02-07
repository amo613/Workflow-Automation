/**
 * Agent chat: one turn with the workflow agent (orchestrator context + optional node focus).
 */
import { openRouterChat } from './openrouter.client.js';
import { getSingleNodeContext } from './context.js';
import { logAgentAction } from '#services/workflow-agent-action.service.js';

/**
 * Build system prompt for the workflow agent chat (goal + workflow summary or node context).
 */
function buildSystemPrompt(workflow, nodeContext = null) {
  const goal = workflow.goal_definition
    ? JSON.stringify(workflow.goal_definition, null, 2)
    : 'Not set';
  let context = `You are a helpful workflow assistant. The user is editing a workflow named "${workflow.name}".
Goal definition: ${goal}
Workflow structure (nodes and edges): ${JSON.stringify(
    {
      nodes: (workflow.workflow_json?.nodes || []).map(n => ({
        id: n.id,
        type: n.type,
        data: Object.keys(n.data || {}).length ? '(config present)' : {},
      })),
      edges: workflow.workflow_json?.edges || [],
    },
    null,
    2
  )}`;
  if (nodeContext) {
    context += `\n\nThe user is asking about a specific node:\n${JSON.stringify(nodeContext, null, 2)}`;
  }
  context += `\n\nAnswer concisely. You can explain nodes, suggest optimizations, or answer questions about the workflow. Do not expose secrets or raw credentials.`;
  return context;
}

/**
 * Run one agent chat turn: user message -> LLM -> log and return reply.
 * @param {object} payload - { message, node_id?, previousMessages?: [{ role, content }] }
 */
export async function runAgentChatTurn(workflowId, userId, workflow, payload) {
  const { message, node_id: nodeId, previousMessages = [] } = payload || {};
  if (!message || typeof message !== 'string' || !message.trim()) {
    return { success: false, error: 'message is required' };
  }

  const nodeContext = nodeId
    ? getSingleNodeContext(workflow, nodeId)
    : null;

  const systemPrompt = buildSystemPrompt(workflow, nodeContext);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...previousMessages.slice(-20).map(m => ({ role: m.role, content: m.content || '' })),
    { role: 'user', content: message.trim() },
  ];

  const { content: reply, error } = await openRouterChat(
    messages,
    { temperature: 0.4, max_tokens: 2048 }
  );

  if (error) {
    await logAgentAction({
      workflowId,
      agentType: 'orchestrator',
      actionType: 'chat',
      details: { userMessage: message.trim(), error, assistantMessage: null },
      optimizationImpact: 'not_applicable',
    });
    return { success: false, error, reply: null };
  }

  await logAgentAction({
    workflowId,
    agentType: 'orchestrator',
    actionType: 'chat',
    details: {
      userMessage: message.trim(),
      assistantMessage: reply || '',
      nodeId: nodeId || null,
    },
    optimizationImpact: 'not_applicable',
  });

  return { success: true, reply: reply || '' };
}
