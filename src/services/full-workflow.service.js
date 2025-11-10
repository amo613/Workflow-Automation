import logger from '#config/logger.js';
import { db } from '#config/database.js';
import { fullWorkflows } from '#models/full-workflow.model.js';
import { eq, and, desc } from 'drizzle-orm';

export const createFullWorkflow = async (userId, data) => {
  try {
    const [workflow] = await db
      .insert(fullWorkflows)
      .values({
        user_id: userId,
        name: data.name,
        description: data.description || null,
        type: data.type || 'automation',
        workflow_json: data.workflow_json,
        is_active: false,
      })
      .returning();

    logger.info(`Full workflow ${workflow.id} created for user ${userId}`);
    return workflow;
  } catch (error) {
    logger.error('Error creating full workflow:', error);
    throw error;
  }
};

export const getFullWorkflow = async (workflowId, userId) => {
  try {
    const [workflow] = await db
      .select()
      .from(fullWorkflows)
      .where(
        and(eq(fullWorkflows.id, workflowId), eq(fullWorkflows.user_id, userId))
      )
      .limit(1);

    if (!workflow) {
      throw new Error('Full workflow not found');
    }

    return workflow;
  } catch (error) {
    logger.error(`Error getting full workflow ${workflowId}:`, error);
    throw error;
  }
};

export const getAllFullWorkflows = async userId => {
  try {
    const userWorkflows = await db
      .select()
      .from(fullWorkflows)
      .where(eq(fullWorkflows.user_id, userId))
      .orderBy(desc(fullWorkflows.created_at));

    return userWorkflows;
  } catch (error) {
    logger.error(`Error getting all full workflows for user ${userId}:`, error);
    throw error;
  }
};

export const updateFullWorkflow = async (workflowId, userId, data) => {
  try {
    // Check if workflow exists and belongs to user
    const [existing] = await db
      .select()
      .from(fullWorkflows)
      .where(
        and(eq(fullWorkflows.id, workflowId), eq(fullWorkflows.user_id, userId))
      )
      .limit(1);

    if (!existing) {
      throw new Error('Full workflow not found');
    }

    const updateData = {
      updated_at: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.workflow_json !== undefined)
      updateData.workflow_json = data.workflow_json;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;

    const [updated] = await db
      .update(fullWorkflows)
      .set(updateData)
      .where(eq(fullWorkflows.id, workflowId))
      .returning();

    logger.info(`Full workflow ${workflowId} updated for user ${userId}`);
    return updated;
  } catch (error) {
    logger.error(`Error updating full workflow ${workflowId}:`, error);
    throw error;
  }
};

export const deleteFullWorkflow = async (workflowId, userId) => {
  try {
    // Check if workflow exists and belongs to user
    const [existing] = await db
      .select()
      .from(fullWorkflows)
      .where(
        and(eq(fullWorkflows.id, workflowId), eq(fullWorkflows.user_id, userId))
      )
      .limit(1);

    if (!existing) {
      throw new Error('Full workflow not found');
    }

    await db.delete(fullWorkflows).where(eq(fullWorkflows.id, workflowId));

    logger.info(`Full workflow ${workflowId} deleted for user ${userId}`);
  } catch (error) {
    logger.error(`Error deleting full workflow ${workflowId}:`, error);
    throw error;
  }
};
