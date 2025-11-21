import { Handle, Position } from 'reactflow';
import { Link } from 'lucide-react';
import StatusBadge from '@/utils/StatusBadge';

export default function WebhookTriggerNode({ data, selected }) {
  const status = data.status || 'idle';
  const statusColor = {
    running: '#3b82f6',
    success: '#10b981',
    failed: '#ef4444',
    idle: null,
  };

  return (
    <div
      style={{
        background: selected ? 'hsl(var(--accent))' : 'hsl(var(--card))',
        border: `2px solid ${
          status !== 'idle'
            ? statusColor[status]
            : selected
              ? '#8b5cf6'
              : 'hsl(var(--border))'
        }`,
        borderRadius: '0.75rem',
        padding: '1rem',
        minWidth: '200px',
        boxShadow: selected
          ? '0 4px 12px rgba(139, 92, 246, 0.3)'
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
            background: 'rgba(139, 92, 246, 0.2)',
            color: '#8b5cf6',
          }}
        >
          <Link className="w-5 h-5" />
        </div>
        <div>
          <div
            style={{
              fontWeight: 600,
              fontSize: '0.875rem',
              color: 'hsl(var(--foreground))',
            }}
          >
            Webhook Trigger
          </div>
          {data.name && (
            <div
              style={{
                fontSize: '0.75rem',
                color: 'hsl(var(--muted-foreground))',
                marginTop: '0.25rem',
              }}
            >
              {data.name}
            </div>
          )}
        </div>
      </div>

      {data.requireSecret && (
        <div
          style={{
            marginTop: '0.5rem',
            fontSize: '0.7rem',
            color: '#facc15',
            background: 'rgba(250, 204, 21, 0.12)',
            border: '1px solid rgba(250, 204, 21, 0.35)',
            borderRadius: '0.375rem',
            padding: '0.35rem 0.5rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <span style={{ fontSize: '0.85rem' }}>🔒</span>
          Secret required
        </div>
      )}

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
          background: '#8b5cf6',
          width: '12px',
          height: '12px',
          border: '2px solid hsl(var(--card))',
        }}
      />
    </div>
  );
}
