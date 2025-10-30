import { Queue } from 'bullmq';
import { REDIS_URL } from '#config/env.js';

export const jobQueue = new Queue('jobs', {
  connection: { url: REDIS_URL },
});

export default jobQueue;
