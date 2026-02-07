/**
 * Security agent: checks workflow structure, triggers, external calls. Guardrail: no execution logs.
 */
import { openRouterChat } from './openrouter.client.js';
import { logAgentAction } from '#services/workflow-agent-action.service.js';

export async function runSecurityAgent(workflowId, context) {
  const systemPrompt = `You are a workflow security agent. You receive workflow structure (nodes, edges) and trigger config.
Check for: exposed secrets, unsafe webhook paths, overly permissive triggers, suspicious external URLs.
Do NOT receive or use execution logs or user data. Respond in JSON: { "summary": "...", "findings": [{ "severity": "high"|"medium"|"low"|"info", "message": "...", "nodeId": "..." }], "ok": boolean }.`;

  const userContent = `Workflow: ${context.name}
Workflow JSON: ${JSON.stringify(context.workflow_json || {}, null, 2)}
Trigger config: ${JSON.stringify(context.trigger_config || {}, null, 2)}`;

  const { content, error } = await openRouterChat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    { temperature: 0.1, max_tokens: 2048 }
  );

  if (error) {
    await logAgentAction({
      workflowId,
      agentType: 'security',
      actionType: 'check_performed',
      details: { error, context: 'security_agent_failed' },
      optimizationImpact: 'not_applicable',
    });
    return { success: false, error, findings: [], ok: false };
  }

  let parsed = { summary: content, findings: [], ok: true };
  try {
    const jsonMatch = content && /\{[\s\S]*\}/.exec(content);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch {
    // keep default
  }

  await logAgentAction({
    workflowId,
    agentType: 'security',
    actionType: 'check_performed',
    details: {
      summary: parsed.summary,
      findings: parsed.findings || [],
      ok: parsed.ok,
      rawResponse: content?.slice(0, 1500),
    },
    optimizationImpact: 'not_applicable',
  });

  return {
    success: true,
    summary: parsed.summary,
    findings: parsed.findings || [],
    ok: parsed.ok !== false,
  };
}
