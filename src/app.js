import express from 'express';
import { jobQueue } from './jobs/jobs.queue.js';
import { workflowExecutionQueue } from './services/full-workflow/workflow-execution.queue.js';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

const app = express();

// Bull Board: jobs + workflow-execution queues
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
createBullBoard({
  queues: [
    new BullMQAdapter(jobQueue),
    new BullMQAdapter(workflowExecutionQueue),
  ],
  serverAdapter,
});
app.use('/admin/queues', serverAdapter.getRouter());

// Body parsing for Bull Board routes only
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

export default app;
