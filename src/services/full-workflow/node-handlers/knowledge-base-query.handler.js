import { resolveTemplate } from '#utils/template-engine.js';
import { searchKnowledgeBase } from '#services/rag.service.js';
import logger from '#config/logger.js';

/**
 * Execute Knowledge Base Query Node
 * Performs a RAG search on the knowledge base
 */
export async function executeKnowledgeBaseQuery(data, context) {
  const { query, limit = 5 } = data;

  if (!query) {
    throw new Error('Query is required');
  }

  // Resolve query template
  const resolvedQuery = resolveTemplate(query, context);

  try {
    // Get user ID from context
    const userId = context.userId || context.workflowInput?.userId;
    if (!userId) {
      throw new Error('User ID not found in context');
    }

    logger.info('Searching knowledge base', {
      query: resolvedQuery.substring(0, 50),
      limit,
      userId,
    });

    // Perform RAG search
    const results = await searchKnowledgeBase(userId, resolvedQuery, limit);

    return {
      success: true,
      query: resolvedQuery,
      results: results.map(r => ({
        id: r.id,
        name: r.name,
        text: r.text,
        similarity: r.similarity,
      })),
      count: results.length,
    };
  } catch (error) {
    logger.error('Knowledge base query failed', {
      query: resolvedQuery.substring(0, 50),
      error: error.message,
    });
    throw error;
  }
}
