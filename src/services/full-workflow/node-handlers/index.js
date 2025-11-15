/**
 * Node Handlers Index
 * Exports all node execution handlers
 */

import { executeWebhook } from './webhook.handler.js';
import { executeHttpRequest } from './http-request.handler.js';
import { executeCallAgent } from './call-agent.handler.js';
import { executeVariableSet } from './variable-set.handler.js';
import { executeWait } from './wait.handler.js';
import { executeDatabaseQuery } from './database-query.handler.js';
import { executeGoogleSheets } from './google-sheets.handler.js';
import { executeGoogleSheetsTrigger } from './google-sheets-trigger.handler.js';
import { executeWebhookTrigger } from './webhook-trigger.handler.js';
import { executeKnowledgeBaseQuery } from './knowledge-base-query.handler.js';
import { executeAiAgent } from './ai-agent.handler.js';
import { executeEmail } from './email.handler.js';
import { executeScheduleTrigger } from './schedule-trigger.handler.js';
import { executeMerge } from './merge.handler.js';
import logger from '#config/logger.js';

/**
 * Execute a node based on its type
 * @param {Object} node - Node object
 * @param {Object} templateContext - Template context for variable resolution
 * @param {VariableContext} variableContext - Variable context service
 * @returns {Promise<*>} - Node output
 */
export async function executeNode(node, templateContext, variableContext) {
  const { type, data } = node;

  logger.debug('Executing node handler', {
    nodeId: node.id,
    type,
  });

  switch (type) {
    case 'start':
      // Start node - just return input
      return templateContext.workflowInput || {};

    case 'end':
      // End node - return current context
      return {
        variables: Object.fromEntries(variableContext.variables),
        nodeOutputs: Object.fromEntries(variableContext.nodeOutputs),
      };

    // Webhook node is deprecated - use HTTP Request node instead
    // Keeping for backward compatibility
    case 'webhook':
      logger.warn('Webhook node is deprecated, use HTTP Request node instead', {
        nodeId: node.id,
      });
      return executeWebhook(data, templateContext);

    case 'http-request':
      return executeHttpRequest(data, templateContext);

    case 'call-agent':
      return executeCallAgent(data, templateContext);

    case 'variable-set':
      return executeVariableSet(data, templateContext, variableContext);

    case 'if':
      // If node is handled in executor (conditional branching)
      return { condition: data.condition };

    case 'wait':
      return executeWait(data);

    case 'database-query':
      return executeDatabaseQuery(data, templateContext);

    case 'google-sheets':
      return executeGoogleSheets(data, templateContext);

    case 'google-sheets-trigger':
      return executeGoogleSheetsTrigger(data, templateContext);

    case 'webhook-trigger':
      return executeWebhookTrigger(data, templateContext);

    case 'knowledge-base-query':
      return executeKnowledgeBaseQuery(data, templateContext);

    case 'ai-agent':
      return executeAiAgent(node, templateContext, variableContext);

    case 'email':
      return executeEmail(node, templateContext);

    case 'schedule-trigger':
      return executeScheduleTrigger(data, templateContext);

    case 'merge':
      return executeMerge(node, templateContext, variableContext);

    default:
      throw new Error(`Unknown node type: ${type}`);
  }
}
