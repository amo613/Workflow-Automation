import logger from '#config/logger.js';
import {
  getWorkflowVersions,
  getWorkflowVersion,
  restoreWorkflowVersion,
  deleteWorkflowVersion,
} from '#services/workflow-version.service.js';

/**
 * Get all versions for a workflow with pagination
 */
export async function getWorkflowVersionsHandler(req, reply) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const workflowId = parseInt(id, 10);

    // Parse pagination parameters
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;

    const result = await getWorkflowVersions(workflowId, userId, {
      limit,
      offset,
    });

    return reply.code(200).send({
      success: true,
      data: result.versions,
      total: result.total,
      hasMore: result.hasMore,
    });
  } catch (error) {
    logger.error('Error getting workflow versions', {
      error: error.message,
      userId: req.user?.id,
      workflowId: req.params?.id,
    });

    if (
      error.message === 'Workflow not found' ||
      error.message === 'Unauthorized'
    ) {
      return reply.code(404).send({
        success: false,
        error: error.message,
      });
    }

    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to get workflow versions',
    });
  }
}

/**
 * Get a specific version
 */
export async function getWorkflowVersionHandler(req, reply) {
  try {
    const userId = req.user.id;
    const { versionId } = req.params;
    const id = parseInt(versionId, 10);

    const version = await getWorkflowVersion(id, userId);

    return reply.code(200).send({
      success: true,
      data: version,
    });
  } catch (error) {
    logger.error('Error getting workflow version', {
      error: error.message,
      userId: req.user?.id,
      versionId: req.params?.versionId,
    });

    if (
      error.message === 'Version not found' ||
      error.message === 'Unauthorized'
    ) {
      return reply.code(404).send({
        success: false,
        error: error.message,
      });
    }

    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to get workflow version',
    });
  }
}

/**
 * Restore a workflow to a specific version
 */
export async function restoreWorkflowVersionHandler(req, reply) {
  try {
    const userId = req.user.id;
    const { id, versionId } = req.params;
    const workflowId = parseInt(id, 10);
    const vId = parseInt(versionId, 10);

    const workflow = await restoreWorkflowVersion(workflowId, vId, userId);

    return reply.code(200).send({
      success: true,
      data: workflow,
      message: 'Workflow restored to version successfully',
    });
  } catch (error) {
    logger.error('Error restoring workflow version', {
      error: error.message,
      userId: req.user?.id,
      workflowId: req.params?.id,
      versionId: req.params?.versionId,
    });

    if (
      error.message === 'Version not found' ||
      error.message === 'Unauthorized'
    ) {
      return reply.code(404).send({
        success: false,
        error: error.message,
      });
    }

    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to restore workflow version',
    });
  }
}

/**
 * Delete a workflow version
 */
export async function deleteWorkflowVersionHandler(req, reply) {
  try {
    const userId = req.user.id;
    const { versionId } = req.params;
    const id = parseInt(versionId, 10);

    await deleteWorkflowVersion(id, userId);

    return reply.code(200).send({
      success: true,
      message: 'Version deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting workflow version', {
      error: error.message,
      userId: req.user?.id,
      versionId: req.params?.versionId,
    });

    if (
      error.message === 'Version not found' ||
      error.message === 'Unauthorized'
    ) {
      return reply.code(404).send({
        success: false,
        error: error.message,
      });
    }

    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to delete workflow version',
    });
  }
}
