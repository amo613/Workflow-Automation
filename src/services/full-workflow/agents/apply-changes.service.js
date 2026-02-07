/**
 * Apply agent-suggested changes to workflows.
 * Supports: node updates, adding nodes, removing nodes, restructuring.
 * VALIDATES: Only allowed node types can be added.
 */
import { updateFullWorkflow } from '#services/full-workflow.service.js';
import { createWorkflowVersion } from '#services/workflow-version.service.js';
import { logAgentAction } from '#services/workflow-agent-action.service.js';
import logger from '#config/logger.js';

// CRITICAL: Allowed node types (must match system capabilities)
const ALLOWED_NODE_TYPES = [
  'start', 'end',
  'webhook', 'webhook-trigger',
  'http-request',
  'variable-set',
  'if', 'switch',
  'wait',
  'email', 'gmail',
  'database-query',
  'google-sheets', 'google-sheets-trigger',
  'call-agent', 'ai-agent',
  'call-trigger',
  'merge',
  'knowledge-base-query',
  'web-scraper',
  'hubspot', 'hubspot-trigger',
  'schedule-trigger'
];

/**
 * Apply optimization changes to a workflow (auto-apply from agents).
 * @param {number} workflowId
 * @param {number} userId
 * @param {object} workflow - current workflow with workflow_json
 * @param {Array} changes - array of { type, nodeId?, patch?, reason?, ... }
 * @returns {Promise<{ success: boolean, appliedCount: number, versionId?: number, rejectedChanges?: Array }>}
 */
