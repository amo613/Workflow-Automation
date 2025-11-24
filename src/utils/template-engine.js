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
      } else if (parts[1] === 'output' && context.nodeOutputs) {
        // Node output: {{nodeId.output.field}}
        const nodeId = parts[0];
        const outputPath = parts.slice(2).join('.');
        const nodeOutput = context.nodeOutputs[nodeId];
        if (nodeOutput) {
          value = outputPath
            ? getNestedValue(nodeOutput, outputPath)
            : nodeOutput;
        }
      } else {
        // Try as nested path in previous node output first (e.g., {{data.userId}})
        if (context.previousNodeOutput) {
          value = getNestedValue(context.previousNodeOutput, trimmedPath);
        }
        // If not found, try in any node output
        if ((value === null || value === undefined) && context.nodeOutputs) {
          for (const [, nodeOutput] of Object.entries(context.nodeOutputs)) {
            if (nodeOutput && typeof nodeOutput === 'object') {
              const foundValue = getNestedValue(nodeOutput, trimmedPath);
              if (foundValue !== undefined && foundValue !== null) {
                value = foundValue;
                break;
              }
            }
          }
        }
        // If still not found, try in workflow input
        if ((value === null || value === undefined) && context.workflowInput) {
          value = getNestedValue(context.workflowInput, trimmedPath);
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
    // 3.5. Handle {{output}} as shorthand for {{previous.output}}
    else if (trimmedPath === 'output' && context.previousNodeOutput) {
      value = context.previousNodeOutput;
    }
    // 4. Try to resolve as previous.output.field if not found as direct variable
    // This handles cases like {{data.userId}} which should resolve to previous.output.data.userId
    if (value === null || value === undefined) {
      // First try previous node output (most common case)
      if (context.previousNodeOutput) {
        // Try to find the value in previous node output using the path directly
        // e.g., {{data.userId}} -> previousNodeOutput.data.userId
        value = getNestedValue(context.previousNodeOutput, trimmedPath);
      }

      // 5. If still not found, try to find in any node output
      // This handles cases where the variable might be in any previous node
      if ((value === null || value === undefined) && context.nodeOutputs) {
        // Try each node output to find the value
        for (const [, nodeOutput] of Object.entries(context.nodeOutputs)) {
          if (nodeOutput && typeof nodeOutput === 'object') {
            const foundValue = getNestedValue(nodeOutput, trimmedPath);
            if (foundValue !== undefined && foundValue !== null) {
              value = foundValue;
              break;
            }
          }
        }
      }

      // 6. Also try in workflow input as fallback
      if ((value === null || value === undefined) && context.workflowInput) {
        value = getNestedValue(context.workflowInput, trimmedPath);
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
 * Extract array field values (e.g., extract all 'username' values from array)
 * @param {Array} arr - Array of objects
 * @param {string} fieldName - Field name to extract
 * @returns {Array} - Array of field values
 */
function extractArrayField(arr, fieldName) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return [];
  }

  const values = [];
  for (const item of arr) {
    if (item && typeof item === 'object' && fieldName in item) {
      values.push(item[fieldName]);
    }
  }
  return values;
}

/**
 * Parse path to handle array index access (e.g., "user[0].userName" -> ["user", "0", "userName"])
 * @param {string} pathStr - Path string
 * @returns {Array<string>} - Array of path parts
 */
function parsePath(pathStr) {
  const parts = [];
  let current = '';
  let i = 0;

  while (i < pathStr.length) {
    const char = pathStr[i];

    if (char === '[') {
      // Save current part if any
      if (current) {
        parts.push(current);
        current = '';
      }
      // Find the closing bracket
      i++;
      let index = '';
      while (i < pathStr.length && pathStr[i] !== ']') {
        index += pathStr[i];
        i++;
      }
      if (pathStr[i] === ']') {
        parts.push(index);
        i++;
      }
    } else if (char === '.') {
      // Save current part if any
      if (current) {
        parts.push(current);
        current = '';
      }
      i++;
    } else {
      current += char;
      i++;
    }
  }

  // Add remaining part
  if (current) {
    parts.push(current);
  }

  return parts;
}

/**
 * Get nested value from object using dot notation
 * Supports array extraction: if path is 'data.username' and data is an array,
 * returns array of all 'username' values
 * Also supports array index access: 'data[0].username'
 * @param {Object} obj - Object to get value from
 * @param {string} path - Dot notation path (e.g., 'user.name' or 'data.username' or 'data[0].username')
 * @returns {*} - Value or undefined
 */
function getNestedValue(obj, path) {
  if (!obj || !path) {
    return undefined;
  }

  // Parse path to handle array index access (e.g., "user[0].userName" -> ["user", "0", "userName"])
  const parts = parsePath(path);
  let current = obj;

  // Navigate through the path
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLastPart = i === parts.length - 1;

    if (current === null || current === undefined) {
      return undefined;
    }

    // Handle array index access: if part is a number, treat as array index
    if (Array.isArray(current) && !isNaN(part)) {
      current = current[parseInt(part, 10)];
    } else if (Array.isArray(current) && isLastPart && isNaN(part)) {
      // Special case: if current is an array and we're at the last part with a field name,
      // extract that field from all array items (e.g., 'data.username' where data is an array)
      return extractArrayField(current, part);
    } else if (!isNaN(part)) {
      // Part is a number but current is not an array - might be object with numeric key
      // or we're accessing an array element from an object property
      if (Array.isArray(current)) {
        current = current[parseInt(part, 10)];
      } else if (current[part] !== undefined) {
        current = current[part];
      } else {
        return undefined;
      }
    } else if (current[part] !== undefined) {
      current = current[part];
    } else {
      return undefined;
    }
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
