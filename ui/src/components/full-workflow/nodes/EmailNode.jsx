import { Handle, Position } from 'reactflow';
import { Mail } from 'lucide-react';
import StatusBadge from '@/utils/StatusBadge';
import ElectricBorder from './ElectricBorder';

export default function EmailNode({ data, selected }) {
  const status = data.status || 'idle';
  const statusColor = {
    running: '#3b82f6',
    success: '#10b981',
    failed: '#ef4444',
    idle: null,
  };

  // Chaos: 0.1 for idle, 0.5 for running
  const chaos = status === 'running' ? 0.6 : 0.3;
  const nodeColor = '#8b5cf6';

  return (
    <ElectricBorder
      color={nodeColor}
      chaos={chaos}
      speed={1}
      thickness={2}
      style={{ borderRadius: '0.75rem' }}
    >
      <div
        style={{
          background: selected ? 'hsl(var(--accent))' : 'hsl(var(--card))',
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

        <Handle
          type="target"
          position={Position.Top}
          style={{
            background: '#8b5cf6',
            width: '12px',
            height: '12px',
            border: '2px solid hsl(var(--card))',
          }}
        />

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
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div
              style={{
                fontWeight: 600,
                fontSize: '0.875rem',
                color: 'hsl(var(--foreground))',
              }}
            >
              Email
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

        {data.to && (
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
            To: {data.to}
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
    </ElectricBorder>
  );
}
