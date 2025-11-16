/**
 * Webhook Trigger Node Configuration
 */
import FormField from '../FormField.jsx';

export default function WebhookTriggerConfig({
  localData,
  handleUpdate,
  workflowId,
}) {
  // Construct webhook URL
  const webhookUrl = workflowId
    ? `${window.location.origin}/api/webhooks/${workflowId}`
    : '';

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
