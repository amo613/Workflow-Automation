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
  getActiveTriggers,
  scheduleTriggerPolling,
  removeTriggerPolling,
} from '#services/full-workflow/trigger-polling.service.js';
import {
  getWorkflowStatistics,
  getWorkflowExecutionHistory,
} from '#services/full-workflow/statistics.service.js';
import {
  getWorkflowPerformanceStats,
  getAllNodePerformanceStats,
  getNodeExecutionHistory,
  clearWorkflowPerformance,
} from '#services/full-workflow/performance.service.js';
import { createWorkflowVersion } from '#services/workflow-version.service.js';
import { memoryCache } from '#config/cache.js';

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

    // Get existing workflow to compare workflow_json for versioning
    let existingWorkflow = null;
    try {
      const { getFullWorkflow } = await import(
        '#services/full-workflow.service.js'
      );
      existingWorkflow = await getFullWorkflow(workflowId, userId);
    } catch {
      // Workflow might not exist yet, that's okay
    }

    const workflow = await updateFullWorkflow(workflowId, userId, {
      name,
      description,
      type,
      workflow_json,
      is_active,
    });

    // Automatically create a version if workflow_json changed
    if (workflow_json && existingWorkflow) {
      const oldJson = JSON.stringify(existingWorkflow.workflow_json || {});
      const newJson = JSON.stringify(workflow_json);

      if (oldJson !== newJson) {
        try {
          // Create version snapshot automatically
          await createWorkflowVersion(workflowId, userId, workflow_json, {
            description: 'Auto-saved on workflow update',
          });
          logger.info('Created automatic workflow version', {
            workflowId,
            userId,
          });
        } catch (error) {
          // Don't fail the save operation if versioning fails
          logger.warn('Failed to create workflow version', {
            workflowId,
            error: error.message,
          });
        }
      }
    }

    // Handle trigger scheduling if workflow_json is updated
    if (workflow_json && workflow_json.nodes) {
      const nodes = workflow_json.nodes || [];

      // Find all trigger nodes
      const triggerNodes = nodes.filter(
        node =>
          node.type === 'google-sheets-trigger' ||
          node.type === 'schedule-trigger'
      );

      // Remove old triggers for this workflow
      try {
        const existingTriggers = await getActiveTriggers(workflowId);
        for (const trigger of existingTriggers) {
          if (trigger && trigger.triggerNodeId) {
            try {
              await removeTriggerPolling(workflowId, trigger.triggerNodeId);
            } catch (error) {
              logger.warn('Error removing trigger polling job', {
                workflowId,
                triggerNodeId: trigger.triggerNodeId,
                error: error.message,
              });
              // Continue with other triggers
            }
          } else {
            logger.warn('Skipping invalid trigger when removing', {
              workflowId,
              trigger,
            });
          }
        }
      } catch (error) {
        logger.error('Error getting/removing existing triggers', {
          workflowId,
          error: error.message,
        });
        // Continue - don't fail the save operation
      }

      // Schedule new triggers if workflow is active
      if (is_active !== false && workflow.is_active) {
        for (const triggerNode of triggerNodes) {
          // Ensure triggerNode has required properties
          if (!triggerNode || !triggerNode.id) {
            logger.warn('Skipping trigger node without id', {
              workflowId,
              triggerNode,
            });
            continue;
          }

          let triggerConfig;

          if (triggerNode.type === 'google-sheets-trigger') {
            triggerConfig = {
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
          } else if (triggerNode.type === 'schedule-trigger') {
            triggerConfig = {
              type: 'schedule-trigger',
              preset: triggerNode.data?.preset || null,
              cronExpression: triggerNode.data?.cronExpression || null,
              userId,
            };

            // Only schedule if preset or cronExpression is present
            if (triggerConfig.preset || triggerConfig.cronExpression) {
              await scheduleTriggerPolling(
                workflowId,
                triggerNode,
                triggerConfig,
                userId
              );
            } else {
              logger.warn(
                'Skipping schedule trigger without preset or cronExpression',
                {
                  workflowId,
                  triggerNodeId: triggerNode.id,
                }
              );
            }
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
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      logger.error('Unauthorized: User not authenticated', {
        hasUser: !!req.user,
        userId: req.user?.id,
      });
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized: User not authenticated',
      });
    }

    const userId = req.user.id;
    const { id } = req.params;
    const { input = {} } = req.body;
    const workflowId = Number(id);

    // Deduplication: Prevent duplicate triggers within 3 seconds
    const dedupeKey = `workflow-trigger:${workflowId}:${userId}`;
    const existingTrigger = memoryCache.get(dedupeKey);

    if (existingTrigger) {
      logger.warn('Duplicate workflow trigger prevented', {
        workflowId,
        userId,
      });
      return reply.code(429).send({
        success: false,
        error: 'Workflow trigger already in progress. Please wait a moment.',
        data: {
          eventId: existingTrigger.eventId,
          triggeredAt: existingTrigger.triggeredAt,
        },
      });
    }

    // Set lock to prevent race conditions
    const lockPlaceholder = {
      eventId: 'pending',
      triggeredAt: new Date().toISOString(),
    };
    memoryCache.set(dedupeKey, lockPlaceholder, 3);

    try {
      const workflow = await getFullWorkflow(workflowId, userId);

      if (!workflow.is_active) {
        memoryCache.del(dedupeKey);
        return reply.code(400).send({
          success: false,
          error: 'Workflow is not active',
        });
      }

      const result = await triggerWorkflow(workflowId, userId, input);

      // Update lock with actual eventId
      memoryCache.set(
        dedupeKey,
        {
          eventId: result.eventId,
          triggeredAt: new Date().toISOString(),
        },
        3
      );

      return reply.code(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      memoryCache.del(dedupeKey);
      throw error;
    }
  } catch (error) {
    logger.error('Error triggering workflow', {
      error: error.message,
      errorStack: error.stack,
      errorName: error.name,
      errorCode: error.code,
      userId: req.user?.id,
      workflowId: req.params?.id,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to trigger workflow',
      details:
        process.env.NODE_ENV === 'development'
          ? {
              name: error.name,
              code: error.code,
              message: error.message,
            }
          : undefined,
    });
  }
}

/**
 * Execute a single node (for testing/debugging)
 */
export async function executeSingleNodeHandler(req, reply) {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      logger.error('Unauthorized: User not authenticated for execute-node', {
        hasUser: !!req.user,
        userId: req.user?.id,
      });
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized: User not authenticated',
      });
    }

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
      templateContext.workflowInput = {
        ...templateContext.workflowInput,
        userId,
      };
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
      errorStack: error.stack,
      errorName: error.name,
      errorCode: error.code,
      userId: req.user?.id,
      nodeId: req.body?.node?.id,
      nodeType: req.body?.node?.type,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to execute node',
      details:
        process.env.NODE_ENV === 'development'
          ? {
              name: error.name,
              code: error.code,
              message: error.message,
            }
          : undefined,
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

