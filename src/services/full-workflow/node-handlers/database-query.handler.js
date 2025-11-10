import { resolveTemplate } from '#utils/template-engine.js';
import { sql } from '#config/database.js';
import logger from '#config/logger.js';

/**
 * Execute Database Query Node
 * Executes a SQL query with parameterized values
 */
export async function executeDatabaseQuery(data, context) {
  const { query, parameters } = data;

  if (!query) {
    throw new Error('SQL query is required');
  }

  // Resolve query template (for dynamic table/column names)
  const resolvedQuery = resolveTemplate(query, context);

  // Resolve parameters template
  let resolvedParameters = [];
  if (parameters) {
    try {
      const paramsStr = resolveTemplate(parameters, context);
      resolvedParameters = JSON.parse(paramsStr);
      if (!Array.isArray(resolvedParameters)) {
        resolvedParameters = [resolvedParameters];
      }
    } catch (error) {
      logger.warn('Failed to parse parameters as JSON', {
        error: error.message,
      });
      resolvedParameters = [];
    }
  }

  try {
    logger.info('Executing database query', {
      query: resolvedQuery.substring(0, 100),
      parameterCount: resolvedParameters.length,
    });

    // Use parameterized query for safety
    // Note: This is a simplified implementation
    // In production, use proper SQL parameterization with Drizzle ORM
    // For now, we'll use raw SQL with parameterized values
    const result = await sql(resolvedQuery, resolvedParameters);

    return {
      success: true,
      rows: Array.isArray(result) ? result : [result],
      rowCount: Array.isArray(result) ? result.length : 1,
    };
  } catch (error) {
    logger.error('Database query failed', {
      query: resolvedQuery.substring(0, 100),
      error: error.message,
    });
    throw error;
  }
}