export async function applyOptimizationChanges(
  workflowId,
  userId,
  workflow,
  changes
) {
  if (!Array.isArray(changes) || changes.length === 0) {
    return { success: true, appliedCount: 0 };
  }

  let nodes = [...(workflow.workflow_json?.nodes || [])];
  let edges = [...(workflow.workflow_json?.edges || [])];
  let appliedCount = 0;
  const appliedChanges = [];
  const rejectedChanges = [];

  for (const change of changes) {
    try {
      if (change.type === 'node_update' && change.nodeId && change.patch) {
        // Update existing node data
        const idx = nodes.findIndex(n => n.id === change.nodeId);
        if (idx !== -1) {
          nodes[idx] = {
            ...nodes[idx],
            data: { ...(nodes[idx].data || {}), ...change.patch },
          };
          appliedCount++;
          appliedChanges.push({
            type: 'node_update',
            nodeId: change.nodeId,
            reason: change.reason,
          });
        }
      } else if (change.type === 'add_node') {
        // VALIDATION: Only allow known node types
        const nodeType = change.nodeType || 'custom';
        if (!ALLOWED_NODE_TYPES.includes(nodeType)) {
          logger.warn('Rejected add_node: invalid node type', {
            workflowId,
            nodeType,
            allowedTypes: ALLOWED_NODE_TYPES,
            change,
          });
          rejectedChanges.push({
            change,
            reason: `Node type "${nodeType}" is not allowed. Use one of: ${ALLOWED_NODE_TYPES.join(', ')}`,
          });
          continue; // Skip this change
        }
        
        // Add new node
        const newNodeId = change.nodeId || `agent_added_${Date.now()}_${appliedCount}`;
        const position = calculateNodePosition(nodes, change.position, change.connectAfter);
        
        const newNode = {
          id: newNodeId,
          type: nodeType,
          position,
          data: change.nodeData || change.data || {},
        };
        nodes.push(newNode);
        
        // Connect node if specified
        if (change.connectAfter) {
          const newEdgeId = `edge_${newNodeId}_${Date.now()}`;
          edges.push({
            id: newEdgeId,
            source: change.connectAfter,
            target: newNodeId,
            sourceHandle: change.sourceHandle || null,
            targetHandle: change.targetHandle || null,
          });
        }
        if (change.connectBefore) {
          const newEdgeId = `edge_${Date.now()}_${newNodeId}`;
          edges.push({
            id: newEdgeId,
            source: newNodeId,
            target: change.connectBefore,
            sourceHandle: change.sourceHandle || null,
            targetHandle: change.targetHandle || null,
          });
        }
        
        appliedCount++;
        appliedChanges.push({
          type: 'add_node',
          nodeId: newNodeId,
          nodeType: nodeType,
          reason: change.reason,
        });
      } else if (change.type === 'remove_node' && change.nodeId) {
        // Remove node and reconnect edges if needed
        const nodeExists = nodes.some(n => n.id === change.nodeId);
        if (nodeExists) {
          // Find incoming and outgoing edges
          const incomingEdges = edges.filter(e => e.target === change.nodeId);
          const outgoingEdges = edges.filter(e => e.source === change.nodeId);
          
          // Reconnect: connect all incoming sources to all outgoing targets
          if (change.reconnect !== false && incomingEdges.length > 0 && outgoingEdges.length > 0) {
            for (const inEdge of incomingEdges) {
              for (const outEdge of outgoingEdges) {
                edges.push({
                  id: `edge_reconnect_${Date.now()}_${appliedCount}`,
                  source: inEdge.source,
                  target: outEdge.target,
                  sourceHandle: inEdge.sourceHandle,
                  targetHandle: outEdge.targetHandle,
                });
              }
            }
          }
          
          // Remove the node and its edges
          nodes = nodes.filter(n => n.id !== change.nodeId);
          edges = edges.filter(
            e => e.source !== change.nodeId && e.target !== change.nodeId
          );
          
          appliedCount++;
          appliedChanges.push({
            type: 'remove_node',
            nodeId: change.nodeId,
            reason: change.reason,
            reconnected: incomingEdges.length > 0 && outgoingEdges.length > 0,
          });
        }
      } else if (change.type === 'workflow_update') {
        // General workflow-level changes (e.g., metadata)
        // Currently not implemented, placeholder for future
        logger.debug('workflow_update change type not yet implemented', { change });
      }
    } catch (err) {
      logger.warn('Failed to apply single change', {
        workflowId,
        change,
        error: err.message,
      });
    }
  }

  if (appliedCount === 0) {
    if (rejectedChanges.length > 0) {
      logger.warn('All changes rejected due to validation', { workflowId, rejectedChanges });
      return { success: false, appliedCount: 0, rejectedChanges, error: 'All changes rejected' };
    }
    return { success: true, appliedCount: 0 };
  }

  const finalWorkflowJson = {
    nodes,
    edges,
  };

  try {
    await updateFullWorkflow(workflowId, userId, {
      workflow_json: finalWorkflowJson,
    });

    let versionId = null;
    try {
      const reasons = appliedChanges.map(c => c.reason || 'Auto-fix').join('; ');
      const v = await createWorkflowVersion(workflowId, userId, finalWorkflowJson, {
        description: `Agent Auto-Apply: ${reasons}`,
      });
      versionId = v?.id ? Number(v.id) : null;
    } catch (versionErr) {
      logger.warn('Failed to create workflow version after auto-apply', {
        workflowId,
        error: versionErr.message,
      });
    }

    await logAgentAction({
      workflowId,
      agentType: 'orchestrator',
      actionType: 'workflow_updated',
      details: {
        reason: 'Auto-applied optimization changes',
        appliedChanges,
        rejectedChanges,
        appliedCount,
        rejectedCount: rejectedChanges.length,
      },
      optimizationImpact: 'helped',
      workflowVersionId: versionId,
    });

    logger.info('Auto-applied optimization changes', {
      workflowId,
      appliedCount,
      rejectedCount: rejectedChanges.length,
      versionId,
    });

    return { success: true, appliedCount, rejectedChanges, versionId };
  } catch (err) {
    logger.error('Failed to save workflow after applying changes', {
      workflowId,
      error: err.message,
    });
    return { success: false, appliedCount: 0, error: err.message };
  }
}

/**
 * Calculate position for new node based on existing nodes.
 */
function calculateNodePosition(nodes, positionHint, connectAfterNodeId) {
  if (positionHint && typeof positionHint === 'object' && positionHint.x != null && positionHint.y != null) {
    return positionHint;
  }

  // If connecting after a node, position it below
  if (connectAfterNodeId) {
    const sourceNode = nodes.find(n => n.id === connectAfterNodeId);
    if (sourceNode && sourceNode.position) {
      return {
        x: sourceNode.position.x,
        y: (sourceNode.position.y || 0) + 100,
      };
    }
  }

  // Default: position at end
  const maxY = nodes.reduce((max, n) => Math.max(max, n.position?.y || 0), 0);
  return { x: 100, y: maxY + 150 };
}
