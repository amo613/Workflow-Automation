import logger from '#config/logger.js';
import {
  createFullWorkflow,
  getFullWorkflow,
  getAllFullWorkflows,
  updateFullWorkflow,
  deleteFullWorkflow,
} from '#services/full-workflow.service.js';
import { triggerWorkflow } from '#services/full-workflow/trigger.service.js';
import { executeNode } from '#services/full-workflow/node-handlers/index.js';
import VariableContext from '#services/full-workflow/variable-context.service.js';
import { 
  getAllActiveTriggers, 
  getActiveTriggers,
  scheduleTriggerPolling,
  removeTriggerPolling,
} from '#services/full-workflow/trigger-polling.service.js';

/**
 * Create a new full workflow
 */
export async function createFullWorkflowHandler(req, reply) {
  try {
    const userId = req.user.id;
    const { name, description, type, workflow_json } = req.body;

    if (!name || !workflow_json) {
      return reply.code(400).send({
        success: false,
        error: 'Name and workflow_json are required',
      });
    }

    const workflow = await createFullWorkflow(userId, {
      name,
      description,
      type: type || 'automation',
      workflow_json,
    });

    return reply.code(201).send({
      success: true,
      data: workflow,
    });
  } catch (error) {
    logger.error('Error creating full workflow', {
      error: error.message,
      userId: req.user?.id,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to create full workflow',
    });
  }
}

/**
 * Get all full workflows for the user
 */
export async function getAllFullWorkflowsHandler(req, reply) {
  try {
    const userId = req.user.id;
    const { type } = req.query;

    const workflows = await getAllFullWorkflows(userId);

    // Filter by type if provided
    const filteredWorkflows = type
      ? workflows.filter(w => w.type === type)
      : workflows;

    return reply.code(200).send({
      success: true,
      data: filteredWorkflows,
    });
  } catch (error) {
    logger.error('Error getting all full workflows', {
      error: error.message,
      userId: req.user?.id,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to get full workflows',
    });
  }
}

/**
 * Get a specific full workflow
 */
export async function getFullWorkflowHandler(req, reply) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const workflow = await getFullWorkflow(parseInt(id, 10), userId);

    return reply.code(200).send({
      success: true,
      data: workflow,
    });
  } catch (error) {
    logger.error('Error getting full workflow', {
      error: error.message,
      userId: req.user?.id,
      workflowId: req.params?.id,
    });

    if (error.message === 'Full workflow not found') {
      return reply.code(404).send({
        success: false,
        error: error.message,
      });
    }

    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to get full workflow',
    });
  }
}

/**
 * Update a full workflow
 */
export async function updateFullWorkflowHandler(req, reply) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, description, type, workflow_json, is_active } = req.body;
    const workflowId = parseInt(id, 10);

    const workflow = await updateFullWorkflow(workflowId, userId, {
      name,
      description,
      type,
      workflow_json,
      is_active,
    });

    // Handle trigger scheduling if workflow_json is updated
    if (workflow_json && workflow_json.nodes) {
      const nodes = workflow_json.nodes || [];
      
      // Find all trigger nodes
      const triggerNodes = nodes.filter(
        node => node.type === 'google-sheets-trigger'
      );

      // Remove old triggers for this workflow
      const existingTriggers = await getActiveTriggers(workflowId);
      for (const trigger of existingTriggers) {
        await removeTriggerPolling(workflowId, trigger.triggerNodeId);
      }

      // Schedule new triggers if workflow is active
      if (is_active !== false && workflow.is_active) {
        for (const triggerNode of triggerNodes) {
          const triggerConfig = {
            type: 'google-sheets-trigger',
            pollTime: triggerNode.data?.pollTime || '1 minute',
            spreadsheetId: triggerNode.data?.spreadsheetId,
            sheetName: triggerNode.data?.sheetName,
            triggerOn: triggerNode.data?.triggerOn || 'Row added or updated',
            userId,
          };

          // Only schedule if all required fields are present
          if (triggerConfig.spreadsheetId && triggerConfig.sheetName) {
            await scheduleTriggerPolling(
              workflowId,
              triggerNode,
              triggerConfig,
              userId
            );
          }
        }
      }
    }

    return reply.code(200).send({
      success: true,
      data: workflow,
    });
  } catch (error) {
    logger.error('Error updating full workflow', {
      error: error.message,
      userId: req.user?.id,
      workflowId: req.params?.id,
    });

    if (error.message === 'Full workflow not found') {
      return reply.code(404).send({
        success: false,
        error: error.message,
      });
    }

    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to update full workflow',
    });
  }
}

