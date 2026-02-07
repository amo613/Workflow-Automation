/**
 * Execution agent: validates that the workflow can be executed (structure, required config).
 * Guardrail: only nodes, edges, trigger_config.
 */
import { openRouterChat } from './openrouter.client.js';
import { logAgentAction } from '#services/workflow-agent-action.service.js';

export async function runExecutionAgent(workflowId, context) {
  const systemPrompt = `You are an execution readiness agent. You receive only nodes and edges (no secrets).
Check: Are there any nodes that would prevent execution? (e.g. missing required fields, invalid connections?)
If goalResearch is provided (e.g. error search results), use it to inform possible causes or solutions.
Respond in JSON: { "summary": "...", "blockers": [{ "nodeId": "...", "reason": "..." }], "ready": boolean }.`;

  let userContent = `Nodes: ${JSON.stringify(context.nodes || [], null, 2)}
Edges: ${JSON.stringify(context.edges || [], null, 2)}
Trigger config present: ${!!context.trigger_config}`;
  if (context.goalResearch && (context.goalResearch.goalSearch?.length || context.goalResearch.errorSearch?.length)) {
    userContent += `\n\nWeb research (goal / last error):\n${JSON.stringify(context.goalResearch, null, 2)}`;
  }

  const { content, error } = await openRouterChat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    { temperature: 0.1, max_tokens: 1024 }
  );

  if (error) {
    await logAgentAction({
      workflowId,
      agentType: 'execution',
      actionType: 'check_performed',
      details: { error, context: 'execution_agent_failed' },
      optimizationImpact: 'not_applicable',
    });
    return { success: false, error, ready: false, blockers: [] };
  }

  let parsed = { summary: content, blockers: [], ready: true };
  try {
    const jsonMatch = content && /\{[\s\S]*\}/.exec(content);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch {
    // keep default
  }

  await logAgentAction({
    workflowId,
    agentType: 'execution',
    actionType: 'check_performed',
    details: {
      summary: parsed.summary,
      blockers: parsed.blockers || [],
      ready: parsed.ready,
      rawResponse: content?.slice(0, 1000),
    },
    optimizationImpact: 'not_applicable',
  });

  return {
    success: true,
    summary: parsed.summary,
    blockers: parsed.blockers || [],
    ready: parsed.ready !== false,
  };
}