/**
 * Get workflow execution results by event ID
 */
export async function getWorkflowExecutionResultsHandler(req, reply) {
  try {
    const { eventId } = req.query;

    if (!eventId) {
      return reply.code(400).send({
        success: false,
        error: 'eventId is required',
      });
    }

    const cacheKey = `workflow-execution:${eventId}`;

    // Try memory cache first (fast)
    let cachedResult = memoryCache.get(cacheKey);

    // If not in memory cache, try Redis
    if (!cachedResult) {
      try {
        const { getRedisClient } = await import('#config/cache.js');
        const redisClient = getRedisClient();
        if (redisClient && redisClient.isReady) {
          const redisResult = await redisClient.get(cacheKey);
          if (redisResult) {
            cachedResult = JSON.parse(redisResult);
            // Also store in memory cache for faster access next time
            memoryCache.set(cacheKey, cachedResult, 300);
          }
        }
      } catch (redisError) {
        logger.warn('Error reading from Redis cache', {
          eventId,
          error: redisError.message,
        });
      }
    }

    if (!cachedResult) {
      return reply.code(404).send({
        success: false,
        error: 'Execution results not found or expired',
        status: 'pending', // Still running or expired
      });
    }

    return reply.code(200).send({
      success: true,
      data: cachedResult,
    });
  } catch (error) {
    logger.error('Error getting workflow execution results', {
      error: error.message,
      eventId: req.query?.eventId,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to get execution results',
    });
  }
}

/**
 * Get workflow statistics
 */
export async function getWorkflowStatisticsHandler(req, reply) {
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

    // Get statistics
    const statistics = await getWorkflowStatistics(workflowId);

    return reply.code(200).send({
      success: true,
      data: statistics,
    });
  } catch (error) {
    logger.error('Error getting workflow statistics', {
      error: error.message,
      userId: req.user?.id,
      workflowId: req.params?.id,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to get workflow statistics',
    });
  }
}

/**
 * Get workflow execution history
 */
export async function getWorkflowExecutionHistoryHandler(req, reply) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { limit = 50 } = req.query;
    const workflowId = parseInt(id, 10);

    // Verify workflow belongs to user
    const workflow = await getFullWorkflow(workflowId, userId);
    if (!workflow) {
      return reply.code(404).send({
        success: false,
        error: 'Workflow not found',
      });
    }

    // Get execution history
    const history = await getWorkflowExecutionHistory(
      workflowId,
      parseInt(limit, 10)
    );

    return reply.code(200).send({
      success: true,
      data: history,
    });
  } catch (error) {
    logger.error('Error getting workflow execution history', {
      error: error.message,
      userId: req.user?.id,
      workflowId: req.params?.id,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to get execution history',
    });
  }
}

/**
 * Export workflow as JSON
 */
