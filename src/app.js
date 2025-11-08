import express from 'express';
import { jobQueue } from './jobs/jobs.queue.js';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

const app = express();

// Inline Bull Board setup,no dynamic import paths
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
createBullBoard({
  queues: [new BullMQAdapter(jobQueue)],
  serverAdapter,
});
app.use('/admin/queues', serverAdapter.getRouter());

// Body parsing for Bull Board routes only
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

export default app;
