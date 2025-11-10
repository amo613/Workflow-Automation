import logger from '#config/logger.js';
import { db } from '#config/database.js';
import { knowledgeBaseEntries } from '#models/knowledge-base.model.js';
import { generateEmbedding } from './embedding.service.js';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Store a knowledge base entry with embedding
 * @param {number} userId - User ID
 * @param {string} name - Entry name
 * @param {string} text - Entry text
 * @returns {Promise<Object>} - Created entry
 */
export async function storeKnowledgeEntry(userId, name, text) {
  try {
    if (!name || !text || !userId) {
      throw new Error('Name, text, and userId are required');
    }

    // Generate embedding
    const embedding = await generateEmbedding(text);

    // Insert entry with embedding using raw SQL (pgvector support)
    const [entry] = await db
      .insert(knowledgeBaseEntries)
      .values({
        user_id: userId,
        name: name.trim(),
        text: text.trim(),
      })
      .returning();

    // Update embedding using raw SQL (pgvector)
    // Note: We use sql.raw() because pgvector requires direct SQL casting
    const embeddingStr = `[${embedding.join(',')}]`;
    try {
      await db.execute(
        sql.raw(`
        UPDATE knowledge_base_entries
        SET embedding = '${embeddingStr}'::vector(1536)
        WHERE id = ${entry.id}
      `)
      );
    } catch (updateError) {
      logger.error('Error updating embedding (non-fatal)', {
        error: updateError.message,
        entryId: entry.id,
        stack: updateError.stack,
      });
      // Continue without embedding - entry is still created
      // Embedding can be regenerated later if needed
    }

    logger.info('Knowledge base entry stored', {
      id: entry.id,
      userId,
      name: entry.name,
      entryKeys: Object.keys(entry),
      entryData: entry,
    });

    // Ensure entry is properly formatted
    const formattedEntry = {
      id: entry.id,
      userId: entry.user_id || entry.userId,
      name: entry.name,
      text: entry.text,
      createdAt: entry.created_at || entry.createdAt,
      updatedAt: entry.updated_at || entry.updatedAt,
    };

    return formattedEntry;
  } catch (error) {
    logger.error('Error storing knowledge base entry', {
      error: error.message,
      userId,
      name,
    });
    throw error;
  }
}

/**
 * Search knowledge base using semantic search
 * @param {number} userId - User ID
 * @param {string} query - Search query
 * @param {number} limit - Number of results (default: 5)
 * @returns {Promise<Array>} - Search results
 */
export async function searchKnowledgeBase(userId, query, limit = 5) {
  try {
    if (!query || !userId) {
      throw new Error('Query and userId are required');
    }

    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);

    // Semantic search using pgvector cosine similarity (<=>)
    // Use parameterized query to avoid SQL injection
    const queryEmbeddingStr = `[${queryEmbedding.join(',')}]`;
    const results = await db.execute(
      sql.raw(`
      SELECT 
        id,
        user_id,
        name,
        text,
        1 - (embedding <=> ${queryEmbeddingStr}::vector(1536)) as similarity
      FROM knowledge_base_entries
      WHERE user_id = ${userId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${queryEmbeddingStr}::vector(1536)
      LIMIT ${limit}
    `)
    );

    logger.debug('Knowledge base search completed', {
      userId,
      query: query.substring(0, 50),
      resultsCount: results.rows?.length || 0,
    });

    // Handle both array and object results
    const rows = results.rows || results;
    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      text: row.text,
      similarity: parseFloat(row.similarity || 0),
    }));
  } catch (error) {
    logger.error('Error searching knowledge base', {
      error: error.message,
      userId,
      query: query.substring(0, 50),
    });
    throw error;
  }
}

/**
 * Update a knowledge base entry with new embedding
 * @param {number} id - Entry ID
 * @param {number} userId - User ID (for authorization)
 * @param {string} name - New name (optional)
 * @param {string} text - New text (optional)
 * @returns {Promise<Object>} - Updated entry
 */
export async function updateKnowledgeEntry(id, userId, name, text) {
  try {
    if (!id || !userId) {
      throw new Error('ID and userId are required');
    }

    // Check if entry exists and belongs to user
    const [existing] = await db
      .select()
      .from(knowledgeBaseEntries)
      .where(
        and(
          eq(knowledgeBaseEntries.id, id),
          eq(knowledgeBaseEntries.user_id, userId)
        )
      )
      .limit(1);

    if (!existing) {
      throw new Error('Knowledge base entry not found');
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (text !== undefined) updateData.text = text.trim();
    updateData.updatedAt = new Date();

    // Update entry
    const [updated] = await db
      .update(knowledgeBaseEntries)
      .set(updateData)
      .where(eq(knowledgeBaseEntries.id, id))
      .returning();

    // If text changed, regenerate embedding
    if (text !== undefined && text !== existing.text) {
      const embedding = await generateEmbedding(text);
      // Use parameterized query to avoid SQL injection
      const embeddingStr = `[${embedding.join(',')}]`;
      await db.execute(
        sql.raw(`
        UPDATE knowledge_base_entries
        SET embedding = ${embeddingStr}::vector(1536)
        WHERE id = ${id}
      `)
      );
    }

    logger.info('Knowledge base entry updated', {
      id: updated.id,
      userId,
    });

    return updated;
  } catch (error) {
    logger.error('Error updating knowledge base entry', {
      error: error.message,
      id,
      userId,
    });
    throw error;
  }
}

/**
 * Delete a knowledge base entry
 * @param {number} id - Entry ID
 * @param {number} userId - User ID (for authorization)
 * @returns {Promise<void>}
 */
export async function deleteKnowledgeEntry(id, userId) {
  try {
    if (!id || !userId) {
      throw new Error('ID and userId are required');
    }

    // Check if entry exists and belongs to user
    const [existing] = await db
      .select()
      .from(knowledgeBaseEntries)
      .where(
        and(
          eq(knowledgeBaseEntries.id, id),
          eq(knowledgeBaseEntries.user_id, userId)
        )
      )
      .limit(1);

    if (!existing) {
      throw new Error('Knowledge base entry not found');
    }

    // Delete entry (cascade will handle embedding)
    await db
      .delete(knowledgeBaseEntries)
      .where(eq(knowledgeBaseEntries.id, id));

    logger.info('Knowledge base entry deleted', {
      id,
      userId,
    });
  } catch (error) {
    logger.error('Error deleting knowledge base entry', {
      error: error.message,
      id,
      userId,
    });
    throw error;
  }
}

/**
 * Get all knowledge base entries for a user
 * @param {number} userId - User ID
 * @returns {Promise<Array>} - All entries
 */
export async function getAllKnowledgeEntries(userId) {
  try {
    if (!userId) {
      throw new Error('UserId is required');
    }

    const entries = await db
      .select()
      .from(knowledgeBaseEntries)
      .where(eq(knowledgeBaseEntries.user_id, userId))
      .orderBy(knowledgeBaseEntries.createdAt);

    return entries;
  } catch (error) {
    logger.error('Error getting all knowledge entries', {
      error: error.message,
      userId,
    });
    throw error;
  }
}
