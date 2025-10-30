import logger from '#config/logger.js';

export class BaseJob {
  constructor(data, options = {}) {
    this.data = data;
    this.options = {
      maxAttempts: options.maxAttempts || 1,
      timeout: options.timeout || 30000, // 30 seconds default
      ...options,
    };
    this.attempts = 0;
    this.status = 'pending';
    this.result = null;
    this.error = null;
    this.startedAt = null;
    this.completedAt = null;
  }

  async execute() {
    throw new Error('execute() method must be implemented by child class');
  }

  async validate() {
    return true;
  }

  async run() {
    this.attempts++;
    this.status = 'processing';
    this.startedAt = new Date();

    try {
      // Validate data
      const isValid = await this.validate(this.data);
      if (!isValid) {
        throw new Error('Job data validation failed');
      }

      // Execute with timeout
      const result = await Promise.race([
        this.execute(this.data),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Job execution timeout')),
            this.options.timeout
          )
        ),
      ]);

      this.status = 'completed';
      this.result = result;
      this.completedAt = new Date();

      logger.info(`Job ${this.constructor.name} completed successfully`, {
        attempts: this.attempts,
        duration: this.completedAt - this.startedAt,
      });

      return result;
    } catch (error) {
      this.error = {
        message: error.message,
        stack: error.stack,
        attempt: this.attempts,
      };

      // Retry logic
      if (this.attempts < this.options.maxAttempts) {
        logger.warn(
          `Job ${this.constructor.name} failed, retrying... (${this.attempts}/${this.options.maxAttempts})`,
          { error: error.message }
        );

        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, this.attempts - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));

        return this.run(); // Retry
      }

      // Max attempts reached
      this.status = 'failed';
      this.completedAt = new Date();

      logger.error(
        `Job ${this.constructor.name} failed after ${this.attempts} attempts`,
        {
          error: error.message,
          duration: this.completedAt - this.startedAt,
        }
      );

      throw error;
    }
  }

  getStatus() {
    return {
      status: this.status,
      attempts: this.attempts,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      result: this.result,
      error: this.error,
    };
  }
}

export default BaseJob;
