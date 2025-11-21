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
    return Array.from(
      array,
      value => SECRET_ALPHABET[value % SECRET_ALPHABET.length]
    ).join('');
  }

  // Fallback (should rarely happen, e.g., SSR)
  return Array.from({ length: SECRET_LENGTH })
    .map(
      () => SECRET_ALPHABET[Math.floor(Math.random() * SECRET_ALPHABET.length)]
    )
    .join('');
};

export default function WebhookTriggerConfig({
  localData,
  handleUpdate,
  workflowId,
}) {
  const [copied, setCopied] = useState(false);
  const [copiedBasicAuth, setCopiedBasicAuth] = useState(false);

  // Determine webhook URL (custom path or default)
  // Important: check for null/undefined explicitly, not just falsy, to allow empty string
  const customPath =
    localData.customPath !== undefined && localData.customPath !== null
      ? localData.customPath
      : null;
  // useCustomPath is true if customPath exists (even if empty string, meaning toggle is on)
  const useCustomPath = customPath !== null && customPath !== undefined;
  const webhookId = workflowId || localData.webhookId || '';
  const webhookUrl = workflowId
    ? useCustomPath && customPath && customPath.trim() !== ''
      ? `${window.location.origin}${customPath}`
      : `${window.location.origin}/api/webhooks/${webhookId}`
    : '';

  const requireSecret = Boolean(localData.requireSecret);
  const secretValue = localData.webhookSecret || '';

  // Basic Auth
  const requireBasicAuth = Boolean(localData.requireBasicAuth);
  const basicAuthUsername = localData.basicAuthUsername || '';
  const basicAuthPassword = localData.basicAuthPassword || '';

  // Rate Limiting
  const rateLimit = localData.rateLimit || {};
  const customRateLimit = rateLimit.custom || { enabled: false };
  const arcjetRateLimit = rateLimit.arcjet || { enabled: false };

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

  const handleToggleBasicAuth = () => {
    if (requireBasicAuth) {
      handleUpdate('requireBasicAuth', false);
      handleUpdate('basicAuthUsername', '');
      handleUpdate('basicAuthPassword', '');
    } else {
      handleUpdate('requireBasicAuth', true);
      if (!basicAuthUsername) {
        handleUpdate('basicAuthUsername', '');
      }
      if (!basicAuthPassword) {
        handleUpdate('basicAuthPassword', '');
      }
    }
  };

  const handleCopyBasicAuth = async () => {
    if (!basicAuthUsername || !basicAuthPassword) {
      return;
    }
    const basicAuthString = btoa(`${basicAuthUsername}:${basicAuthPassword}`);
    try {
      await navigator.clipboard.writeText(basicAuthString);
      setCopiedBasicAuth(true);
      setTimeout(() => setCopiedBasicAuth(false), 2000);
    } catch (error) {
      console.error('Failed to copy Basic Auth', error);
    }
  };

  const handleToggleCustomPath = e => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    console.log('Toggle custom path clicked', {
      useCustomPath,
      currentCustomPath: customPath,
    });

    if (useCustomPath) {
      // Disable: set to null
      console.log('Disabling custom path');
      handleUpdate('customPath', null);
    } else {
      // Enable: set to empty string (will be normalized when user types)
      console.log('Enabling custom path');
      handleUpdate('customPath', '');
    }
  };

  const handleCustomPathChange = value => {
    // Validation: no spaces, allow alphanumeric, /, -, _
    if (value === '') {
      // Keep as empty string to maintain toggle state
      handleUpdate('customPath', '');
      return;
    }

    // Remove spaces and validate characters
    const cleaned = value.replace(/\s/g, '');
    const validPattern = /^[a-zA-Z0-9\/\-_]+$/;

    if (validPattern.test(cleaned)) {
      // Normalize: ensure it starts with /api/custom/
      let normalizedPath = cleaned;
      if (!normalizedPath.startsWith('/api/custom/')) {
        if (normalizedPath.startsWith('/api/custom')) {
          normalizedPath =
            '/api/custom' +
            (normalizedPath === '/api/custom'
              ? '/'
              : normalizedPath.substring('/api/custom'.length));
        } else if (normalizedPath.startsWith('/')) {
          normalizedPath = '/api/custom' + normalizedPath;
        } else {
          normalizedPath = '/api/custom/' + normalizedPath;
        }
      }
      handleUpdate('customPath', normalizedPath);
    }
  };

  const handleToggleCustomRateLimit = () => {
    handleUpdate('rateLimit', {
      ...rateLimit,
      custom: {
        ...customRateLimit,
        enabled: !customRateLimit.enabled,
        requestsPerMinute: customRateLimit.requestsPerMinute || 100,
        windowMinutes: customRateLimit.windowMinutes || 1,
      },
    });
  };

  const handleToggleArcjetRateLimit = () => {
    handleUpdate('rateLimit', {
      ...rateLimit,
      arcjet: {
        ...arcjetRateLimit,
        enabled: !arcjetRateLimit.enabled,
        botDetection: arcjetRateLimit.botDetection !== false,
        shield: arcjetRateLimit.shield !== false,
      },
    });
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
        {webhookUrl && (
          <div style={{ marginTop: '0.5rem' }}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(webhookUrl);
                  // Could add toast notification here
                } catch (error) {
                  console.error('Failed to copy webhook URL', error);
                }
              }}
            >
              Copy URL
            </Button>
          </div>
        )}
      </div>

      {/* Custom Path */}
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
          Custom Path
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
            checked={useCustomPath}
            onChange={handleToggleCustomPath}
            style={{ width: '16px', height: '16px' }}
          />
          Use custom path
        </label>
        {useCustomPath && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <Label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Custom Path
            </Label>
            <Input
              type="text"
              value={customPath ? customPath.replace('/api/custom/', '') : ''}
              onChange={e => handleCustomPathChange(e.target.value)}
              placeholder="my-endpoint"
              style={{
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                background: '#0a0a0a',
                border: '1px solid #333',
              }}
            />
            <div
              style={{
                fontSize: '0.7rem',
                color: '#94a3b8',
                lineHeight: 1.5,
              }}
            >
              Enter path after{' '}
              <code
                style={{
                  background: '#2a2a2a',
                  padding: '0.1rem 0.3rem',
                  borderRadius: '3px',
                }}
              >
                /api/custom/
              </code>
              . Will be automatically prefixed. Only alphanumeric,{' '}
              <code
                style={{
                  background: '#2a2a2a',
                  padding: '0.1rem 0.3rem',
                  borderRadius: '3px',
                }}
              >
                -
              </code>
              ,{' '}
              <code
                style={{
                  background: '#2a2a2a',
                  padding: '0.1rem 0.3rem',
                  borderRadius: '3px',
                }}
              >
                _
              </code>{' '}
              allowed.
            </div>
            {customPath && (
              <div
                style={{
                  fontSize: '0.7rem',
                  color: '#3b82f6',
                  fontFamily: 'monospace',
                  padding: '0.5rem',
                  background: '#0a0a0a',
                  borderRadius: '4px',
                  border: '1px solid #333',
                  marginTop: '0.25rem',
                }}
              >
                Full path: {customPath}
              </div>
            )}
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
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerateSecret}
              >
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

      {/* Basic Authentication */}
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
          Basic Authentication
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
            checked={requireBasicAuth}
            onChange={handleToggleBasicAuth}
            style={{ width: '16px', height: '16px' }}
          />
          Require Basic Authentication
        </label>
        {requireBasicAuth && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div
              style={{
                fontSize: '0.7rem',
                color: '#facc15',
                background: 'rgba(250, 204, 21, 0.12)',
                border: '1px solid rgba(250, 204, 21, 0.35)',
                borderRadius: '0.375rem',
                padding: '0.5rem',
                marginBottom: '0.5rem',
              }}
            >
              ⚠️ Username and password will be stored in the workflow
              configuration.
            </div>
            <Label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Username
            </Label>
            <Input
              type="text"
              value={basicAuthUsername}
              onChange={e => handleUpdate('basicAuthUsername', e.target.value)}
              placeholder="webhook-user"
              style={{
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                background: '#0a0a0a',
                border: '1px solid #333',
              }}
            />
            <Label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Password
            </Label>
            <Input
              type="password"
              value={basicAuthPassword}
              onChange={e => handleUpdate('basicAuthPassword', e.target.value)}
              placeholder="secure-password"
              style={{
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                background: '#0a0a0a',
                border: '1px solid #333',
              }}
            />
            {basicAuthUsername && basicAuthPassword && (
              <div
                style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}
              >
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyBasicAuth}
                >
                  {copiedBasicAuth ? 'Copied!' : 'Copy Base64'}
                </Button>
              </div>
            )}
            <div
              style={{
                fontSize: '0.7rem',
                color: '#94a3b8',
                lineHeight: 1.5,
              }}
            >
              Clients must send:{' '}
              <code
                style={{
                  background: '#2a2a2a',
                  padding: '0.1rem 0.3rem',
                  borderRadius: '3px',
                }}
              >
                Authorization: Basic base64(username:password)
              </code>
            </div>
          </div>
        )}
      </div>

      {/* Rate Limiting */}
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
          Rate Limiting
        </div>

        {/* Custom Rate Limiting */}
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
            checked={customRateLimit.enabled || false}
            onChange={handleToggleCustomRateLimit}
            style={{ width: '16px', height: '16px' }}
          />
          Enable Custom Rate Limiting
        </label>
        {customRateLimit.enabled && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              marginBottom: '1rem',
              paddingLeft: '1.5rem',
            }}
          >
            <div
              style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
            >
              <Label
                style={{
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                  minWidth: '140px',
                }}
              >
                Requests per minute:
              </Label>
              <Input
                type="number"
                value={customRateLimit.requestsPerMinute || 100}
                onChange={e =>
                  handleUpdate('rateLimit', {
                    ...rateLimit,
                    custom: {
                      ...customRateLimit,
                      requestsPerMinute: parseInt(e.target.value, 10) || 100,
                    },
                  })
                }
                min="1"
                style={{
                  width: '100px',
                  fontSize: '0.85rem',
                  background: '#0a0a0a',
                  border: '1px solid #333',
                }}
              />
            </div>
            <div
              style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
            >
              <Label
                style={{
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                  minWidth: '140px',
                }}
              >
                Window (minutes):
              </Label>
              <Input
                type="number"
                value={customRateLimit.windowMinutes || 1}
                onChange={e =>
                  handleUpdate('rateLimit', {
                    ...rateLimit,
                    custom: {
                      ...customRateLimit,
                      windowMinutes: parseInt(e.target.value, 10) || 1,
                    },
                  })
                }
                min="1"
                style={{
                  width: '100px',
                  fontSize: '0.85rem',
                  background: '#0a0a0a',
                  border: '1px solid #333',
                }}
              />
            </div>
            <div
              style={{
                fontSize: '0.7rem',
                color: '#94a3b8',
                lineHeight: 1.5,
              }}
            >
              Max. {customRateLimit.requestsPerMinute || 100} requests per{' '}
              {customRateLimit.windowMinutes || 1} minute(s)
            </div>
          </div>
        )}

        {/* Arcjet Protection */}
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
            checked={arcjetRateLimit.enabled || false}
            onChange={handleToggleArcjetRateLimit}
            style={{ width: '16px', height: '16px' }}
          />
          Enable Arcjet Protection
        </label>
        {arcjetRateLimit.enabled && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              paddingLeft: '1.5rem',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                color: '#e2e8f0',
              }}
            >
              <input
                type="checkbox"
                checked={arcjetRateLimit.botDetection !== false}
                onChange={e =>
                  handleUpdate('rateLimit', {
                    ...rateLimit,
                    arcjet: {
                      ...arcjetRateLimit,
                      botDetection: e.target.checked,
                    },
                  })
                }
                style={{ width: '14px', height: '14px' }}
              />
              Bot Detection
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                color: '#e2e8f0',
              }}
            >
              <input
                type="checkbox"
                checked={arcjetRateLimit.shield !== false}
                onChange={e =>
                  handleUpdate('rateLimit', {
                    ...rateLimit,
                    arcjet: {
                      ...arcjetRateLimit,
                      shield: e.target.checked,
                    },
                  })
                }
                style={{ width: '14px', height: '14px' }}
              />
              Shield Protection
            </label>
            <div
              style={{
                fontSize: '0.7rem',
                color: '#94a3b8',
                lineHeight: 1.5,
                marginTop: '0.25rem',
              }}
            >
              Additional bot detection and security protection
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
          {requireBasicAuth && (
            <li>
              When Basic Auth is enabled, include{' '}
              <code
                style={{
                  background: '#2a2a2a',
                  padding: '0.1rem 0.3rem',
                  borderRadius: '3px',
                }}
              >
                Authorization: Basic base64(username:password)
              </code>{' '}
              header.
            </li>
          )}
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
