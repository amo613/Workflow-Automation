import { useState, useEffect } from 'react';
import FormField from '../FormField.jsx';
import VariableAutocomplete from '../../VariableAutocomplete.jsx';
import { Copy, Check } from 'lucide-react';

/**
 * Call Trigger Node Configuration
 */
export default function CallTriggerConfig({
  localData,
  handleUpdate,
  availableVariables,
  workflows,
  workflowId,
}) {
  const [copied, setCopied] = useState(false);

  // Auto-fill workflow ID if not set
  useEffect(() => {
    if (workflowId && !localData.workflow_id) {
      handleUpdate('workflow_id', parseInt(workflowId, 10));
    }
  }, [workflowId, localData.workflow_id, handleUpdate]);

  // Get ngrok URL or use window.location.origin
  const getWebhookUrl = () => {
    if (!workflowId) {
      return 'Save workflow to generate URL';
    }
    // Try to get ngrok URL from environment or use current origin
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/full-workflows/call-trigger?workflowId=${workflowId}`;
  };

  const webhookUrl = getWebhookUrl();

  const handleCopyWebhookUrl = async () => {
    if (!webhookUrl || webhookUrl === 'Save workflow to generate URL') {
      return;
    }
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy webhook URL', error);
    }
  };

  return (
    <>
      {/* Webhook URL Display */}
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
            fontWeight: 600,
            color: 'white',
            marginBottom: '0.5rem',
          }}
        >
          Twilio Webhook URL
        </div>
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              flex: 1,
              fontSize: '0.75rem',
              color: '#3b82f6',
              fontFamily: 'monospace',
              wordBreak: 'break-all',
              padding: '0.5rem',
              background: '#0a0a0a',
              borderRadius: '4px',
              border: '1px solid #333',
            }}
          >
            {webhookUrl}
          </div>
          <button
            onClick={handleCopyWebhookUrl}
            disabled={
              !webhookUrl || webhookUrl === 'Save workflow to generate URL'
            }
            style={{
              padding: '0.5rem',
              background: copied ? '#10b981' : '#3b82f6',
              border: 'none',
              color: 'white',
              borderRadius: '4px',
              cursor:
                copied ||
                (webhookUrl && webhookUrl !== 'Save workflow to generate URL')
                  ? 'pointer'
                  : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '40px',
            }}
            title="Copy webhook URL"
          >
            {copied ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
        <div
          style={{
            fontSize: '0.7rem',
            color: '#64748b',
            marginTop: '0.5rem',
          }}
        >
          Configure this URL in Twilio Console → Phone Numbers → Voice & Fax →
          "A CALL COMES IN"
        </div>
      </div>

      {/* Info Box */}
      <div
        style={{
          marginBottom: '1rem',
          padding: '1rem',
          background: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(59, 130, 246, 0.3)',
        }}
      >
        <div
          style={{
            fontSize: '0.75rem',
            color: '#94a3b8',
            lineHeight: '1.6',
          }}
        >
          <strong style={{ color: 'white' }}>Note:</strong> Configure all other
          settings (Twilio credentials, phone number, greeting, voice, etc.) in
          the Settings tab. When someone calls your Twilio phone number, this
          workflow will be triggered and the agent will greet the caller first.
        </div>
      </div>
    </>
  );
}
