/**
 * Shared OpenAI Tools Utilities
 * Gemeinsame Logik für Tool-Loading und Execution
 * für Twilio und Browser Sessions
 */

import { db } from '#config/database.js';
import { integrations } from '#models/integration.model.js';
import { eq, and } from 'drizzle-orm';
import { toolsRegistry } from '#tools/tools.registry.js';
import logger from '#config/logger.js';

/**
 * Load tools for a user from database
 * @param {number|null} userId - User ID
 * @param {string} sessionIdentifier - Call SID or Session ID for logging
 * @param {Array} configTools - Tools from config (optional, for Twilio)
 * @param {string} sessionType - 'twilio' | 'browser'
 * @returns {Promise<Array>} Array of tool declarations
 */
export async function loadToolsForUser(
  userId,
  sessionIdentifier,
  configTools = null,
  sessionType = 'browser'
) {
  // If config has tools and they're provided, use them (Twilio-specific)
  if (configTools && configTools.length > 0 && sessionType === 'twilio') {
    logger.info(
      `Using tools from config for ${sessionType} session ${sessionIdentifier}`
    );
    return configTools;
  }

  // Load from database if userId is available
  if (!userId) {
    logger.warn(
      `No userId available for ${sessionType} session ${sessionIdentifier} - tools will not be loaded`
    );
    return [];
  }

  try {
    logger.info(
      `🔍 Loading tools for user ${userId} in ${sessionType} session ${sessionIdentifier}`
    );

    const userIntegrations = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.user_id, userId),
          eq(integrations.is_active, true),
          eq(integrations.is_complete, true)
        )
      );

    logger.info(
      `🔍 Found ${userIntegrations.length} integrations for user ${userId} in ${sessionType} session ${sessionIdentifier}`
    );

    const availableTools = toolsRegistry.getAvailableTools(userIntegrations);

    logger.info(
      `📦 Loaded ${availableTools.length} tools for user ${userId} in ${sessionType} session ${sessionIdentifier}`,
      {
        toolNames: availableTools.map(t => t.name),
      }
    );

    return availableTools;
  } catch (error) {
    logger.error(
      `Error loading tools for user ${userId} in ${sessionType} session ${sessionIdentifier}:`,
      error
    );
    return [];
  }
}

/**
 * Execute a tool call
 * @param {Object} toolCall - Tool call from OpenAI
 * @param {number|null} userId - User ID
 * @param {WebSocket} openaiWs - OpenAI WebSocket connection
 * @param {string} sessionIdentifier - Call SID or Session ID for logging
 * @param {string} sessionType - 'twilio' | 'browser'
 * @param {Object} loggerContext - Logger context (child logger)
 * @returns {Promise<void>}
 */
export async function executeToolCall(
  toolCall,
  userId,
  openaiWs,
  sessionIdentifier,
  sessionType = 'browser',
  loggerContext = null
) {
  const sessionLogger =
    loggerContext ||
    logger.child({
      [sessionType === 'twilio' ? 'callSid' : 'sessionId']: sessionIdentifier,
      toolCallId: toolCall.id,
    });

  sessionLogger.info(
    `🔧 Tool call received for ${sessionType} session ${sessionIdentifier}:`,
    {
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      hasArguments: !!toolCall.arguments || !!toolCall.function?.arguments,
    }
  );

  try {
    // Get user integrations if userId is provided
    let userIntegrations = [];
    if (userId) {
      userIntegrations = await db
        .select()
        .from(integrations)
        .where(
          and(
            eq(integrations.user_id, userId),
            eq(integrations.integration_type, 'GOOGLE_CALENDAR'),
            eq(integrations.is_active, true),
            eq(integrations.is_complete, true)
          )
        );
    }

    // Get integration config for Google Calendar
    const integrationConfig = userIntegrations.find(
      i => i.integration_type === 'GOOGLE_CALENDAR'
    );

    // Get tool handler
    const toolHandler = toolsRegistry.getToolHandler(toolCall.name);

    if (!toolHandler) {
      sessionLogger.warn(
        `No handler found for tool ${toolCall.name} for ${sessionType} session ${sessionIdentifier}`
      );

      // Send error response to OpenAI
      const callId = toolCall.call_id || toolCall.id;

      if (openaiWs && openaiWs.readyState === 1) {
        openaiWs.send(
          JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: callId,
              output: JSON.stringify({
                success: false,
                error: `Tool handler not found for ${toolCall.name}`,
              }),
            },
          })
        );
      }
      return;
    }

    // Execute tool handler
    const result = await toolHandler(toolCall, {
      integrationConfig,
      logger: sessionLogger,
    });

    // Send result back to OpenAI
    const callId = toolCall.call_id || toolCall.id;

    if (openaiWs && openaiWs.readyState === 1) {
      openaiWs.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: callId,
            output: result.output,
          },
        })
      );
    }

    sessionLogger.info(
      `✅ Tool call completed for ${sessionType} session ${sessionIdentifier}:`,
      {
        toolCallId: toolCall.id,
        toolName: toolCall.name,
      }
    );
  } catch (error) {
    sessionLogger.error(
      `❌ Error handling tool call for ${sessionType} session ${sessionIdentifier}:`,
      error
    );

    // Send error response to OpenAI
    const callId = toolCall.call_id || toolCall.id;

    if (openaiWs && openaiWs.readyState === 1) {
      openaiWs.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: callId,
            output: JSON.stringify({
              success: false,
              error: error.message,
            }),
          },
        })
      );
    }
  }
}

/**
 * Handle automatic response after tool call completion
 * @param {WebSocket} openaiWs - OpenAI WebSocket connection
 * @param {Object} message - OpenAI message with conversation.item.done
 * @param {string} sessionIdentifier - Call SID or Session ID for logging
 * @param {string} sessionType - 'twilio' | 'browser'
 */
export function handleToolCallResponse(
  openaiWs,
  message,
  sessionIdentifier,
  sessionType = 'browser'
) {
  if (
    message.type === 'conversation.item.done' &&
    message.item?.type === 'function_call_output'
  ) {
    logger.info(
      `✅ Function call output processed for ${sessionType} session ${sessionIdentifier}:`,
      {
        itemId: message.item.id,
        callId: message.item.call_id,
      }
    );

    // Trigger a new response after tool result is fully processed
    if (openaiWs && openaiWs.readyState === 1) {
      setTimeout(() => {
        if (openaiWs && openaiWs.readyState === 1) {
          openaiWs.send(
            JSON.stringify({
              type: 'response.create',
            })
          );
          logger.info(
            `🔄 Triggered response.create after function_call_output processed for ${sessionType} session ${sessionIdentifier}`
          );
        }
      }, 100); // 100ms delay to ensure OpenAI has processed the item
    }
  }
}
