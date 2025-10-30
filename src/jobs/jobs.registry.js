import logger from '#config/logger.js';
import { EmailJob } from './types/email.job.js';

class JobRegistry {
  constructor() {
    this.jobs = new Map();
    this.schemas = new Map();

    // Register default jobs
    this.register('email', EmailJob);
  }

  /**
   * Register a new job type with a job class and a schema for validation.
   * TODO: Add more job types.
   */
  register(type, JobClass, schema = null) {
    if (this.jobs.has(type)) {
      logger.warn(`Job type "${type}" is already registered, overwriting...`);
    }

    this.jobs.set(type, JobClass);
    if (schema) {
      this.schemas.set(type, schema);
    }

    logger.info(`Registered job type: ${type}`);
  }

  create(type, data, options = {}) {
    if (!this.jobs.has(type)) {
      throw new Error(`Unknown job type: "${type}"`);
    }

    const JobClass = this.jobs.get(type);
    const job = new JobClass(data, options);

    // Validate with schema if available
    const schema = this.schemas.get(type);
    if (schema) {
      const validation = schema.safeParse(data);
      if (!validation.success) {
        throw new Error(
          `Job data validation failed: ${validation.error.errors.map(e => e.message).join(', ')}`
        );
      }
    }

    return job;
  }

  // checkign if a job type is registered
  has(type) {
    return this.jobs.has(type);
  }

  getTypes() {
    return Array.from(this.jobs.keys());
  }

  getJobClass(type) {
    return this.jobs.get(type);
  }
}

// create an instance of the JobRegistry and export it.
export const jobRegistry = new JobRegistry();

export default jobRegistry;
