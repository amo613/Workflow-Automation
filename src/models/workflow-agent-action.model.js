import {
  pgTable,
  serial,
  integer,
  timestamp,
  text,
  jsonb,
} from 'drizzle-orm/pg-core';
import { fullWorkflows } from './full-workflow.model.js';
import { workflowVersions } from './workflow-version.model.js';

export const workflowAgentActions = pgTable('workflow_agent_actions', {
  id: serial('id').primaryKey(),
  workflow_id: integer('workflow_id')
    .notNull()
    .references(() => fullWorkflows.id, { onDelete: 'cascade' }),

  created_at: timestamp('created_at').defaultNow().notNull(),

  // orchestrator | monitoring | optimization | security | execution
  agent_type: text('agent_type').notNull(),

  // workflow_updated | node_updated | suggestion | chat | check_performed
  action_type: text('action_type').notNull(),

  // What changed (diff/patches), node IDs, reason, suggested changes
  details: jsonb('details'),

  // helped | neutral | unknown | not_applicable
  optimization_impact: text('optimization_impact'),

  workflow_version_id: integer('workflow_version_id').references(
    () => workflowVersions.id,
    { onDelete: 'set null' }
  ),
});
