/**
 * Monitoring agent: analyses execution stats and errors. Guardrail: no workflow_json.
 */
import { openRouterChat } from './openrouter.client.js';
import { logAgentAction } from '#services/workflow-agent-action.service.js';

export async function runMonitoringAgent(workflowId, context) {
  const goalMetrics = context.goalMetrics || {};
  const achievementRate = goalMetrics.currentAchievementRate;
  const trend = goalMetrics.trend || 'unknown';
  
  const systemPrompt = `You are a workflow monitoring agent with GOAL-AWARENESS as your primary focus.

GOAL: ${JSON.stringify(context.goal_definition || 'Not defined')}

CURRENT GOAL PERFORMANCE:
- Achievement Rate: ${achievementRate != null ? `${(achievementRate * 100).toFixed(1)}%` : 'Not measured yet'}
- Trend: ${trend}
- Recent Executions: ${context.executionHistory?.length || 0}

YOUR MISSION:
1. PRIMARY: Is the workflow achieving its GOAL? If not, WHY?
2. Analyze which nodes/steps are preventing goal achievement
3. Identify bottlenecks, failures, or misalignments with the goal
4. Suggest CONCRETE actions to improve goal achievement (not just "fix errors")

If goalResearch is provided, use it to validate suggestions, check best practices, and how things should look for the workflow goal.

Be specific: "Node X takes 12 minutes but goal requires <5min" not just "workflow is slow".`;

  let userContent = `Workflow: ${context.name}
Goal: ${JSON.stringify(context.goal_definition || 'none')}
Stats: ${JSON.stringify(context.stats || {}, null, 2)}
Recent execution history (sample): ${JSON.stringify(context.executionHistory || [], null, 2)}`;
  
  if (context.executionContext) {
    userContent += `\n\nLast Execution Context:\n${JSON.stringify(context.executionContext, null, 2)}`;
  }
  
  if (context.goalResearch && (context.goalResearch.goalSearch?.length || context.goalResearch.errorSearch?.length)) {
    userContent += `\n\nWeb research for goal / last error:\n${JSON.stringify(context.goalResearch, null, 2)}`;
  }

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