export async function exportWorkflowHandler(req, reply) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const workflowId = parseInt(id, 10);

    // Get workflow
    const workflow = await getFullWorkflow(workflowId, userId);

    // Prepare export data (exclude sensitive/internal fields)
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      workflow: {
        name: workflow.name,
        description: workflow.description,
        type: workflow.type,
        workflow_json: workflow.workflow_json,
        // Don't export: id, user_id, is_active, created_at, updated_at, trigger_config
      },
    };

    // Set headers for file download
    reply.header('Content-Type', 'application/json');
    reply.header(
      'Content-Disposition',
      `attachment; filename="workflow-${workflow.name.replace(/[^a-z0-9]/gi, '_')}-${workflowId}.json"`
    );

    return reply.code(200).send(exportData);
  } catch (error) {
    logger.error('Error exporting workflow', {
      error: error.message,
      userId: req.user?.id,
      workflowId: req.params?.id,
    });

    if (error.message === 'Full workflow not found') {
      return reply.code(404).send({
        success: false,
        error: 'Workflow not found',
      });
    }

    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to export workflow',
    });
  }
}

/**
 * Import workflow from JSON
 */
export async function importWorkflowHandler(req, reply) {
  try {
    const userId = req.user.id;
    const { workflowData, name: newName } = req.body;

    // Validate import data
    if (!workflowData || typeof workflowData !== 'object') {
      return reply.code(400).send({
        success: false,
        error: 'Invalid workflow data. Expected a JSON object.',
      });
    }

    // Validate required fields
    if (!workflowData.workflow) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid workflow format. Missing "workflow" property.',
      });
    }

    const workflow = workflowData.workflow;

    // Validate workflow structure
    if (!workflow.workflow_json || typeof workflow.workflow_json !== 'object') {
      return reply.code(400).send({
        success: false,
        error: 'Invalid workflow format. Missing or invalid "workflow_json".',
      });
    }

    if (
      !workflow.workflow_json.nodes ||
      !Array.isArray(workflow.workflow_json.nodes)
    ) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid workflow format. Missing or invalid "nodes" array.',
      });
    }

    if (
      !workflow.workflow_json.edges ||
      !Array.isArray(workflow.workflow_json.edges)
    ) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid workflow format. Missing or invalid "edges" array.',
      });
    }

    // Prepare workflow data for creation
    const workflowToCreate = {
      name:
        newName ||
        workflow.name ||
        `Imported Workflow ${new Date().toISOString()}`,
      description: workflow.description || null,
      type: workflow.type || 'automation',
      workflow_json: {
        nodes: workflow.workflow_json.nodes,
        edges: workflow.workflow_json.edges,
        viewport: workflow.workflow_json.viewport || { x: 0, y: 0, zoom: 1 },
      },
    };

    // Create new workflow
    const createdWorkflow = await createFullWorkflow(userId, workflowToCreate);

    logger.info('Workflow imported successfully', {
      workflowId: createdWorkflow.id,
      userId,
      importedName: workflowToCreate.name,
    });

    return reply.code(201).send({
      success: true,
      data: createdWorkflow,
      message: 'Workflow imported successfully',
    });
  } catch (error) {
    logger.error('Error importing workflow', {
      error: error.message,
      userId: req.user?.id,
    });

    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to import workflow',
    });
  }
}

/**
 * Get workflow performance statistics
 */
export async function getWorkflowPerformanceHandler(req, reply) {
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

    // Get workflow-level and node-level performance stats
    const [workflowStats, nodeStats] = await Promise.all([
      getWorkflowPerformanceStats(workflowId),
      getAllNodePerformanceStats(workflowId),
    ]);

    return reply.code(200).send({
      success: true,
      data: {
        workflow: workflowStats,
        nodes: nodeStats,
      },
    });
  } catch (error) {
    logger.error('Error getting workflow performance', {
      error: error.message,
      userId: req.user?.id,
      workflowId: req.params?.id,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to get performance statistics',
    });
  }
}

/**
 * Get node execution history for performance graph
 */
export async function getNodePerformanceHistoryHandler(req, reply) {
  try {
    const userId = req.user.id;
    const { id, nodeId } = req.params;
    const { limit = 50 } = req.query;
    const workflowId = parseInt(id, 10);

    // Verify workflow belongs to user
    const workflow = await getFullWorkflow(workflowId, userId);
    if (!workflow) {
      return reply.code(404).send({
        success: false,
        error: 'Workflow not found',
      });
    }

    // Get execution history for the node
    const history = await getNodeExecutionHistory(
      workflowId,
      nodeId,
      parseInt(limit, 10)
    );

    return reply.code(200).send({
      success: true,
      data: history,
    });
  } catch (error) {
    logger.error('Error getting node performance history', {
      error: error.message,
      userId: req.user?.id,
      workflowId: req.params?.id,
      nodeId: req.params?.nodeId,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to get node performance history',
    });
  }
}

/**
 * Clear performance data for a workflow
 */
export async function clearWorkflowPerformanceHandler(req, reply) {
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

    await clearWorkflowPerformance(workflowId);

    return reply.code(200).send({
      success: true,
      message: 'Performance data cleared successfully',
    });
  } catch (error) {
    logger.error('Error clearing workflow performance', {
      error: error.message,
      userId: req.user?.id,
      workflowId: req.params?.id,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to clear performance data',
    });
  }
}
