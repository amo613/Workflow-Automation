/**
 * Phone Call Module
 * Handles outbound phone calls via Twilio
 * React-compatible: No DOM manipulation, uses callbacks
 */

import { fetchWithCSRF } from '../../utils/csrf.utils.js';

export class CallManager {
  constructor(logFn, getConfigFromForm, onCallStateChange) {
    this.logFn = logFn;
    this.getConfigFromForm = getConfigFromForm;
    this.onCallStateChange = onCallStateChange; // Callback: (isCalling, buttonText) => void
  }

  async makeCall(phoneNumber) {
    const phoneInput = phoneNumber.trim();

    if (!phoneInput) {
      this.logFn('❌ Please enter a phone number', 'error');
      return;
    }

    // Parse phone numbers - support comma-separated values for bulk calls
    const phoneNumbers = phoneInput
      .split(',')
      .map(num => num.trim())
      .filter(num => num.length > 0);

    if (phoneNumbers.length === 0) {
      this.logFn('❌ Please enter at least one phone number', 'error');
      return;
    }

    // Validate E.164 format for all numbers
    const invalidNumbers = phoneNumbers.filter(num => !num.startsWith('+'));
    if (invalidNumbers.length > 0) {
      this.logFn(
        `❌ Phone numbers must be in E.164 format (e.g. +1234567890). Invalid: ${invalidNumbers.join(', ')}`,
        'error'
      );
      return;
    }

    // Determine if this is a single call or bulk call
    const isBulk = phoneNumbers.length > 1;
    const toNumber = isBulk ? phoneNumbers : phoneNumbers[0];

    try {
      if (this.onCallStateChange) {
        this.onCallStateChange(
          true,
          isBulk
            ? `Creating job for ${phoneNumbers.length} numbers...`
            : 'Creating job...'
        );
      }

      if (isBulk) {
        this.logFn(
          `🔄 Creating phone call job for ${phoneNumbers.length} numbers...`,
          'info'
        );
        this.logFn(`📞 Numbers: ${phoneNumbers.join(', ')}`, 'info');
      } else {
        this.logFn(`🔄 Creating phone call job for ${toNumber}...`, 'info');
      }

      // Get config from form
      const config = this.getConfigFromForm();

      // Extract fromNumber from config if present
      const fromNumber =
        config?.fromNumber || config?.from_phone_number || null;

      const response = await fetchWithCSRF('/api/test-openai/call', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toNumber,
          fromNumber, // Send fromNumber separately
          config: { ...config, provider: 'openai' },
        }),
      });

      const data = await response.json();

      if (response.ok) {
        this.logFn(`✅ Phone call job created successfully!`, 'success');
        // Support both jobId (top level) and job.id (nested) for compatibility
        const jobId = data.jobId || data.job?.id;
        if (jobId) {
          this.logFn(`📋 Job ID: ${jobId}`, 'info');
          this.logFn(`💡 Track job status at /api/jobs/${jobId}`, 'info');
        } else {
          this.logFn(`⚠️ Job created but ID not available`, 'warning');
          console.warn('Job response:', data);
        }
        if (isBulk) {
          this.logFn(
            `📞 Calling ${phoneNumbers.length} number(s) via job queue`,
            'info'
          );
        } else {
          this.logFn(`📞 Calling ${toNumber} via job queue`, 'info');
        }
      } else {
        this.logFn(
          `❌ Failed to create call job: ${data.error || data.message}`,
          'error'
        );
      }
    } catch (error) {
      this.logFn(`❌ Error making call: ${error.message}`, 'error');
      console.error('Call error:', error);
    } finally {
      if (this.onCallStateChange) {
        this.onCallStateChange(false, 'Make Call');
      }
    }
  }
}
