import { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * HubSpot Trigger Node Configuration
 */
export default function HubspotTriggerConfig({
  localData,
  handleUpdate,
  workflowId,
  hubspot,
}) {
  const [copied, setCopied] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);

  const eventTypes = localData.eventTypes || [];
  const webhookUrl = workflowId
    ? `${window.location.origin}/api/integrations/hubspot/webhook?workflowId=${workflowId}`
    : '';

  // Available HubSpot events
  const availableEvents = [
    { value: 'contact.creation', label: 'Contact Created' },
    { value: 'contact.propertyChange', label: 'Contact Property Changed' },
    { value: 'contact.deletion', label: 'Contact Deleted' },
    { value: 'company.creation', label: 'Company Created' },
    { value: 'company.propertyChange', label: 'Company Property Changed' },
    { value: 'company.deletion', label: 'Company Deleted' },
  ];

  const handleEventToggle = eventType => {
    const newEventTypes = eventTypes.includes(eventType)
      ? eventTypes.filter(e => e !== eventType)
      : [...eventTypes, eventType];
    handleUpdate('eventTypes', newEventTypes);
  };

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

  // Check subscription status when eventTypes change
  useEffect(() => {
    if (eventTypes.length > 0 && hubspot?.status?.connected) {
      // Could fetch subscriptions here to show status
      setSubscriptionStatus('pending');
    } else {
      setSubscriptionStatus(null);
    }
  }, [eventTypes, hubspot?.status?.connected]);

  return (
    <>
      {/* HubSpot Connection Status */}
      {!hubspot?.status?.connected && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '1rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
          }}
        >
          <div
            style={{
              fontSize: '0.875rem',
              color: '#ef4444',
              fontWeight: 600,
              marginBottom: '0.5rem',
            }}
          >
            HubSpot Not Connected
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: '#94a3b8',
            }}
          >
            Please connect your HubSpot account in the Settings tab before using
            this trigger.
          </div>
        </div>
      )}

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
        {webhookUrl && (
          <div style={{ marginTop: '0.5rem' }}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyWebhookUrl}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy URL
                </>
              )}
            </Button>
          </div>
        )}
        <div
          style={{
            fontSize: '0.7rem',
            color: '#64748b',
            marginTop: '0.5rem',
          }}
        >
          Configure this URL in your HubSpot app settings. HubSpot will send
          events to this endpoint.
        </div>
      </div>

      {/* Event Selection */}
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
            marginBottom: '0.75rem',
            fontWeight: 600,
          }}
        >
          Events to Listen For *
        </div>
        <div
          style={{
            fontSize: '0.75rem',
            color: '#94a3b8',
            marginBottom: '1rem',
          }}
        >
          Select one or more events to trigger this workflow
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          {availableEvents.map(event => (
            <label
              key={event.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                background: '#2a2a2a',
                borderRadius: '6px',
                border: '1px solid #333',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#ff7a59';
                e.currentTarget.style.background = '#1e293b';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#333';
                e.currentTarget.style.background = '#2a2a2a';
              }}
            >
              <input
                type="checkbox"
                checked={eventTypes.includes(event.value)}
                onChange={() => handleEventToggle(event.value)}
                disabled={!hubspot?.status?.connected}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer',
                  opacity: !hubspot?.status?.connected ? 0.5 : 1,
                }}
              />
              <span
                style={{
                  fontSize: '0.875rem',
                  color: hubspot?.status?.connected
                    ? 'hsl(var(--foreground))'
                    : '#64748b',
                  flex: 1,
                }}
              >
                {event.label}
              </span>
              <code
                style={{
                  fontSize: '0.7rem',
                  color: '#94a3b8',
                  background: '#0a0a0a',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                }}
              >
                {event.value}
              </code>
            </label>
          ))}
        </div>

        {eventTypes.length === 0 && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              background: 'rgba(250, 204, 21, 0.1)',
              border: '1px solid rgba(250, 204, 21, 0.3)',
              borderRadius: '6px',
              fontSize: '0.75rem',
              color: '#facc15',
            }}
          >
            ⚠️ Please select at least one event
          </div>
        )}

        {eventTypes.length > 0 && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '6px',
              fontSize: '0.75rem',
              color: '#10b981',
            }}
          >
            ✓ Listening to {eventTypes.length} event
            {eventTypes.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div
        style={{
          marginBottom: '1rem',
          padding: '1rem',
          background: '#1e293b',
          borderRadius: '8px',
          border: '1px solid #334155',
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
          <li>
            Configure it in your HubSpot app settings (Settings → Integrations →
            Webhooks)
          </li>
          <li>Select the events you want to listen for</li>
          <li>
            When a selected event occurs in HubSpot, this workflow will be
            triggered
          </li>
          <li>
            Event data will be available in subsequent nodes via{' '}
            <code
              style={{
                background: '#2a2a2a',
                padding: '0.1rem 0.3rem',
                borderRadius: '3px',
              }}
            >
              _hubspot
            </code>{' '}
            or directly in the output
          </li>
        </ul>
      </div>

      {/* Description */}
      <div style={{ marginBottom: '1rem' }}>
        <Label
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'hsl(var(--foreground))',
            marginBottom: '0.5rem',
            display: 'block',
          }}
        >
          Description (optional)
        </Label>
        <Input
          type="text"
          value={localData.description || ''}
          onChange={e => handleUpdate('description', e.target.value)}
          placeholder="Describe what this trigger is used for"
          style={{
            background: '#2a2a2a',
            border: '1px solid #333',
            color: 'hsl(var(--foreground))',
          }}
        />
      </div>
    </>
  );
}

