import { resolveTemplate } from '#utils/template-engine.js';
import logger from '#config/logger.js';

/**
 * Execute Variable Set Node
 * Sets a variable in the variable context
 */
export async function executeVariableSet(data, context, variableContext) {
  const { variable_name, value } = data;

  if (!variable_name) {
    throw new Error('Variable name is required');
  }

  // Resolve value template
  const resolvedValue = resolveTemplate(value || '', context);

  // Try to parse as JSON if it looks like JSON
  let finalValue = resolvedValue;
  try {
    if (
      (resolvedValue.startsWith('{') && resolvedValue.endsWith('}')) ||
      (resolvedValue.startsWith('[') && resolvedValue.endsWith(']'))
    ) {
      finalValue = JSON.parse(resolvedValue);
    }
  } catch {
    // Not JSON, use as string
    finalValue = resolvedValue;
  }

  // Set variable in context
  variableContext.setVariable(variable_name, finalValue);

  logger.info('Variable set', {
    variableName: variable_name,
    valueType: typeof finalValue,
  });

  return {
    success: true,
    variableName: variable_name,
    value: finalValue,
  };
}
