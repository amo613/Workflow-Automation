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
import { getUserTwilioCredentials } from '#services/twilio-credentials.service.js';
import { getPublicUrl, storeCallFrom } from '#utils/public-url.service.js';
import { compileWorkflowToPrompt } from '#utils/workflow-compiler.utils.js';
import { getWorkflow } from '#services/workflow.service.js';
import { db } from '#config/database.js';
import { knowledgeBaseEntries } from '#models/knowledge-base.model.js';
import { fullWorkflows } from '#models/full-workflow.model.js';
import { eq, inArray, and } from 'drizzle-orm';

/**
 * Create a new full workflow
 */
export async function createFullWorkflowHandler(req, reply) {
  try {
    const userId = req.user.id;
    const { name, description, type, workflow_json, goal_definition, agents_enabled } = req.body;

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
      goal_definition,
      agents_enabled,
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
    const { name, description, type, workflow_json, is_active, goal_definition, agents_enabled } = req.body;
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
      goal_definition,
      agents_enabled,
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

    // Run agent pipeline when agents are enabled (fire-and-forget)
    if (workflow.agents_enabled) {
      import('#services/full-workflow/agents/index.js').then(({ runAgentPipeline }) => {
        runAgentPipeline(workflowId, userId).catch(err =>
          logger.warn('Agent pipeline failed after workflow update', {
            workflowId,
            error: err.message,
          })
        );
      });
    }

    // Handle trigger scheduling if workflow_json is updated
    if (workflow_json && workflow_json.nodes) {
      const nodes = workflow_json.nodes || [];
      const workflowJson = workflow_json; // Store for later use

      // Handle Custom Webhook Paths
      try {
        const {
          registerCustomPath,
          unregisterCustomPath,
          getCustomPathsForWorkflow,
        } = await import('#services/custom-webhook-path.service.js');

        // Get existing custom paths for this workflow
        const existingCustomPaths = await getCustomPathsForWorkflow(workflowId);

        // Find webhook trigger nodes with custom paths
        const webhookTriggerNodes = nodes.filter(
          node => node.type === 'webhook-trigger'
        );

        // Collect new custom paths
        const newCustomPaths = [];
        for (const webhookNode of webhookTriggerNodes) {
          const customPath = webhookNode.data?.customPath;
          if (customPath && customPath.trim() !== '') {
            // Ensure path starts with /api/custom/
            const normalizedPath = customPath.startsWith('/api/custom/')
              ? customPath
              : `/api/custom${customPath.startsWith('/') ? '' : '/'}${customPath}`;
            newCustomPaths.push({
              path: normalizedPath,
              nodeId: webhookNode.id,
            });
          }
        }

        // Unregister old custom paths that are no longer used
        for (const oldPath of existingCustomPaths) {
          const stillExists = newCustomPaths.some(np => np.path === oldPath);
          if (!stillExists) {
            await unregisterCustomPath(oldPath);
            logger.info('Unregistered custom webhook path', {
              workflowId,
              customPath: oldPath,
            });
          }
        }

        // Register new custom paths (only if workflow is active)
        if (is_active !== false && workflow.is_active) {
          for (const { path, nodeId } of newCustomPaths) {
            // Check if already registered
            const alreadyExists = existingCustomPaths.includes(path);
            if (!alreadyExists) {
              await registerCustomPath(path, {
                workflowId,
                nodeId,
                webhookId: workflowId.toString(),
              });
              logger.info('Registered custom webhook path', {
                workflowId,
                customPath: path,
                nodeId,
                normalizedPath: path,
              });
            } else {
              logger.info('Custom webhook path already registered', {
                workflowId,
                customPath: path,
                nodeId,
              });
            }
          }
        } else {
          // Workflow is inactive, unregister all custom paths
          for (const { path } of newCustomPaths) {
            await unregisterCustomPath(path);
            logger.info(
              'Unregistered custom webhook path (workflow inactive)',
              {
                workflowId,
                customPath: path,
              }
            );
          }
        }
      } catch (error) {
        logger.error('Error managing custom webhook paths', {
          workflowId,
          error: error.message,
        });
        // Don't fail the save operation if custom path management fails
      }

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

      // Handle Custom Paths when workflow is deactivated
      if (is_active === false || (is_active !== undefined && !is_active)) {
        try {
          const { getCustomPathsForWorkflow, unregisterCustomPath } =
            await import('#services/custom-webhook-path.service.js');
          const customPaths = await getCustomPathsForWorkflow(workflowId);
          for (const path of customPaths) {
            await unregisterCustomPath(path);
            logger.info(
              'Unregistered custom webhook path (workflow deactivated)',
              {
                workflowId,
                customPath: path,
              }
            );
          }
        } catch (error) {
          logger.error('Error unregistering custom paths on deactivation', {
            workflowId,
            error: error.message,
          });
          // Don't fail the save operation
        }
      }

      // Handle HubSpot webhook subscriptions
      try {
        const hubspotTriggerNodes = nodes.filter(
          node => node.type === 'hubspot-trigger'
        );

        if (hubspotTriggerNodes.length > 0) {
          const { hubspotService } = await import(
            '#services/hubspot.service.js'
          );
          const { hubspotWebhookService } = await import(
            '#services/hubspot-webhook.service.js'
          );

          // Get HubSpot integration for user
          let accessToken = null;
          try {
            const { accessToken: token } =
              await hubspotService.getAuthenticatedClient(userId);
            accessToken = token;
          } catch (error) {
            logger.warn(
              'HubSpot not connected, skipping subscription management',
              {
                userId,
                workflowId,
                error: error.message,
              }
            );
            // Continue - don't fail the save operation
          }

          if (accessToken) {
            const frontendUrl =
              process.env.FRONTEND_URL || 'http://localhost:5173';
            const baseUrl = frontendUrl.replace(/\/$/, '');

            for (const hubspotNode of hubspotTriggerNodes) {
              const eventTypes = hubspotNode.data?.eventTypes || [];
              const existingSubscriptionIds =
                hubspotNode.data?.subscriptionIds || [];

              // Delete old subscriptions
              if (existingSubscriptionIds.length > 0) {
                try {
                  await hubspotWebhookService.deleteMultipleSubscriptions(
                    accessToken,
                    existingSubscriptionIds
                  );
                  logger.info('Deleted old HubSpot subscriptions', {
                    workflowId,
                    nodeId: hubspotNode.id,
                    subscriptionIds: existingSubscriptionIds,
                  });
                } catch (error) {
                  logger.warn('Error deleting old HubSpot subscriptions', {
                    workflowId,
                    nodeId: hubspotNode.id,
                    error: error.message,
                  });
                  // Continue - try to create new ones anyway
                }
              }

              // Create new subscriptions if workflow is active and events are selected
              if (
                is_active !== false &&
                workflow.is_active &&
                eventTypes.length > 0
              ) {
                const webhookUrl = `${baseUrl}/api/integrations/hubspot/webhook?workflowId=${workflowId}`;

                try {
                  const result =
                    await hubspotWebhookService.createMultipleSubscriptions(
                      accessToken,
                      eventTypes,
                      webhookUrl
                    );

                  // Update node data with new subscription IDs
                  const newSubscriptionIds = result.subscriptions.map(
                    sub => sub.subscriptionId
                  );
                  hubspotNode.data = {
                    ...hubspotNode.data,
                    subscriptionIds: newSubscriptionIds,
                  };

                  // Update the node in the workflow JSON
                  const nodeIndex = nodes.findIndex(
                    n => n.id === hubspotNode.id
                  );
                  if (nodeIndex !== -1) {
                    nodes[nodeIndex] = hubspotNode;
                  }

                  logger.info('Created HubSpot subscriptions', {
                    workflowId,
                    nodeId: hubspotNode.id,
                    eventTypes,
                    subscriptionIds: newSubscriptionIds,
                  });
                } catch (error) {
                  logger.error('Error creating HubSpot subscriptions', {
                    workflowId,
                    nodeId: hubspotNode.id,
                    error: error.message,
                  });
                  // Continue - don't fail the save operation
                }
              } else if (
                is_active === false ||
                (is_active !== undefined && !is_active)
              ) {
                // Workflow is inactive, clear subscription IDs from node data
                hubspotNode.data = {
                  ...hubspotNode.data,
                  subscriptionIds: [],
                };

                // Update the node in the workflow JSON
                const nodeIndex = nodes.findIndex(n => n.id === hubspotNode.id);
                if (nodeIndex !== -1) {
                  nodes[nodeIndex] = hubspotNode;
                }
              }
            }

            // Update workflow JSON with updated node data (if subscriptions were created/deleted)
            if (
              hubspotTriggerNodes.some(
                n => n.data?.subscriptionIds !== undefined
              )
            ) {
              const updatedWorkflowJson = {
                ...workflowJson,
                nodes,
              };

              // Save updated workflow JSON back to database
              await db
                .update(fullWorkflows)
                .set({
                  workflow_json: updatedWorkflowJson,
                  updated_at: new Date(),
                })
                .where(eq(fullWorkflows.id, workflowId));
            }
          }
        }
      } catch (error) {
        logger.error('Error managing HubSpot webhook subscriptions', {
          workflowId,
          error: error.message,
        });
        // Don't fail the save operation if subscription management fails
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
    const workflowId = parseInt(id, 10);

    // Unregister custom webhook paths before deleting workflow
    try {
      const { getCustomPathsForWorkflow, unregisterCustomPath } = await import(
        '#services/custom-webhook-path.service.js'
      );
      const customPaths = await getCustomPathsForWorkflow(workflowId);
      for (const path of customPaths) {
        await unregisterCustomPath(path);
        logger.info('Unregistered custom webhook path (workflow deleted)', {
          workflowId,
          customPath: path,
        });
      }
    } catch (error) {
      logger.error('Error unregistering custom paths on workflow deletion', {
        workflowId,
        error: error.message,
      });
      // Don't fail the delete operation if custom path cleanup fails
    }

    // Delete HubSpot webhook subscriptions before deleting workflow
    try {
      // Load workflow to get node data
      const workflow = await getFullWorkflow(workflowId, userId);
      const workflowJson = workflow.workflow_json || {};
      const nodes = workflowJson.nodes || [];
      const hubspotTriggerNodes = nodes.filter(
        node => node.type === 'hubspot-trigger'
      );

      if (hubspotTriggerNodes.length > 0) {
        const { hubspotService } = await import('#services/hubspot.service.js');
        const { hubspotWebhookService } = await import(
          '#services/hubspot-webhook.service.js'
        );

        // Get HubSpot integration for user
        try {
          const { accessToken } =
            await hubspotService.getAuthenticatedClient(userId);

          // Delete subscriptions for all HubSpot trigger nodes
          for (const hubspotNode of hubspotTriggerNodes) {
            const subscriptionIds = hubspotNode.data?.subscriptionIds || [];
            if (subscriptionIds.length > 0) {
              try {
                await hubspotWebhookService.deleteMultipleSubscriptions(
                  accessToken,
                  subscriptionIds
                );
                logger.info(
                  'Deleted HubSpot subscriptions (workflow deleted)',
                  {
                    workflowId,
                    nodeId: hubspotNode.id,
                    subscriptionIds,
                  }
                );
              } catch (error) {
                logger.warn('Error deleting HubSpot subscriptions', {
                  workflowId,
                  nodeId: hubspotNode.id,
                  error: error.message,
                });
                // Continue - try to delete other subscriptions
              }
            }
          }
        } catch (error) {
          logger.warn('HubSpot not connected, skipping subscription cleanup', {
            userId,
            workflowId,
            error: error.message,
          });
          // Continue - don't fail the delete operation
        }
      }
    } catch (error) {
      logger.error(
        'Error deleting HubSpot subscriptions on workflow deletion',
        {
          workflowId,
          error: error.message,
        }
      );
      // Don't fail the delete operation if subscription cleanup fails
    }

    await deleteFullWorkflow(workflowId, userId);

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
      // Optimized: Only fetch is_active instead of entire workflow object
      const [workflowStatus] = await db
        .select({ is_active: fullWorkflows.is_active })
        .from(fullWorkflows)
        .where(and(
          eq(fullWorkflows.id, workflowId),
          eq(fullWorkflows.user_id, userId)
        ))
        .limit(1);

      if (!workflowStatus || !workflowStatus.is_active) {
        memoryCache.del(dedupeKey);
        return reply.code(400).send({
          success: false,
          error: 'Workflow not found or not active',
        });
      }

      // Optimized: Pass userRole directly from JWT token instead of querying DB
      const userRole = req.user.role || 'user';
      const result = await triggerWorkflow(workflowId, userId, input, userRole);

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
      
      // Check if error is due to monthly limit exceeded
      if (error.message && error.message.includes('Monthly execution limit exceeded')) {
        return reply.code(429).send({
          success: false,
          error: 'Monthly execution limit exceeded',
          message: error.message,
          code: 'MONTHLY_LIMIT_EXCEEDED',
        });
      }
      
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
    
    // Check if error is due to monthly limit exceeded
    if (error.message && error.message.includes('Monthly execution limit exceeded')) {
      return reply.code(429).send({
        success: false,
        error: 'Monthly execution limit exceeded',
        message: error.message,
        code: 'MONTHLY_LIMIT_EXCEEDED',
      });
    }
    
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
    const { node, edges = [], input = {}, nodes: allNodes = [], nodeOutputsMap = {} } = req.body;

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

    // CRITICAL: Extract node outputs from nodeOutputsMap (minimal data per node sent from frontend)
    // Frontend sends minimal extracted data per node in nodeOutputsMap
    // This includes ALL nodes in the chain, not just directly connected ones
    // Example: Webhook → Switch → Google Sheets
    // nodeOutputsMap contains outputs from both Webhook AND Switch
    if (nodeOutputsMap && Object.keys(nodeOutputsMap).length > 0) {
      // Set node outputs for ALL nodes in the chain (not just directly connected)
      Object.entries(nodeOutputsMap).forEach(([nodeId, output]) => {
        context.setNodeOutput(nodeId, output);
      });
    }

    // Build template context from previous nodes if available
    // This will merge all node outputs into workflowInput
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

/**
 * POST /api/full-workflows/call-trigger?workflowId=123
 * Twilio webhook endpoint for inbound calls
 * NO CSRF Protection (Twilio webhook)
 */
export async function callTriggerWebhookHandler(req, reply) {
  try {
    const { CallSid, From, To, AccountSid, CallStatus, Direction } = req.body;
    const { workflowId } = req.query;

    if (!CallSid) {
      logger.error('Twilio webhook called without CallSid');
      return reply
        .status(400)
        .type('text/xml')
        .send(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>'
        );
    }

    if (!workflowId) {
      logger.error('Call trigger webhook called without workflowId');
      return reply
        .status(400)
        .type('text/xml')
        .send(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>'
        );
    }

    logger.info('Call trigger webhook called', {
      callSid: CallSid,
      from: From,
      to: To,
      workflowId,
    });

    // 1. Load workflow (without userId check for webhook)
    let workflow;
    try {
      workflow = await getFullWorkflow(parseInt(workflowId, 10), null);
    } catch (error) {
      logger.error('Failed to load workflow', {
        workflowId,
        error: error.message,
      });
      return reply
        .status(404)
        .type('text/xml')
        .send(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>'
        );
    }

    if (!workflow || !workflow.is_active) {
      logger.warn('Workflow not found or not active', {
        workflowId,
        isActive: workflow?.is_active,
      });
      return reply
        .status(404)
        .type('text/xml')
        .send(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>'
        );
    }

    // 2. Find Call Trigger Node
    const workflowJson = workflow.workflow_json || {};
    const nodes = workflowJson.nodes || [];
    const callTriggerNodes = nodes.filter(node => node.type === 'call-trigger');

    if (callTriggerNodes.length === 0) {
      logger.error('No call trigger node found in workflow', {
        workflowId,
      });
      return reply
        .status(500)
        .type('text/xml')
        .send(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>'
        );
    }

    // Use first call trigger node (if multiple exist)
    const callTriggerNode = callTriggerNodes[0];

    // 3. Get Twilio Credentials
    const userId = workflow.user_id;
    const twilioCredentials = await getUserTwilioCredentials(userId);
    if (!twilioCredentials) {
      logger.error('Twilio credentials not found for user', {
        userId,
        workflowId,
      });
      return reply
        .status(500)
        .type('text/xml')
        .send(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>'
        );
    }

    // 4. Trigger Workflow (ASYNC - nicht blockieren!)
    // Pass triggerNodeId so the workflow starts from the correct call-trigger node
    const eventId = await triggerWorkflow(parseInt(workflowId, 10), userId, {
      triggerNodeId: callTriggerNode.id, // Explicitly set which trigger node to use
      CallSid,
      From,
      To,
      Direction: Direction || 'inbound',
      _call: {
        timestamp: new Date().toISOString(),
        direction: 'inbound',
        callStatus: CallStatus,
        accountSid: AccountSid,
      },
    });

    logger.info('Workflow triggered for inbound call', {
      workflowId,
      eventId: eventId.eventId || eventId,
      callSid: CallSid,
    });

    // 5. Generate Config from Node
    let callPrompt = '';
    const {
      use_existing,
      workflow_id: promptWorkflowId,
      prompt,
      voice = 'alloy',
      greeting = 'Hello, how can I help you?',
      knowledge_base_ids = [],
      temperature = 1.0,
      instructions = 'You are a helpful voice assistant. Keep responses brief, natural, and conversational.',
      max_response_output_tokens = 4096,
      vad_threshold = 0.5,
      tool_choice = 'auto',
    } = callTriggerNode.data || {};

    const kbIds = Array.isArray(knowledge_base_ids)
      ? knowledge_base_ids
      : knowledge_base_ids
        ? [knowledge_base_ids]
        : [];

    // Load prompt (similar to Call Agent)
    if (use_existing && promptWorkflowId) {
      try {
        const promptWorkflow = await getWorkflow(promptWorkflowId, userId);
        if (promptWorkflow && promptWorkflow.graph_json) {
          callPrompt = compileWorkflowToPrompt(promptWorkflow.graph_json);

          // Remove old knowledge base if new entries selected
          if (kbIds && kbIds.length > 0) {
            const kbSectionRegex =
              /\n\nKNOWLEDGE BASE:[\s\S]*?(?=\n\n(?:[A-Z][A-Z_ ]+:|$))/;
            callPrompt = callPrompt.replace(kbSectionRegex, '');
          }
        }
      } catch (error) {
        logger.error('Failed to load prompt workflow', {
          workflowId: promptWorkflowId,
          error: error.message,
        });
      }
    } else if (prompt) {
      callPrompt = prompt;
    }

    // Load Knowledge Base entries
    let knowledgeBaseText = '';
    if (kbIds && kbIds.length > 0) {
      try {
        const entries = await db
          .select()
          .from(knowledgeBaseEntries)
          .where(
            and(
              eq(knowledgeBaseEntries.user_id, userId),
              inArray(knowledgeBaseEntries.id, kbIds)
            )
          );

        if (entries.length > 0) {
          knowledgeBaseText = entries
            .map(entry => `**${entry.name}**:\n${entry.text}`)
            .join('\n\n');
        }
      } catch (error) {
        logger.error('Failed to load knowledge base entries', {
          error: error.message,
          knowledgeBaseIds: kbIds,
        });
      }
    }

    // Integrate Knowledge Base into prompt
    if (knowledgeBaseText) {
      callPrompt = `${callPrompt}

KNOWLEDGE BASE:
${knowledgeBaseText}`;
    }

    // 6. Generate Config
    const config = {
      prompt: callPrompt,
      voice: voice || 'alloy',
      greeting: greeting || 'Hello, how can I help you?',
      temperature: parseFloat(temperature) || 1.0,
      instructions:
        instructions ||
        'You are a helpful voice assistant. Keep responses brief, natural, and conversational.',
      max_response_output_tokens: parseInt(max_response_output_tokens) || 4096,
      vad_threshold: parseFloat(vad_threshold) || 0.5,
      tool_choice: tool_choice || 'auto',
      workflowId: parseInt(workflowId, 10),
      eventId: eventId.eventId || eventId,
      isInbound: true, // WICHTIG: Flag für Greeting
      userId,
    };

    // 7. Get public URL for WebSocket endpoint
    const publicUrl = getPublicUrl();
    if (!publicUrl) {
      logger.error(
        'Public URL not available, cannot establish proxy connection'
      );
      return reply
        .status(503)
        .type('text/xml')
        .send(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>'
        );
    }

    // Store callSid -> From mapping
    if (From) {
      storeCallFrom(CallSid, From);
    }

    // Convert HTTP(S) URL to WebSocket URL
    const wsProtocol = publicUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = publicUrl.replace(/^https?:\/\//, '');
    const wsFullUrl = `${wsProtocol}://${wsHost}/ws/openai/call?callSid=${CallSid}`;

    // Encode config as base64
    const configBase64 = Buffer.from(JSON.stringify(config)).toString('base64');

    // Escape XML entities in URL for TwiML
    const wsFullUrlEscaped = wsFullUrl.replace(/&/g, '&amp;');

    // 8. Generate TwiML
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsFullUrlEscaped}">
      <Parameter name="callSid" value="${CallSid}" />
      <Parameter name="call_sid" value="${CallSid}" />
      ${AccountSid ? `<Parameter name="account_sid" value="${AccountSid}" />` : ''}
      ${From ? `<Parameter name="from_number" value="${From}" />` : ''}
      ${To ? `<Parameter name="to_number" value="${To}" />` : ''}
      ${CallStatus ? `<Parameter name="call_status" value="${CallStatus}" />` : ''}
      ${Direction ? `<Parameter name="direction" value="${Direction}" />` : ''}
      <Parameter name="config" value="${configBase64}" />
      <Parameter name="isInbound" value="true" />
    </Stream>
  </Connect>
</Response>`;

    logger.info('TwiML generated for inbound call', {
      callSid: CallSid,
      workflowId,
      eventId: eventId.eventId || eventId,
      hasGreeting: !!greeting,
      twimlLength: twiml.length,
      wsUrl: wsFullUrl,
      hasConfig: !!configBase64,
      configLength: configBase64?.length || 0,
      fullTwiML: twiml, // Log full TwiML for debugging
    });

    return reply.status(200).type('text/xml').send(twiml);
  } catch (error) {
    logger.error('Error handling call trigger webhook', {
      error: error.message,
      stack: error.stack,
    });
    return reply
      .status(500)
      .type('text/xml')
      .send(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>'
      );
  }
}

/**
 * Create suggested workflow from natural language goal (optional Phase 7).
 * POST /api/full-workflows/from-goal body: { goal, use_firecrawl? }
 */
export async function postWorkflowFromGoalHandler(req, reply) {
  try {
    const { goal, use_firecrawl: useFirecrawl } = req.body || {};
    if (!goal || typeof goal !== 'string') {
      return reply.code(400).send({ success: false, error: 'goal is required' });
    }

    const { createWorkflowFromGoal } = await import(
      '#services/full-workflow/agents/create-from-goal.service.js'
    );
    const result = await createWorkflowFromGoal(goal.trim(), {
      useFirecrawl: !!useFirecrawl,
    });

    if (!result.success) {
      return reply.code(400).send({
        success: false,
        error: result.error || 'Failed to generate workflow',
      });
    }

    return reply.code(200).send({
      success: true,
      data: { workflow_json: result.workflow_json },
    });
  } catch (error) {
    logger.error('Error creating workflow from goal', {
      error: error.message,
      userId: req.user?.id,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to generate workflow',
    });
  }
}

/**
 * Get agent chat history for a workflow
 */
export async function getWorkflowAgentChatHandler(req, reply) {
  try {
    const userId = req.user.id;
    const workflowId = parseInt(req.params.id, 10);
    const { limit = 50 } = req.query;

    const workflow = await getFullWorkflow(workflowId, userId);
    if (!workflow) {
      return reply.code(404).send({ success: false, error: 'Workflow not found' });
    }

    const { getWorkflowAgentChatMessages } = await import(
      '#services/workflow-agent-action.service.js'
    );
    const messages = await getWorkflowAgentChatMessages(workflowId, userId, {
      limit: parseInt(limit, 10) || 50,
    });

    return reply.code(200).send({ success: true, data: { messages } });
  } catch (error) {
    logger.error('Error getting agent chat history', {
      error: error.message,
      userId: req.user?.id,
      workflowId: req.params?.id,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to get chat history',
    });
  }
}

/**
 * Apply agent-suggested changes to the workflow (persist and document).
 * POST /api/full-workflows/:id/agent/apply
 * Body: { workflow_json?, node_patches?: [{ nodeId, patch }], reason, agent_type, optimization_impact? }
 */
export async function postWorkflowAgentApplyHandler(req, reply) {
  try {
    const userId = req.user.id;
    const workflowId = parseInt(req.params.id, 10);
    const { workflow_json: newWorkflowJson, node_patches: nodePatches, reason, agent_type: agentType, optimization_impact: optimizationImpact } = req.body || {};

    const workflow = await getFullWorkflow(workflowId, userId);
    if (!workflow) {
      return reply.code(404).send({ success: false, error: 'Workflow not found' });
    }
    if (!workflow.agents_enabled) {
      return reply.code(400).send({
        success: false,
        error: 'Agents are not enabled for this workflow',
      });
    }

    let finalWorkflowJson = workflow.workflow_json || { nodes: [], edges: [] };

    if (newWorkflowJson && typeof newWorkflowJson === 'object') {
      finalWorkflowJson = {
        nodes: newWorkflowJson.nodes ?? finalWorkflowJson.nodes,
        edges: newWorkflowJson.edges ?? finalWorkflowJson.edges,
      };
    } else if (Array.isArray(nodePatches) && nodePatches.length > 0) {
      const nodes = [...(finalWorkflowJson.nodes || [])];
      for (const { nodeId, patch } of nodePatches) {
        const idx = nodes.findIndex(n => n.id === nodeId);
        if (idx === -1) continue;
        const node = nodes[idx];
        if (patch && typeof patch === 'object') {
          nodes[idx] = {
            ...node,
            data: { ...(node.data || {}), ...patch },
          };
        }
      }
      finalWorkflowJson = { ...finalWorkflowJson, nodes };
    } else {
      return reply.code(400).send({
        success: false,
        error: 'Provide workflow_json or node_patches',
      });
    }

    const updated = await updateFullWorkflow(workflowId, userId, {
      workflow_json: finalWorkflowJson,
    });

    let versionId = null;
    try {
      const v = await createWorkflowVersion(workflowId, userId, finalWorkflowJson, {
        description: `Agent (${agentType || 'orchestrator'}): ${reason || 'Applied changes'}`,
      });
      versionId = v?.id;
    } catch (err) {
      logger.warn('Failed to create workflow version after agent apply', {
        workflowId,
        error: err.message,
      });
    }

    const { logAgentAction } = await import('#services/workflow-agent-action.service.js');
    await logAgentAction({
      workflowId,
      agentType: agentType || 'orchestrator',
      actionType: 'workflow_updated',
      details: {
        reason: reason || '',
        node_patches: nodePatches || null,
        optimization_impact: optimizationImpact,
      },
      optimizationImpact: optimizationImpact || 'unknown',
      workflowVersionId: versionId,
    });

    return reply.code(200).send({
      success: true,
      data: { workflow: updated, versionId },
    });
  } catch (error) {
    logger.error('Error applying agent changes', {
      error: error.message,
      userId: req.user?.id,
      workflowId: req.params?.id,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to apply',
    });
  }
}

/**
 * POST agent chat: send a message and get assistant reply
 */
export async function postWorkflowAgentChatHandler(req, reply) {
  try {
    const userId = req.user.id;
    const workflowId = parseInt(req.params.id, 10);
    const { message, node_id: nodeId } = req.body || {};

    const workflow = await getFullWorkflow(workflowId, userId);
    if (!workflow) {
      return reply.code(404).send({ success: false, error: 'Workflow not found' });
    }
    if (!workflow.agents_enabled) {
      return reply.code(400).send({
        success: false,
        error: 'Agents are not enabled for this workflow. Enable them in Workflow Settings.',
      });
    }

    const { getWorkflowAgentChatMessages } = await import(
      '#services/workflow-agent-action.service.js'
    );
    const previousMessages = await getWorkflowAgentChatMessages(workflowId, userId, {
      limit: 30,
    });

    const { runAgentChatTurn } = await import(
      '#services/full-workflow/agents/chat.service.js'
    );
    const result = await runAgentChatTurn(workflowId, userId, workflow, {
      message,
      node_id: nodeId,
      previousMessages,
    });

    if (!result.success) {
      return reply.code(500).send({
        success: false,
        error: result.error || 'Agent failed to respond',
      });
    }

    return reply.code(200).send({
      success: true,
      data: { reply: result.reply },
    });
  } catch (error) {
    logger.error('Error in agent chat', {
      error: error.message,
      userId: req.user?.id,
      workflowId: req.params?.id,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to get reply',
    });
  }
}
