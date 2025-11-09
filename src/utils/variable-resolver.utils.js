/**
 * Variable Resolver Utilities
 * Handles variable extraction and resolution at runtime
 */

/**
 * Extract all variables from a text string
 * Pattern: {variableName}
 * @param {string} text - Text containing variables
 * @returns {Array<string>} Array of variable names found
 */
export function extractVariables(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const variablePattern = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  const variables = [];
  let match;

  while ((match = variablePattern.exec(text)) !== null) {
    const variableName = match[1];
    if (!variables.includes(variableName)) {
      variables.push(variableName);
    }
  }

  return variables;
}

/**
 * Resolve variables in text with provided context
 * @param {string} text - Text containing variables like {userName}
 * @param {Object} context - Context object with variable values
 * @returns {string} Text with variables replaced
 */
export function resolveVariables(text, context = {}) {
  if (!text || typeof text !== 'string') {
    return text || '';
  }

  return text.replace(
    /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g,
    (match, variableName) => {
      const value = context[variableName];
      // If variable not found, return the original {variableName} or empty string
      return value !== undefined && value !== null ? String(value) : match;
    }
  );
}

/**
 * Build context from call data, user data, etc.
 * @param {Object} options - Options for building context
 * @param {Object} options.callData - Call data (from Twilio, etc.)
 * @param {Object} options.userData - User data from database
 * @param {Object} options.customVariables - Custom variables to add
 * @returns {Object} Context object for variable resolution
 */
export function buildVariableContext({
  callData = {},
  userData = {},
  customVariables = {},
} = {}) {
  const context = {
    // Call data variables
    callerNumber: callData.from || callData.callerNumber || '',
    calledNumber: callData.to || callData.calledNumber || '',
    callSid: callData.callSid || '',

    // User data variables
    userName: userData.name || userData.username || '',
    userEmail: userData.email || '',
    userId: userData.id || '',

    // Custom variables
    ...customVariables,
  };

  return context;
}
