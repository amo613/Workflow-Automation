import { Handle, Position } from 'reactflow';
import { HelpCircle } from 'lucide-react';
import StatusBadge from '@/utils/StatusBadge';
import ElectricBorder from './ElectricBorder';

export default function IfNode({ data, selected }) {
  const status = data.status || 'idle';
  const statusColor = {
    running: '#3b82f6',
    success: '#10b981',
    failed: '#ef4444',
    idle: null,
  };

  // Chaos: 0.1 for idle, 0.5 for running
  const chaos = status === 'running' ? 0.6 : 0.3;
  const nodeColor = '#f59e0b';

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
            ? '0 4px 12px rgba(245, 158, 11, 0.3)'
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
            background: '#f59e0b',
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
              background: 'rgba(245, 158, 11, 0.2)',
              color: '#f59e0b',
            }}
          >
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <div
              style={{
                fontWeight: 600,
                fontSize: '0.875rem',
                color: 'hsl(var(--foreground))',
              }}
            >
              If Condition
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

        {(data.condition1 || data.condition2) && (
          <div
            style={{
              fontSize: '0.75rem',
              color: 'hsl(var(--muted-foreground))',
              marginTop: '0.5rem',
              padding: '0.5rem',
              background: 'hsl(var(--muted))',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              {data.condition1 || '?'}
            </span>
            <span style={{ color: '#f59e0b', fontWeight: 700 }}>
              {data.operator || '=='}
            </span>
            <span style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              {data.condition2 || '?'}
            </span>
          </div>
        )}

        <Handle
          type="source"
          position={Position.Bottom}
          id="true"
          style={{
            background: '#10b981',
            width: '16px',
            height: '16px',
            border: '3px solid hsl(var(--card))',
            left: '30%',
            boxShadow:
              '0 0 0 2px rgba(16, 185, 129, 0.2), 0 2px 8px rgba(16, 185, 129, 0.4)',
          }}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="false"
          style={{
            background: '#ef4444',
            width: '16px',
            height: '16px',
            border: '3px solid hsl(var(--card))',
            left: '70%',
            boxShadow:
              '0 0 0 2px rgba(239, 68, 68, 0.2), 0 2px 8px rgba(239, 68, 68, 0.4)',
          }}
        />
      </div>
    </ElectricBorder>
  );
}
