/**
 * Template Engine for Full Workflows
 * Resolves variables in templates like {{variable}} or {{node.output.field}}
 */

/**
 * Resolve template variables
 * @param {string} template - Template string with variables
 * @param {Object} context - Variable context
 * @returns {string} - Resolved template
 */
export function resolveTemplate(template, context = {}) {
  if (!template || typeof template !== 'string') {
    return template;
  }

  // Pattern to match: {{variable}} or {{node.output.field}} or {{workflow.input.field}}
  const variablePattern = /\{\{([^}]+)\}\}/g;

  return template.replace(variablePattern, (match, variablePath) => {
    const trimmedPath = variablePath.trim();

    // Handle different variable path formats
    let value = null;

    // 1. Direct variable: {{variableName}}
    if (context.variables && context.variables[trimmedPath]) {
      value = context.variables[trimmedPath];
    }
    // 2. Node output: {{nodeId.output.field}} or {{nodeId.output}}
    else if (trimmedPath.includes('.')) {
      const parts = trimmedPath.split('.');
      if (parts[0] === 'workflow' && parts[1] === 'input') {
        // Workflow input: {{workflow.input.field}}
        const field = parts.slice(2).join('.');
        value = getNestedValue(context.workflowInput || {}, field);
      } else {
        // Node output: {{nodeId.output.field}}
        const nodeId = parts[0];
        if (parts[1] === 'output' && context.nodeOutputs) {
          const outputPath = parts.slice(2).join('.');
          const nodeOutput = context.nodeOutputs[nodeId];
          if (nodeOutput) {
            value = outputPath
              ? getNestedValue(nodeOutput, outputPath)
              : nodeOutput;
          }
        }
      }
    }
    // 3. Previous node output: {{previous.output.field}} or {{previous.output}}
    else if (trimmedPath.startsWith('previous')) {
      const parts = trimmedPath.split('.');
      if (parts[1] === 'output' && context.previousNodeOutput) {
        const outputPath = parts.slice(2).join('.');
        value = outputPath
          ? getNestedValue(context.previousNodeOutput, outputPath)
          : context.previousNodeOutput;
      }
    }

    // Convert value to string
    if (value === null || value === undefined) {
      return match; // Keep original if not found
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  });
}

/**
 * Get nested value from object using dot notation
 * @param {Object} obj - Object to get value from
 * @param {string} path - Dot notation path (e.g., 'user.name')
 * @returns {*} - Value or undefined
 */
function getNestedValue(obj, path) {
  if (!obj || !path) {
    return undefined;
  }

  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

/**
 * Extract all variable references from a template
 * @param {string} template - Template string
 * @returns {Array<string>} - Array of variable paths
 */
export function extractVariables(template) {
  if (!template || typeof template !== 'string') {
    return [];
  }

  const variablePattern = /\{\{([^}]+)\}\}/g;
  const variables = [];
  let match;

  while ((match = variablePattern.exec(template)) !== null) {
    variables.push(match[1].trim());
  }

  return [...new Set(variables)]; // Remove duplicates
}

/**
 * Validate template variables against available context
 * @param {string} template - Template string
 * @param {Object} context - Available context
 * @returns {Object} - Validation result with missing variables
 */
export function validateTemplate(template, context = {}) {
  const variables = extractVariables(template);
  const missing = [];

  for (const variablePath of variables) {
    let found = false;

    // Check direct variables
    if (context.variables && context.variables[variablePath]) {
      found = true;
    }
    // Check node outputs
    else if (variablePath.includes('.')) {
      const parts = variablePath.split('.');
      if (parts[0] === 'workflow' && parts[1] === 'input') {
        found = true; // Workflow input is always available
      } else if (parts[1] === 'output' && context.nodeOutputs) {
        const nodeId = parts[0];
        found = context.nodeOutputs[nodeId] !== undefined;
      }
    }
    // Check previous node
    else if (variablePath.startsWith('previous')) {
      found = context.previousNodeOutput !== undefined;
    }

    if (!found) {
      missing.push(variablePath);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
