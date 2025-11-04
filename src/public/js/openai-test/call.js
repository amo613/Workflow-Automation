/**
 * Phone Call Module
 * Handles outbound phone calls via Twilio
 */

export class CallManager {
  constructor(logFn, getConfigFromForm) {
    this.logFn = logFn;
    this.getConfigFromForm = getConfigFromForm;
  }
  //HUGEDEMUGEDE
  async makeCall(phoneNumberInput) {
    const phoneInput = phoneNumberInput.value.trim();

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

    const callBtn = document.getElementById('callBtn');
    try {
      if (callBtn) {
        callBtn.disabled = true;
        callBtn.textContent = isBulk
          ? `Creating job for ${phoneNumbers.length} numbers...`
          : 'Creating job...';
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

      const response = await fetch('/api/test-openai/call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toNumber,
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
      if (callBtn) {
        callBtn.disabled = false;
        callBtn.textContent = 'Make Call';
      }
    }
  }

  setupCallSection() {
    const phoneNumberInput = document.getElementById('phoneNumber');
    const callBtn = document.getElementById('callBtn');

    if (callBtn) {
      callBtn.addEventListener('click', () => {
        if (phoneNumberInput) {
          this.makeCall(phoneNumberInput);
        }
      });
    }

    // Allow Enter key to trigger call
    if (phoneNumberInput) {
      phoneNumberInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
          this.makeCall(phoneNumberInput);
        }
      });
    }

    // Show/hide Twilio call section toggle
    const showTwilioToggle = document.createElement('button');
    showTwilioToggle.className = 'btn-connect';
    showTwilioToggle.style.marginTop = '20px';
    showTwilioToggle.style.background = '#6c757d';
    showTwilioToggle.textContent = '📞 Show Twilio Call Section';
    showTwilioToggle.addEventListener('click', () => {
      const callSection = document.getElementById('callSection');
      if (callSection) {
        callSection.style.display =
          callSection.style.display === 'none' ? 'block' : 'none';
        showTwilioToggle.textContent =
          callSection.style.display === 'none'
            ? '📞 Show Twilio Call Section'
            : '📞 Hide Twilio Call Section';
      }
    });
    const container = document.querySelector('.container');
    if (container) {
      container.appendChild(showTwilioToggle);
    }
  }
}
