import {
  createEventFunctionDeclaration,
  listEventsFunctionDeclaration,
  updateEventFunctionDeclaration,
  deleteEventFunctionDeclaration,
} from './calendar.tools.js';
import { handleCalendarToolCall } from './calendar.handlers.js';
import { InternalFunctionName } from './types.js';

/**
 * Tool Registry
 * Manages available tools and their handlers based on user integrations
 */
export class ToolsRegistry {
  /**
   * Get available tools for a user based on their integrations
   * @param {Array} userIntegrations - Array of user integrations from database
   * @returns {Array} Array of tool declarations for OpenAI
   */
  getAvailableTools(userIntegrations) {
    const tools = [];

    // Google Calendar Integration
    const googleCalendarIntegration = userIntegrations?.find(
      i =>
        i.integration_type === 'GOOGLE_CALENDAR' && i.is_complete && i.is_active
    );

    if (googleCalendarIntegration) {
      tools.push(listEventsFunctionDeclaration());
      tools.push(createEventFunctionDeclaration());

      // Only add update/delete for PERSONAL_ASSISTANT mode
      if (googleCalendarIntegration.mode === 'PERSONAL_ASSISTANT') {
        tools.push(updateEventFunctionDeclaration());
        tools.push(deleteEventFunctionDeclaration());
      }
    }

    // Weitere Integrations können hier hinzugefügt werden
    // z.B. Shopify, Email, etc.

    return tools;
  }

  /**
   * Get tool handler for a specific function name
   * @param {string} functionName - Function name from InternalFunctionName enum
   * @returns {Function|null} Tool handler function or null if not found
   */
  getToolHandler(functionName) {
    // Google Calendar tools
    if (
      functionName === InternalFunctionName.GOOGLE_CALENDAR_CREATE_EVENT ||
      functionName === InternalFunctionName.GOOGLE_CALENDAR_UPDATE_EVENT ||
      functionName === InternalFunctionName.GOOGLE_CALENDAR_DELETE_EVENT ||
      functionName === InternalFunctionName.GOOGLE_CALENDAR_LIST_EVENTS
    ) {
      return handleCalendarToolCall;
    }

    // Weitere Handler können hier hinzugefügt werden
    // z.B. Shopify, Email, etc.

    return null;
  }

  /**
   * Check if a function is available for a user
   * @param {string} functionName - Function name to check
   * @param {Array} userIntegrations - Array of user integrations
   * @returns {boolean} True if function is available
   */
  isFunctionAvailable(functionName, userIntegrations) {
    const tools = this.getAvailableTools(userIntegrations);
    return tools.some(tool => tool.name === functionName);
  }
}

export const toolsRegistry = new ToolsRegistry();
