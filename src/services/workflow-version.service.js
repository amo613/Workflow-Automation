import { db } from '#config/database.js';
import { workflowVersions } from '#models/workflow-version.model.js';
import { fullWorkflows } from '#models/full-workflow.model.js';
import { eq, desc, count } from 'drizzle-orm';
import logger from '#config/logger.js';

/**
 * Create a new workflow version (snapshot)
 */
export async function createWorkflowVersion(
  workflowId,
  userId,
  workflowJson,
  options = {}
) {
  try {
    // Get the latest version number for this workflow
    const latestVersion = await db
      .select({ version_number: workflowVersions.version_number })
      .from(workflowVersions)
      .where(eq(workflowVersions.workflow_id, workflowId))
      .orderBy(desc(workflowVersions.version_number))
      .limit(1);

    const nextVersionNumber =
      latestVersion.length > 0 ? latestVersion[0].version_number + 1 : 1;

    // Create new version
    const [version] = await db
      .insert(workflowVersions)
      .values({
        workflow_id: workflowId,
        version_number: nextVersionNumber,
        name: options.name || null,
        description: options.description || null,
        workflow_json: workflowJson,
        created_by: userId || null,
      })
      .returning();

    logger.info('Created workflow version', {
      workflowId,
      versionId: version.id,
      versionNumber: version.version_number,
    });

    return version;
  } catch (error) {
    logger.error('Error creating workflow version', {
      workflowId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get all versions for a workflow with pagination
 */
export async function getWorkflowVersions(workflowId, userId, options = {}) {
  try {
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    // Verify user has access to this workflow
    const [workflow] = await db
      .select()
      .from(fullWorkflows)
      .where(eq(fullWorkflows.id, workflowId))
      .limit(1);

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    if (workflow.user_id !== userId) {
      throw new Error('Unauthorized');
    }

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(workflowVersions)
      .where(eq(workflowVersions.workflow_id, workflowId));

    const total = totalResult?.count || 0;

    // Get paginated versions
    const versions = await db
      .select()
      .from(workflowVersions)
      .where(eq(workflowVersions.workflow_id, workflowId))
      .orderBy(desc(workflowVersions.version_number))
      .limit(limit)
      .offset(offset);

    return {
      versions,
      total,
      hasMore: offset + versions.length < total,
    };
  } catch (error) {
    logger.error('Error getting workflow versions', {
      workflowId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get a specific version by ID
 */
export async function getWorkflowVersion(versionId, userId) {
  try {
    const [version] = await db
      .select()
      .from(workflowVersions)
      .where(eq(workflowVersions.id, versionId))
      .limit(1);

    if (!version) {
      throw new Error('Version not found');
    }

    // Verify user has access to the workflow
    const [workflow] = await db
      .select()
      .from(fullWorkflows)
      .where(eq(fullWorkflows.id, version.workflow_id))
      .limit(1);

    if (!workflow || workflow.user_id !== userId) {
      throw new Error('Unauthorized');
    }

    return version;
  } catch (error) {
    logger.error('Error getting workflow version', {
      versionId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Restore a workflow to a specific version
 */
export async function restoreWorkflowVersion(workflowId, versionId, userId) {
  try {
    // Get the version
    const version = await getWorkflowVersion(versionId, userId);

    if (version.workflow_id !== workflowId) {
      throw new Error('Version does not belong to this workflow');
    }

    // Update the workflow with the version's JSON
    const [updatedWorkflow] = await db
      .update(fullWorkflows)
      .set({
        workflow_json: version.workflow_json,
        updated_at: new Date(),
      })
      .where(eq(fullWorkflows.id, workflowId))
      .returning();

    logger.info('Restored workflow to version', {
      workflowId,
      versionId,
      versionNumber: version.version_number,
    });

    return updatedWorkflow;
  } catch (error) {
    logger.error('Error restoring workflow version', {
      workflowId,
      versionId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Delete a workflow version
 */
export async function deleteWorkflowVersion(versionId, userId) {
  try {
    // Verify user has access
    const version = await getWorkflowVersion(versionId, userId);

    // Delete the version
    await db.delete(workflowVersions).where(eq(workflowVersions.id, versionId));

    logger.info('Deleted workflow version', {
      versionId,
      workflowId: version.workflow_id,
    });

    return { success: true };
  } catch (error) {
    logger.error('Error deleting workflow version', {
      versionId,
      error: error.message,
    });
    throw error;
  }
}
