import { Handle, Position } from 'reactflow';
import { Zap } from 'lucide-react';
import StatusBadge from '@/utils/StatusBadge';

export default function HubspotTriggerNode({ data, selected }) {
  const status = data.status || 'idle';
  const statusColor = {
    running: '#3b82f6',
    success: '#10b981',
    failed: '#ef4444',
    idle: null,
  };

  const eventTypes = data.eventTypes || [];
  const eventCount = eventTypes.length;

  return (
    <div
      style={{
        background: selected ? 'hsl(var(--accent))' : 'hsl(var(--card))',
        border: `2px solid ${
          status !== 'idle'
            ? statusColor[status]
            : selected
              ? '#ff7a59'
              : 'hsl(var(--border))'
        }`,
        borderRadius: '0.75rem',
        padding: '1rem',
        minWidth: '200px',
        boxShadow: selected
          ? '0 4px 12px rgba(255, 122, 89, 0.3)'
          : '0 2px 8px rgba(0, 0, 0, 0.2)',
        transition: 'all 0.2s ease',
        position: 'relative',
      }}
    >
      <StatusBadge status={status} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.5rem',
        }}
      >
        <div
          style={{
            fontSize: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '0.5rem',
            background: 'rgba(255, 122, 89, 0.2)',
            color: '#ff7a59',
          }}
        >
          <Zap className="w-5 h-5" />
        </div>
        <div>
          <div
            style={{
              fontWeight: 600,
              fontSize: '0.875rem',
              color: 'hsl(var(--foreground))',
            }}
          >
            HubSpot Trigger
          </div>
          {eventCount > 0 && (
            <div
              style={{
                fontSize: '0.75rem',
                color: 'hsl(var(--muted-foreground))',
                marginTop: '0.25rem',
              }}
            >
              {eventCount} event{eventCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {data.description && (
        <div
          style={{
            fontSize: '0.75rem',
            color: 'hsl(var(--muted-foreground))',
            marginTop: '0.5rem',
            padding: '0.5rem',
            background: 'hsl(var(--muted))',
            borderRadius: '0.375rem',
          }}
        >
          {data.description}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: '#ff7a59',
          width: '12px',
          height: '12px',
          border: '2px solid hsl(var(--card))',
        }}
      />
    </div>
  );
}

