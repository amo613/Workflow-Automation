import { Handle, Position } from 'reactflow';

export default function EmailNode({ data, selected }) {
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
        background: selected
          ? 'hsl(var(--accent))'
          : 'hsl(var(--card))',
        border: `2px solid ${
          status !== 'idle' ? statusColor[status] : selected ? '#8b5cf6' : 'hsl(var(--border))'
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
      {status !== 'idle' && (
        <div
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: statusColor[status],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            zIndex: 10,
          }}
        >
          {status === 'running' ? '⏳' : status === 'success' ? '✅' : '❌'}
        </div>
      )}

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
          📧
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
  );
}
