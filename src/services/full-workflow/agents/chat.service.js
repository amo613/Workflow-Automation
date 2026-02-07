/**
 * Agent chat: one turn with the workflow agent.
 * Chat agent has full READ access to workflow, stats, execution history, trigger config –
 * it can see and report everything when asked.
 */
import { openRouterChat } from './openrouter.client.js';
import { getSingleNodeContext } from './context.js';
import { logAgentAction } from '#services/workflow-agent-action.service.js';

/**
 * Build system prompt with full read context so the agent can answer anything about the workflow.
 * Includes: full workflow (name, description, type, goal, workflow_json, trigger_config),
 * stats, execution history, optional single-node focus.
 */
function buildSystemPrompt(workflow, options = {}) {
  const { nodeContext = null, stats = null, executionHistory = [] } = options;

  const sections = [];

  sections.push(`You are a helpful workflow assistant with full READ access to this workflow. You can see and explain everything. Answer any question about the workflow, nodes, configuration, execution, errors, or optimization. Do not expose raw secrets or credentials in your answers; refer to them as "configured" or "set" when relevant.`);

  sections.push(`## Workflow metadata
- Name: ${workflow.name || 'Unnamed'}
- Description: ${workflow.description || 'None'}
- Type: ${workflow.type || 'automation'}
- Goal definition: ${workflow.goal_definition ? JSON.stringify(workflow.goal_definition, null, 2) : 'Not set'}`);

  sections.push(`## Full workflow structure (nodes and edges)
\`\`\`json
${JSON.stringify(workflow.workflow_json || { nodes: [], edges: [] }, null, 2)}
\`\`\``);

  if (workflow.trigger_config && Object.keys(workflow.trigger_config).length > 0) {
    sections.push(`## Trigger configuration
\`\`\`json
${JSON.stringify(workflow.trigger_config, null, 2)}
\`\`\``);
  }

  if (stats && typeof stats === 'object') {
    sections.push(`## Execution statistics
\`\`\`json
${JSON.stringify(stats, null, 2)}
\`\`\``);
  }

  if (Array.isArray(executionHistory) && executionHistory.length > 0) {
    sections.push(`## Recent execution history (last ${executionHistory.length})
\`\`\`json
${JSON.stringify(executionHistory.slice(0, 15), null, 2)}
\`\`\``);
  }

  if (nodeContext) {
    sections.push(`## User is asking about this specific node
\`\`\`json
${JSON.stringify(nodeContext, null, 2)}
\`\`\``);
  }

  sections.push(`Answer in the user's language. Be precise and cite the data above when relevant.`);

  return sections.join('\n\n');
}

/**
 * Run one agent chat turn: user message -> LLM -> log and return reply.
 * @param {object} payload - { message, node_id?, previousMessages?, stats?, executionHistory? }
 */
export async function runAgentChatTurn(workflowId, userId, workflow, payload) {
  const {
    message,
    node_id: nodeId,
    previousMessages = [],
    stats = null,
    executionHistory = [],
  } = payload || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return { success: false, error: 'message is required' };
  }

  const nodeContext = nodeId
    ? getSingleNodeContext(workflow, nodeId)
    : null;

  const systemPrompt = buildSystemPrompt(workflow, {
    nodeContext,
    stats,
    executionHistory,
  });

  const messages = [
    { role: 'system', content: systemPrompt },
    ...previousMessages.slice(-20).map(m => ({ role: m.role, content: m.content || '' })),
    { role: 'user', content: message.trim() },
  ];

  const { content: reply, error } = await openRouterChat(
    messages,
    { temperature: 0.4, max_tokens: 4096 }
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
