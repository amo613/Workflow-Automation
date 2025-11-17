/**
 * Webhook Trigger Node Configuration
 */
import { useState } from 'react';
import FormField from '../FormField.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SECRET_LENGTH = 48;
const SECRET_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const generateSecret = () => {
  const cryptoSource =
    (typeof window !== 'undefined' && window.crypto) ||
    (typeof globalThis !== 'undefined' && globalThis.crypto);

  if (cryptoSource?.getRandomValues) {
    const array = new Uint32Array(SECRET_LENGTH);
    cryptoSource.getRandomValues(array);
    return Array.from(array, value =>
      SECRET_ALPHABET[value % SECRET_ALPHABET.length]
    ).join('');
  }

  // Fallback (should rarely happen, e.g., SSR)
  return Array.from({ length: SECRET_LENGTH })
    .map(
      () =>
        SECRET_ALPHABET[
          Math.floor(Math.random() * SECRET_ALPHABET.length)
        ]
    )
    .join('');
};

export default function WebhookTriggerConfig({
  localData,
  handleUpdate,
  workflowId,
}) {
  const [copied, setCopied] = useState(false);

  const webhookUrl = workflowId
    ? `${window.location.origin}/api/webhooks/${workflowId}`
    : '';

  const requireSecret = Boolean(localData.requireSecret);
  const secretValue = localData.webhookSecret || '';

  const ensureSecret = () => {
    const newSecret = secretValue || generateSecret();
    handleUpdate('webhookSecret', newSecret);
    return newSecret;
  };

  const handleToggleSecret = () => {
    if (requireSecret) {
      handleUpdate('requireSecret', false);
    } else {
      const nextSecret = ensureSecret();
      handleUpdate('webhookSecret', nextSecret);
      handleUpdate('requireSecret', true);
    }
  };

  const handleGenerateSecret = () => {
    const newSecret = generateSecret();
    handleUpdate('webhookSecret', newSecret);
    if (!requireSecret) {
      handleUpdate('requireSecret', true);
    }
    setCopied(false);
  };

  const handleCopySecret = async () => {
    if (!secretValue) {
      return;
    }
    try {
      await navigator.clipboard.writeText(secretValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy webhook secret', error);
    }
  };

  return (
    <>
      <div
        style={{
          marginBottom: '1rem',
          padding: '1rem',
          background: 'hsl(var(--muted))',
          borderRadius: '8px',
          border: '1px solid #333',
        }}
      >
        <div
          style={{
            fontSize: '0.75rem',
            color: '#94a3b8',
            marginBottom: '0.5rem',
          }}
        >
          Webhook URL
        </div>
        <div
          style={{
            fontSize: '0.875rem',
            color: '#3b82f6',
            fontFamily: 'monospace',
            wordBreak: 'break-all',
            padding: '0.5rem',
            background: '#0a0a0a',
            borderRadius: '4px',
            border: '1px solid #333',
          }}
        >
          {webhookUrl || 'Save workflow to generate URL'}
        </div>
        <div
          style={{
            fontSize: '0.7rem',
            color: '#64748b',
            marginTop: '0.5rem',
          }}
        >
          Supports all HTTP methods: GET, POST, PUT, DELETE, PATCH. Request data
          (body, query params, headers) will be available as workflow input.
        </div>
      </div>

      <div
        style={{
          marginBottom: '1rem',
          padding: '1rem',
          background: 'hsl(var(--muted))',
          borderRadius: '8px',
          border: '1px solid #333',
        }}
      >
        <div
          style={{
            fontSize: '0.875rem',
            color: 'white',
            marginBottom: '0.5rem',
            fontWeight: 600,
          }}
        >
          Security
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem',
            color: '#e2e8f0',
            marginBottom: '0.75rem',
          }}
        >
          <input
            type="checkbox"
            checked={requireSecret}
            onChange={handleToggleSecret}
            style={{ width: '16px', height: '16px' }}
          />
          Require secret header for this webhook
        </label>

        {requireSecret && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <Label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Secret value
            </Label>
            <Input
              type="text"
              readOnly
              value={secretValue}
              onFocus={e => e.target.select()}
              style={{
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                background: '#0a0a0a',
                border: '1px solid #333',
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                type="button"
                variant="secondary"
                onClick={handleCopySecret}
                disabled={!secretValue}
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button type="button" variant="outline" onClick={handleGenerateSecret}>
                Regenerate
              </Button>
            </div>
            <div
              style={{
                fontSize: '0.7rem',
                color: '#94a3b8',
                lineHeight: 1.5,
              }}
            >
              Clients must send this value in the{' '}
              <code
                style={{
                  background: '#2a2a2a',
                  padding: '0.1rem 0.3rem',
                  borderRadius: '3px',
                }}
              >
                X-Workflow-Secret
              </code>{' '}
              header. Requests without a valid secret are rejected. Keep this
              value private and regenerate if it has been exposed.
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          marginBottom: '1rem',
          padding: '1rem',
          background: 'hsl(var(--muted))',
          borderRadius: '8px',
          border: '1px solid #333',
        }}
      >
        <div
          style={{
            fontSize: '0.875rem',
            color: 'white',
            marginBottom: '0.5rem',
            fontWeight: 600,
          }}
        >
          How to use:
        </div>
        <ul
          style={{
            fontSize: '0.75rem',
            color: '#94a3b8',
            margin: 0,
            paddingLeft: '1.25rem',
            lineHeight: '1.6',
          }}
        >
          <li>Copy the webhook URL above</li>
          <li>Use it in forms, external services, or API calls</li>
          <li>Supports GET, POST, PUT, DELETE, PATCH methods</li>
          <li>GET/DELETE: Query parameters → workflow input</li>
          <li>POST/PUT/PATCH: Request body → workflow input</li>
          <li>
            Headers available in{' '}
            <code
              style={{
                background: '#2a2a2a',
                padding: '0.1rem 0.3rem',
                borderRadius: '3px',
              }}
            >
              _webhook.headers
            </code>
          </li>
          <li>
            When secrets are enabled, include{' '}
            <code
              style={{
                background: '#2a2a2a',
                padding: '0.1rem 0.3rem',
                borderRadius: '3px',
              }}
            >
              X-Workflow-Secret
            </code>{' '}
            header with the exact value above.
          </li>
        </ul>
      </div>

      <FormField
        label="Description (optional)"
        name="description"
        value={localData.description || ''}
        onChange={value => handleUpdate('description', value)}
        placeholder="Describe what this webhook is used for"
        multiline
      />
    </>
  );
}
