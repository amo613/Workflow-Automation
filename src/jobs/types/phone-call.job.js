import { BaseJob } from './base.job.js';
import logger from '#config/logger.js';
import twilioService from '#services/twilio.service.js';

export class PhoneCallJob extends BaseJob {
  constructor(data, options = {}) {
    super(data, {
      maxAttempts: 3,
      timeout: 60000,
      ...options,
    });
  }

  async validate(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Phone call data must be an object');
    }

    if (!data.toNumber) {
      throw new Error('Phone call "toNumber" field is required');
    }

    if (typeof data.toNumber === 'string') {
      if (!data.toNumber.trim()) {
        throw new Error('Phone call "toNumber" must be a non-empty string');
      }
      if (!data.toNumber.startsWith('+')) {
        throw new Error(
          'Phone number must be in E.164 format (e.g. +1234567890)'
        );
      }
    } else if (Array.isArray(data.toNumber)) {
      if (data.toNumber.length === 0) {
        throw new Error(
          'Phone call "toNumber" array must contain at least one phone number'
        );
      }
      for (const number of data.toNumber) {
        if (typeof number !== 'string' || !number.trim()) {
          throw new Error('All phone numbers must be non-empty strings');
        }
        if (!number.startsWith('+')) {
          throw new Error(
            `Phone number "${number}" must be in E.164 format (e.g. +1234567890)`
          );
        }
      }
    } else {
      throw new Error(
        'Phone call "toNumber" must be a string or an array of strings'
      );
    }

    if (data.config && typeof data.config !== 'object') {
      throw new Error('Phone call "config" must be an object');
    }

    return true;
  }

  async execute(data) {
    const { toNumber, config } = data;

    logger.info(`📞 Phone call job executing:`, {
      hasConfig: !!config,
      toNumber: Array.isArray(toNumber)
        ? `${toNumber.length} numbers`
        : toNumber,
      dataKeys: Object.keys(data),
    });

    const targetNumbers = Array.isArray(toNumber) ? toNumber : [toNumber];

    if (targetNumbers.length === 0) {
      throw new Error('No phone numbers provided');
    }

    const results = [];
    const errors = [];

    for (const targetNumber of targetNumbers) {
      try {
        logger.info(`📞 Making outbound call:`, {
          to: targetNumber,
          hasConfig: !!config,
          configKeys: config ? Object.keys(config) : [],
        });

        const callResult = await twilioService.makeOutboundCall(
          targetNumber,
          config
        );

        if (callResult.success) {
          logger.info('Phone call initiated successfully', {
            to: targetNumber,
            callSid: callResult.callSid,
          });

          results.push({
            toNumber: targetNumber,
            success: true,
            callSid: callResult.callSid,
            status: callResult.status,
          });
        } else {
          logger.error('Failed to initiate phone call', {
            to: targetNumber,
            error: callResult.error,
          });

          errors.push({
            toNumber: targetNumber,
            success: false,
            error: callResult.error,
          });
        }
      } catch (error) {
        logger.error('Error making phone call', {
          to: targetNumber,
          error: error.message,
        });

        errors.push({
          toNumber: targetNumber,
          success: false,
          error: error.message,
        });
      }
    }

    const total = targetNumbers.length;
    const successful = results.length;
    const failed = errors.length;

    return {
      success: errors.length === 0,
      total,
      successful,
      failed,
      results,
      errors,
    };
  }
}

export default PhoneCallJob;
