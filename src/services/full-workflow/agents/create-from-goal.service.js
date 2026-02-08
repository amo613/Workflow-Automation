/**
 * Generate a suggested workflow_json from a natural language goal.
 * Uses OpenRouter; optional Firecrawl for research.
 */
import { openRouterChat } from './openrouter.client.js';
import { isFirecrawlConfigured, firecrawlSearch } from '#services/firecrawl.service.js';
import { getNodeDocsForAgents } from '../node-docs.js';

const SCHEMA_DESC = `
Workflow JSON schema:
- nodes: array of { id: string, type: string, position: { x: number, y: number }, data: object }
- edges: array of { id: string, source: string (node id), target: string (node id) }
Node types: start, end, webhook-trigger, http-request, variable-set, if, switch, wait, email, gmail, database-query, google-sheets, google-sheets-trigger, call-agent, ai-agent, merge, knowledge-base-query, web-scraper, hubspot, hubspot-trigger, schedule-trigger, call-trigger.
Always include exactly one "start" node (id e.g. start-1). Use type "end" for terminal nodes.
Return ONLY valid JSON in this exact shape: { "nodes": [...], "edges": [...] }. No markdown, no explanation.`;

/**
 * Generate workflow_json from natural language goal.
 * @param {string} goal - Natural language description
 * @param {object} options - { useFirecrawl: boolean }
 * @returns {Promise<{ success: boolean, workflow_json?: { nodes, edges }, error?: string }>}
 */
export async function createWorkflowFromGoal(goal, options = {}) {
  if (!goal || typeof goal !== 'string' || !goal.trim()) {
    return { success: false, error: 'goal is required' };
  }

  let extraContext = '';
  if (options.useFirecrawl && isFirecrawlConfigured()) {
    const searchResult = await firecrawlSearch(goal.trim().slice(0, 200), { limit: 3 });
    if (searchResult.success && searchResult.data?.web?.length) {
      extraContext = '\nRelevant web search results (for inspiration only):\n';
      searchResult.data.web.slice(0, 3).forEach((r, i) => {
        extraContext += `${i + 1}. ${r.title || ''}: ${(r.description || '').slice(0, 200)}\n`;
      });
    }
  }

  const nodeDocs = getNodeDocsForAgents();
  const systemPrompt = `You are a workflow designer. Given a user goal, produce a workflow as JSON.
${SCHEMA_DESC}

Node documentation (what each type does; connect nodes so data flows correctly):
${nodeDocs}

${extraContext}`;

  const userContent = `Goal: ${goal.trim()}\n\nReturn only the JSON object with "nodes" and "edges".`;

  const { content, error } = await openRouterChat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    { temperature: 0.3, max_tokens: 4096 }
  );

  if (error) {
    return { success: false, error };
  }

  try {
    const jsonStr = content.replace(/```json?\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(jsonStr);
    const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
    const edges = Array.isArray(parsed.edges) ? parsed.edges : [];
    if (nodes.length === 0) {
      return { success: false, error: 'Generated workflow has no nodes' };
    }
    return { success: true, workflow_json: { nodes, edges } };
  } catch (e) {
    return { success: false, error: 'Invalid JSON from model: ' + e.message };
  }
}
