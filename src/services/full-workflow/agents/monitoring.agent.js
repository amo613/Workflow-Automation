/**
 * Monitoring agent: analyses execution stats and errors. Guardrail: no workflow_json.
 */
import { openRouterChat } from './openrouter.client.js';
import { logAgentAction } from '#services/workflow-agent-action.service.js';

export async function runMonitoringAgent(workflowId, context) {
  const systemPrompt = `You are a workflow monitoring agent. You only receive execution statistics and error history, not the workflow structure.
Analyze the data and suggest improvements or report issues. Be concise. If you have no insights, say so.`;

  const userContent = `Workflow: ${context.name}
Goal: ${JSON.stringify(context.goal_definition || 'none')}
Stats: ${JSON.stringify(context.stats || {}, null, 2)}
Recent execution history (sample): ${JSON.stringify(context.executionHistory || [], null, 2)}`;

  const { content, error } = await openRouterChat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    { temperature: 0.2, max_tokens: 1024 }
  );

  if (error) {
    await logAgentAction({
      workflowId,
      agentType: 'monitoring',
      actionType: 'check_performed',
      details: { error, context: 'monitoring_agent_failed' },
      optimizationImpact: 'not_applicable',
    });
    return { success: false, error, suggestion: null };
  }

  await logAgentAction({
    workflowId,
    agentType: 'monitoring',
    actionType: 'check_performed',
    details: { summary: content?.slice(0, 500), fullResponse: content },
    optimizationImpact: 'unknown',
  });

  return { success: true, suggestion: content };
}