/**
 * Delete a full workflow
 */
export async function deleteFullWorkflowHandler(req, reply) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await deleteFullWorkflow(parseInt(id, 10), userId);

    return reply.code(200).send({
      success: true,
      message: 'Full workflow deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting full workflow', {
      error: error.message,
      userId: req.user?.id,
      workflowId: req.params?.id,
    });

    if (error.message === 'Full workflow not found') {
      return reply.code(404).send({
        success: false,
        error: error.message,
      });
    }

    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to delete full workflow',
    });
  }
}

/**
 * Trigger a full workflow execution
 */
export async function triggerWorkflowHandler(req, reply) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { input = {} } = req.body;

    // Verify workflow exists and belongs to user
    const workflow = await getFullWorkflow(Number(id), userId);

    if (!workflow.is_active) {
      return reply.code(400).send({
        success: false,
        error: 'Workflow is not active',
      });
    }

    // For development: execute synchronously to get immediate results
    // In production, use Inngest for async execution
    if (process.env.NODE_ENV === 'development') {
      const { executeWorkflow } = await import(
        '#services/full-workflow/executor.service.js'
      );
      const executionResult = await executeWorkflow(workflow, input, userId);

      return reply.code(200).send({
        success: true,
        data: {
          eventId: `dev-${Date.now()}`,
          workflowId: Number(id),
          executionResult,
          nodeOutputs: executionResult.nodeOutputs,
          executedEdges: executionResult.executedEdges || [],
        },
      });
    }

    // Trigger workflow via Inngest (production)
    const result = await triggerWorkflow(Number(id), userId, input);

    return reply.code(200).send({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error triggering workflow', {
      error: error.message,
      userId: req.user?.id,
      workflowId: req.params?.id,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to trigger workflow',
    });
  }
}

/**
 * Execute a single node (for testing/debugging)
 */
export async function executeSingleNodeHandler(req, reply) {
  try {
    const userId = req.user.id;
    const { node, edges = [], input = {} } = req.body;

    if (!node) {
      return reply.code(400).send({
        success: false,
        error: 'Node is required',
      });
    }

    // Create a minimal context for single node execution
    const context = new VariableContext();
    context.setWorkflowInput({ ...input, userId });
    context.setVariable('userId', userId);

    // Build template context from previous nodes if available
    const templateContext = context.getContext(node.id, edges);
    
    // Ensure userId is in templateContext for node handlers
    if (!templateContext.userId) {
      templateContext.userId = userId;
    }
    if (!templateContext.workflowInput?.userId) {
      templateContext.workflowInput = { ...templateContext.workflowInput, userId };
    }

    // Execute the node
    const output = await executeNode(node, templateContext, context);

    return reply.code(200).send({
      success: true,
      data: {
        output,
        nodeId: node.id,
        nodeType: node.type,
      },
    });
  } catch (error) {
    logger.error('Error executing single node', {
      error: error.message,
      userId: req.user?.id,
      nodeId: req.body?.node?.id,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to execute node',
    });
  }
}

/**
 * Get active triggers for a workflow
 */
export async function getActiveTriggersHandler(req, reply) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const workflowId = parseInt(id, 10);

    // Verify workflow belongs to user
    const workflow = await getFullWorkflow(workflowId, userId);
    if (!workflow) {
      return reply.code(404).send({
        success: false,
        error: 'Workflow not found',
      });
    }

    // Get active triggers for this workflow
    const triggers = await getActiveTriggers(workflowId);

    return reply.code(200).send({
      success: true,
      data: triggers,
    });
  } catch (error) {
    logger.error('Error getting active triggers', {
      error: error.message,
      userId: req.user?.id,
      workflowId: req.params?.id,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to get active triggers',
    });
  }
}
