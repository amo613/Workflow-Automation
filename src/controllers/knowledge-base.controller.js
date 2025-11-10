import logger from '#config/logger.js';
import {
  storeKnowledgeEntry,
  searchKnowledgeBase,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  getAllKnowledgeEntries,
} from '#services/rag.service.js';

/**
 * Create a new knowledge base entry
 */
export async function createKnowledgeEntry(req, reply) {
  try {
    const userId = req.user.id;
    const { name, text } = req.body;

    if (!name || !text) {
      return reply.code(400).send({
        success: false,
        error: 'Name and text are required',
      });
    }

    const entry = await storeKnowledgeEntry(userId, name, text);

    logger.info('Knowledge entry created successfully', {
      entryId: entry.id,
      userId,
      hasEntry: !!entry,
    });

    return reply.code(201).send({
      success: true,
      data: entry,
    });
  } catch (error) {
    logger.error('Error creating knowledge entry', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to create knowledge entry',
    });
  }
}

/**
 * Get all knowledge base entries for the user
 */
export async function getKnowledgeEntries(req, reply) {
  try {
    const userId = req.user.id;

    const entries = await getAllKnowledgeEntries(userId);

    return reply.code(200).send({
      success: true,
      data: entries,
    });
  } catch (error) {
    logger.error('Error getting knowledge entries', {
      error: error.message,
      userId: req.user?.id,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to get knowledge entries',
    });
  }
}

/**
 * Update a knowledge base entry
 */
export async function updateKnowledgeEntryController(req, reply) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, text } = req.body;

    if (!id) {
      return reply.code(400).send({
        success: false,
        error: 'Entry ID is required',
      });
    }

    const entry = await updateKnowledgeEntry(
      parseInt(id, 10),
      userId,
      name,
      text
    );

    return reply.code(200).send({
      success: true,
      data: entry,
    });
  } catch (error) {
    logger.error('Error updating knowledge entry', {
      error: error.message,
      userId: req.user?.id,
      entryId: req.params?.id,
    });

    if (error.message === 'Knowledge base entry not found') {
      return reply.code(404).send({
        success: false,
        error: error.message,
      });
    }

    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to update knowledge entry',
    });
  }
}

/**
 * Delete a knowledge base entry
 */
export async function deleteKnowledgeEntryController(req, reply) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!id) {
      return reply.code(400).send({
        success: false,
        error: 'Entry ID is required',
      });
    }

    await deleteKnowledgeEntry(parseInt(id, 10), userId);

    return reply.code(200).send({
      success: true,
      message: 'Knowledge entry deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting knowledge entry', {
      error: error.message,
      userId: req.user?.id,
      entryId: req.params?.id,
    });

    if (error.message === 'Knowledge base entry not found') {
      return reply.code(404).send({
        success: false,
        error: error.message,
      });
    }

    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to delete knowledge entry',
    });
  }
}

/**
 * Search knowledge base using semantic search
 */
export async function searchKnowledgeBaseController(req, reply) {
  try {
    const userId = req.user.id;
    const { query, limit } = req.body;

    if (!query) {
      return reply.code(400).send({
        success: false,
        error: 'Query is required',
      });
    }

    const results = await searchKnowledgeBase(userId, query, limit || 5);

    return reply.code(200).send({
      success: true,
      data: results,
    });
  } catch (error) {
    logger.error('Error searching knowledge base', {
      error: error.message,
      userId: req.user?.id,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to search knowledge base',
    });
  }
}
