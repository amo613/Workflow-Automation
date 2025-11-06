import logger from '#config/logger.js';
import { db } from '#config/database.js';
import { workflows } from '#models/workflow.model.js';
import { eq, and, desc } from 'drizzle-orm';

export const createWorkflow = async (userId, data) => {
  try {
    const [workflow] = await db
      .insert(workflows)
      .values({
        user_id: userId,
        name: data.name,
        description: data.description || null,
        graph_json: data.graph_json,
        is_active: false,
      })
      .returning();

    logger.info(`Workflow ${workflow.id} created for user ${userId}`);
    return workflow;
  } catch (error) {
    logger.error('Error creating workflow:', error);
    throw error;
  }
};

export const getWorkflow = async (workflowId, userId) => {
  try {
    const [workflow] = await db
      .select()
      .from(workflows)
      .where(and(eq(workflows.id, workflowId), eq(workflows.user_id, userId)))
      .limit(1);

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    return workflow;
  } catch (error) {
    logger.error(`Error getting workflow ${workflowId}:`, error);
    throw error;
  }
};

export const getAllWorkflows = async userId => {
  try {
    const userWorkflows = await db
      .select()
      .from(workflows)
      .where(eq(workflows.user_id, userId))
      .orderBy(desc(workflows.updated_at));

    return userWorkflows;
  } catch (error) {
    logger.error(`Error getting workflows for user ${userId}:`, error);
    throw error;
  }
};

export const updateWorkflow = async (workflowId, userId, data) => {
  try {
    // First verify ownership
    await getWorkflow(workflowId, userId);

    const updateData = {
      updated_at: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.graph_json !== undefined) updateData.graph_json = data.graph_json;

    // If setting is_active to true, deactivate all other workflows for this user
    if (data.is_active === true) {
      // Deactivate all other workflows
      await db
        .update(workflows)
        .set({ is_active: false, updated_at: new Date() })
        .where(
          and(eq(workflows.user_id, userId), eq(workflows.is_active, true))
        );

      updateData.is_active = true;
    } else if (data.is_active === false) {
      updateData.is_active = false;
    }

    const [updated] = await db
      .update(workflows)
      .set(updateData)
      .where(and(eq(workflows.id, workflowId), eq(workflows.user_id, userId)))
      .returning();

    logger.info(`Workflow ${workflowId} updated for user ${userId}`);
    return updated;
  } catch (error) {
    logger.error(`Error updating workflow ${workflowId}:`, error);
    throw error;
  }
};

// Get active workflow for a user
export const getActiveWorkflow = async userId => {
  try {
    const [workflow] = await db
      .select()
      .from(workflows)
      .where(and(eq(workflows.user_id, userId), eq(workflows.is_active, true)))
      .limit(1);

    return workflow || null;
  } catch (error) {
    logger.error(`Error getting active workflow for user ${userId}:`, error);
    return null;
  }
};

export const deleteWorkflow = async (workflowId, userId) => {
  try {
    // First verify ownership
    await getWorkflow(workflowId, userId);

    await db
      .delete(workflows)
      .where(and(eq(workflows.id, workflowId), eq(workflows.user_id, userId)));

    logger.info(`Workflow ${workflowId} deleted for user ${userId}`);
    return { success: true };
  } catch (error) {
    logger.error(`Error deleting workflow ${workflowId}:`, error);
    throw error;
  }
};
