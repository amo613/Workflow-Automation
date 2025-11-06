import logger from '#config/logger.js';
import { InternalFunctionName } from './types.js';
import { createJob } from '#services/jobs.service.js';
import { ACCOUNT_EMAIL, EMAIL_PASSWORD } from '#config/env.js';

/**
 * Handle Email Tool Calls from OpenAI
 * @param {Object} toolCall - Tool call from OpenAI
 * @param {Object} context - Context with UI config, userId, and logger
 * @returns {Promise<{output: string}>} Tool call result
 */
export async function handleEmailToolCall(toolCall, context) {
  const name = toolCall.name;
  const argsString = toolCall.arguments || toolCall.function?.arguments || '{}';
  let args;
  try {
    args = typeof argsString === 'string' ? JSON.parse(argsString) : argsString;
  } catch (e) {
    logger.error('Failed to parse email tool arguments', e);
    args = {};
  }

  const { uiConfig, userId, logger: sessionLogger } = context;

  if (name !== InternalFunctionName.EMAIL_SEND) {
    throw new Error(`Unknown email tool: ${name}`);
  }

  // Validate required fields
  if (
    !Array.isArray(args.to) ||
    !args.to.length ||
    !args.subject ||
    !args.html
  ) {
    return {
      output: JSON.stringify({
        success: false,
        error:
          'Missing required fields: to[], subject, html. Please provide them and try again.',
      }),
    };
  }

  // Use UI-provided credentials if available, otherwise fall back to ENV vars
  const accountEmail = uiConfig?.accountEmail || ACCOUNT_EMAIL;
  const emailPassword = uiConfig?.emailPassword || EMAIL_PASSWORD;

  if (!accountEmail || !emailPassword) {
    sessionLogger.error('Email credentials not configured');
    return {
      output: JSON.stringify({
        success: false,
        error:
          'Email credentials not configured. Please provide accountEmail and emailPassword.',
      }),
    };
  }

  try {
    // Create email job with UI credentials or ENV defaults
    const job = await createJob(
      'email',
      {
        to: args.to,
        subject: args.subject,
        html: args.html,
        accountEmail, // Pass credentials to job
        emailPassword,
      },
      {}, // options default (maxAttempts, timeout, priority)
      userId || null
    );

    sessionLogger.info(`✅ Email job created: ${job.id}`, {
      to: args.to,
      subject: args.subject,
      jobId: job.id,
    });

    return {
      output: JSON.stringify({
        success: true,
        data: {
          jobId: job?.id || null,
          to: args.to,
          subject: args.subject,
          status: 'queued',
        },
      }),
    };
  } catch (error) {
    sessionLogger.error('Error creating email job from tool:', error);
    return {
      output: JSON.stringify({
        success: false,
        error: error.message || 'Failed to create email job',
      }),
    };
  }
}
