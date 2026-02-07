/**
 * Optimization agent: suggests or applies workflow/node improvements. Guardrail: workflow_json + stats + goal, no raw user data.
 */
import { openRouterChat } from './openrouter.client.js';
import { logAgentAction } from '#services/workflow-agent-action.service.js';

export async function runOptimizationAgent(workflowId, context, options = {}) {
  const { mode = 'suggest' } = options; // suggest | apply

  const systemPrompt = `You are a workflow optimization agent. You receive the workflow structure (nodes, edges), goal definition, and optional stats.
Your job is to suggest or apply improvements that align with the goal and improve reliability or performance.
You must NOT expose or use any user credentials or raw integration data.
If goalResearch is provided, use it for best practices and to align suggestions with the workflow goal.
Respond in JSON when suggesting changes: { "summary": "...", "changes": [{ "type": "node_update"|"workflow_update", "nodeId": "...", "reason": "...", "patch": {} }], "optimization_impact": "helped"|"neutral"|"unknown" }.
If no changes needed, return { "summary": "No changes suggested.", "changes": [], "optimization_impact": "neutral" }.`;

  let userContent = `Workflow: ${context.name}
Description: ${context.description || 'none'}
Goal: ${JSON.stringify(context.goal_definition || 'none')}
Stats: ${JSON.stringify(context.stats || {}, null, 2)}
Workflow JSON (nodes and edges): ${JSON.stringify(context.workflow_json || {}, null, 2)}`;
  if (context.goalResearch && (context.goalResearch.goalSearch?.length || context.goalResearch.errorSearch?.length)) {
    userContent += `\n\nWeb research for goal:\n${JSON.stringify(context.goalResearch, null, 2)}`;
  }

  const { content, error } = await openRouterChat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    { temperature: 0.3, max_tokens: 4096 }
  );

  if (error) {
    await logAgentAction({
      workflowId,
      agentType: 'optimization',
      actionType: 'check_performed',
      details: { error, context: 'optimization_agent_failed' },
      optimizationImpact: 'not_applicable',
    });
    return { success: false, error, changes: [], optimizationImpact: null };
  }

  let parsed = { summary: content, changes: [], optimization_impact: 'unknown' };
  try {
    const jsonMatch = content && /\{[\s\S]*\}/.exec(content);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch {
    // keep parsed as text summary
  }

  await logAgentAction({
    workflowId,
    agentType: 'optimization',
    actionType: 'suggestion',
    details: {
      summary: parsed.summary,
      changes: parsed.changes || [],
      rawResponse: content?.slice(0, 2000),
    },
    optimizationImpact: parsed.optimization_impact || parsed.optimizationImpact || 'unknown',
  });

  return {
    success: true,
    summary: parsed.summary,
    changes: parsed.changes || [],
    optimizationImpact: parsed.optimization_impact || parsed.optimizationImpact || 'unknown',
  };
}
