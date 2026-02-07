/**
 * Optimization agent: suggests or applies workflow/node improvements. Guardrail: workflow_json + stats + goal, no raw user data.
 */
import { openRouterChat } from './openrouter.client.js';
import { logAgentAction } from '#services/workflow-agent-action.service.js';

export async function runOptimizationAgent(workflowId, context, options = {}) {
  const { mode = 'suggest' } = options;
  const goalMetrics = context.goalMetrics || {};
  const achievementRate = goalMetrics.currentAchievementRate;
  const trend = goalMetrics.trend || 'unknown';
  const focusOnGoal = context.focusOnGoal !== false;

  const systemPrompt = `You are a workflow optimization agent with AUTONOMOUS GOAL-DRIVEN INTELLIGENCE.

GOAL: ${JSON.stringify(context.goal_definition || 'Not defined')}

CURRENT GOAL PERFORMANCE:
- Achievement Rate: ${achievementRate != null ? `${(achievementRate * 100).toFixed(1)}%` : 'Not measured'}
- Trend: ${trend}
${achievementRate != null && achievementRate < 0.7 ? '⚠️ GOAL IS NOT BEING ACHIEVED - STRUCTURAL CHANGES NEEDED' : ''}

YOUR MISSION:
${focusOnGoal ? `
PRIMARY FOCUS: Make this workflow achieve its GOAL.
- If goal achievement < 70%: Propose STRUCTURAL changes (add nodes, remove bottlenecks, parallelize, reorder)
- If goal is achieved: Optimize for efficiency (cost, speed)
- EVERY change must explain: "This brings us closer to the goal because..."
` : `
Suggest improvements for reliability and performance.
`}

You can propose:
- "node_update": Modify existing node data (e.g., fix URL, adjust timeout)
- "add_node": Insert new node (e.g., parallel processing, monitoring, notification)
- "remove_node": Remove node that blocks goal (e.g., unnecessary filter)

EXAMPLES:
${JSON.stringify([
  { type: 'node_update', nodeId: 'http_123', patch: { url: 'https://api.example.com/users' }, reason: 'Fixed typo in URL causing 404 errors' },
  { type: 'add_node', nodeType: 'parallel_branch', connectAfter: 'node_5', reason: 'Goal requires <5min response, current sequential path takes 12min. Parallel processing reduces to 4min.' },
  { type: 'remove_node', nodeId: 'filter_xyz', reason: 'This filter blocks 80% of leads, contradicts goal of fast response to ALL leads' }
], null, 2)}

You must NOT expose or use any user credentials or raw integration data.
If goalResearch is provided, use it for best practices and to align suggestions with the workflow goal.

Respond in JSON: { "summary": "...", "changes": [{ "type": "node_update"|"add_node"|"remove_node", "nodeId": "...", "reason": "...", "patch": {} }], "optimization_impact": "helped"|"neutral"|"unknown" }.
If no changes needed, return { "summary": "Workflow is aligned with goal.", "changes": [], "optimization_impact": "neutral" }.`;

  let userContent = `Workflow: ${context.name}
Description: ${context.description || 'none'}
Goal: ${JSON.stringify(context.goal_definition || 'none')}
Stats: ${JSON.stringify(context.stats || {}, null, 2)}
Workflow JSON (nodes and edges): ${JSON.stringify(context.workflow_json || {}, null, 2)}`;
  
  if (context.executionContext) {
    userContent += `\n\nLast Execution:\n${JSON.stringify(context.executionContext, null, 2)}`;
  }
  
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
