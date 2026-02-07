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

  // CRITICAL: Define allowed node types (must match your system)
  const ALLOWED_NODE_TYPES = [
    'start', 'end',
    'webhook', 'webhook-trigger',
    'http-request',
    'variable-set',
    'if', 'switch',
    'wait',
    'email', 'gmail',
    'database-query',
    'google-sheets', 'google-sheets-trigger',
    'call-agent', 'ai-agent',
    'call-trigger',
    'merge',
    'knowledge-base-query',
    'web-scraper',
    'hubspot', 'hubspot-trigger',
    'schedule-trigger'
  ];

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

CRITICAL CONSTRAINTS:
- You can ONLY use these node types: ${ALLOWED_NODE_TYPES.join(', ')}
- Do NOT invent new node types like "slack", "code", "delay" - they don't exist
- If you need functionality not in the list, use existing nodes creatively (e.g., "http-request" for APIs, "wait" for delays)

You can propose:
- "node_update": Modify existing node data (e.g., fix URL, adjust timeout)
- "add_node": Insert new node using ONLY allowed types above
- "remove_node": Remove node that blocks goal

EXAMPLES (using ONLY allowed types):
${JSON.stringify([
  { type: 'node_update', nodeId: 'http_123', patch: { url: 'https://api.example.com/users' }, reason: 'Fixed typo in URL causing 404 errors' },
  { type: 'add_node', nodeType: 'wait', nodeData: { delay: 5000 }, connectAfter: 'node_5', reason: 'Add delay to avoid rate limiting' },
  { type: 'add_node', nodeType: 'http-request', nodeData: { url: 'https://api.slack.com/...', method: 'POST' }, connectAfter: 'node_x', reason: 'Notify team via Slack API (using http-request)' },
  { type: 'remove_node', nodeId: 'filter_xyz', reason: 'This filter blocks 80% of leads' }
], null, 2)}

You must NOT:
- Use node types not in the allowed list
- Expose or use user credentials or raw integration data
- Add nodes that don't exist in the system

If goalResearch is provided, use it for best practices and to align suggestions with the workflow goal.

Respond in JSON: { "summary": "...", "changes": [{ "type": "node_update"|"add_node"|"remove_node", "nodeId": "...", "nodeType": "...", "reason": "...", "patch": {} }], "optimization_impact": "helped"|"neutral"|"unknown" }.
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
