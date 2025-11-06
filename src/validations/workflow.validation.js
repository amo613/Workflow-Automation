import { z } from 'zod';
import { validateWorkflowPath } from '#utils/workflow-compiler.utils.js';

// React Flow graph structure validation - be very flexible
const positionSchema = z
  .object({
    x: z.number(),
    y: z.number(),
  })
  .passthrough();

// Node data can have various fields - be flexible
const nodeDataSchema = z.object({}).passthrough();

// Node schema - allow additional React Flow fields
const nodeSchema = z
  .object({
    id: z.string(),
    type: z.enum(['start', 'if', 'step', 'end']),
    position: positionSchema,
    data: nodeDataSchema,
  })
  .passthrough();

// Edge schema - allow additional React Flow fields
// React Flow may generate edges without id initially, so make id optional
// React Flow can add many internal fields (animated, selected, style, etc.)
const edgeSchema = z
  .object({
    id: z.string().optional(),
    source: z.string(),
    target: z.string(),
    sourceHandle: z.union([z.string(), z.null()]).optional(),
    targetHandle: z.union([z.string(), z.null()]).optional(),
  })
  .passthrough();

// Graph JSON schema - be flexible with additional fields
const graphJsonSchema = z
  .object({
    nodes: z.array(nodeSchema).min(1),
    edges: z.array(edgeSchema),
  })
  .passthrough()
  .refine(
    data => {
      try {
        // Must have at least one start node
        const hasStartNode = data.nodes?.some(node => node?.type === 'start');
        if (!hasStartNode) {
          return false;
        }

        // Must have at least one end node
        const hasEndNode = data.nodes?.some(node => node?.type === 'end');
        if (!hasEndNode) {
          return false;
        }

        // Must have a path from start to end (directly or through other nodes)
        return validateWorkflowPath(data);
      } catch {
        // If validation logic fails, return false
        return false;
      }
    },
    {
      message:
        'Workflow must have at least one start node, one end node, and there must be a path from start to end (directly or through other nodes)',
    }
  );

// Workflow creation/update schemas
export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  graph_json: graphJsonSchema,
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  graph_json: graphJsonSchema.optional(),
  is_active: z.boolean().optional(),
});

export const workflowIdSchema = z.object({
  id: z.string().or(z.number()),
});
