/**
 * Short documentation for each node type (2–3 sentences).
 * Used in UI Docs tab and passed to agents that build or change workflow JSON.
 */
export const NODE_TYPE_DOCS = {
  start:
    'Entry point of the workflow. Passes the initial input (e.g. webhook payload or manual input) to the next node. Must have exactly one outgoing connection.',
  end: 'Terminates the workflow. Collects variables and node outputs from the run. Place at the end of each branch. No outgoing connections needed.',
  webhook:
    'Deprecated. Use HTTP Request or Webhook Trigger instead. Previously used to receive HTTP payloads.',
  'webhook-trigger':
    'Starts the workflow when an HTTP request hits the webhook URL. Use custom path or /api/webhooks/:id. Must be connected to the rest of the flow.',
  'http-request':
    'Calls an external API (GET, POST, etc.). Set URL, method, optional headers and body. Use {{variables}} in any field. Output is available to downstream nodes.',
  'variable-set':
    'Stores a value under a variable name for later use. Must sit between the node that provides the value and the nodes that use {{variableName}}. Requires both an incoming and outgoing connection.',
  if: 'Branches by condition (e.g. A > B). Has two outputs: true and false. Connect the next nodes to the correct handle.',
  switch:
    'Branches by multiple cases (e.g. value equals X, Y, Z). Each case can lead to a different node. Use for routing by status, type, or category.',
  wait: 'Pauses the workflow for a set time (milliseconds). Use to avoid rate limits or add delays between steps.',
  'database-query':
    'Runs a SQL query against the configured database. Use for reading or writing data. Connect credentials in Settings.',
  'google-sheets':
    'Reads or writes Google Sheets (append/update rows, get rows, etc.). Connect Google account in Settings. Use Document or Sheet Within Document depending on operation.',
  'google-sheets-trigger':
    'Starts the workflow when a row is added or updated in a Google Sheet. Configure sheet and range. Must be connected to the rest of the flow.',
  'call-agent':
    'Makes an AI-powered phone call (e.g. Twilio + OpenAI). Configure prompt, phone numbers, and knowledge base. Output includes call status and transcript.',
  'ai-agent':
    'Runs an AI agent in the flow (chat/completion). Use for decisions, summaries, or text generation. Configure model and prompt; use {{variables}} in the prompt.',
  email:
    'Sends an email via SMTP. Set recipient, subject, body. Connect SMTP credentials in Settings.',
  gmail:
    'Sends an email via Gmail API. Set recipient, subject, body. Connect Google account in Settings.',
  'schedule-trigger':
    'Starts the workflow on a cron schedule (e.g. daily at 9:00). Configure cron expression. Must be connected to the rest of the flow.',
  'call-trigger':
    'Starts the workflow when an incoming call is received. Configure phone number and greeting. Must be connected to the rest of the flow.',
  merge:
    'Combines outputs from multiple branches into one. Use when several paths (e.g. after a switch) must feed into a single node. Connect all branches to this node.',
  'knowledge-base-query':
    'Queries a knowledge base (e.g. RAG) and returns relevant chunks. Use for context in AI agents or search. Configure knowledge base in Settings.',
  'web-scraper':
    'Fetches a URL and extracts content (HTML or structured data). Use for scraping pages or APIs that return HTML. Output is available to downstream nodes.',
  hubspot:
    'Performs HubSpot CRM actions (create/update contact, company, etc.). Connect HubSpot in Settings. Use for lead sync, deal updates, or contact management.',
  'hubspot-trigger':
    'Starts the workflow when a HubSpot event occurs (e.g. contact created, deal updated). Configure event types. Must be connected to the rest of the flow.',
};

/**
 * Get documentation text for a node type (for agents and UI).
 * @param {string} nodeType
 * @returns {string}
 */
export function getNodeTypeDoc(nodeType) {
  return (
    NODE_TYPE_DOCS[nodeType] || 'No documentation available for this node type.'
  );
}

/**
 * Format node docs for agent context (one block of text listing all types).
 * @returns {string}
 */
export function getNodeDocsForAgents() {
  const lines = Object.entries(NODE_TYPE_DOCS)
    .filter(([type]) => !['webhook'].includes(type)) // skip deprecated
    .map(([type, doc]) => `- ${type}: ${doc}`);
  return lines.join('\n');
}
