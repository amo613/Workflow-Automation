import nodemailer from 'nodemailer';
import { BaseJob } from './base.job.js';
import logger from '#config/logger.js';
import { ACCOUNT_EMAIL, EMAIL_PASSWORD } from '#config/env.js';

const accountEmail = ACCOUNT_EMAIL;
// Create transporter (singleton pattern)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: accountEmail,
    pass: EMAIL_PASSWORD,
  },
});

/**
 * Email Job Executor
 * Sends emails using nodemailer
 * Supports both single email and bulk email sending
 */
export class EmailJob extends BaseJob {
  constructor(data, options = {}) {
    super(data, {
      maxAttempts: 3, // Retry email up to 3 times
      timeout: 30000, // 30 seconds timeout
      ...options,
    });
  }

  /**
   * Validate email job data
   * @param {Object} data - Email job data
   * @returns {Promise<boolean>} true if valid
   */
  async validate(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Email data must be an object');
    }

    // Support both single email string and array of emails
    if (!data.to) {
      throw new Error('Email "to" field is required');
    }

    if (typeof data.to !== 'string' && !Array.isArray(data.to)) {
      throw new Error(
        'Email "to" field must be a string or an array of strings'
      );
    }

    if (Array.isArray(data.to) && data.to.length === 0) {
      throw new Error(
        'Email "to" array must contain at least one email address'
      );
    }

    if (!data.subject || typeof data.subject !== 'string') {
      throw new Error('Email "subject" field is required and must be a string');
    }

    if (!data.html && !data.text) {
      throw new Error('Email must have either "html" or "text" field');
    }

    return true;
  }

  async execute(data) {
    const { to, subject, html, text } = data;

    // Normalize to array - support both single email and array of emails
    const recipients = Array.isArray(to) ? to : [to];

    const results = [];
    const errors = [];

    // Send email to each recipient
    for (const recipient of recipients) {
      try {
        const mailOptions = {
          from: accountEmail,
          to: recipient,
          subject,
          ...(html && { html }),
          ...(text && { text }),
        };

        const info = await transporter.sendMail(mailOptions);

        logger.info('Email sent successfully', {
          to: recipient,
          subject,
          messageId: info.messageId,
        });

        results.push({
          to: recipient,
          success: true,
          messageId: info.messageId,
          response: info.response,
          accepted: info.accepted,
          rejected: info.rejected,
        });
      } catch (error) {
        logger.error('Error sending email', {
          to: recipient,
          subject,
          error: error.message,
        });

        errors.push({
          to: recipient,
          success: false,
          error: error.message,
        });
      }
    }

    // Return summary results
    const total = recipients.length;
    const successful = results.length;
    const failed = errors.length;

    return {
      success: errors.length === 0, // Only successful if all emails were sent
      total,
      successful,
      failed,
      results, // Array of successful sends
      errors, // Array of failed sends
    };
  }
}

export default EmailJob;
