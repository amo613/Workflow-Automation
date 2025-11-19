import { Handle, Position } from 'reactflow';
import { PhoneIncoming, Database } from 'lucide-react';

export default function CallTriggerNode({ data, selected }) {
  const status = data.status || 'idle';
  const statusColor = {
    running: '#3b82f6',
    success: '#10b981',
    failed: '#ef4444',
    idle: null,
  };

  const hasKnowledgeBase =
    data?.knowledge_base_ids && data.knowledge_base_ids.length > 0;

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          background: selected ? 'hsl(var(--accent))' : 'hsl(var(--card))',
          border: `2px solid ${
            status !== 'idle'
              ? statusColor[status]
              : selected
                ? '#10b981'
                : 'hsl(var(--border))'
          }`,
          borderRadius: '0.75rem',
          padding: '1rem',
          minWidth: '200px',
          boxShadow: selected
            ? '0 4px 12px rgba(16, 185, 129, 0.3)'
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
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#10b981',
            }}
          >
            <PhoneIncoming className="w-5 h-5" />
          </div>
          <div>
            <div
              style={{
                fontWeight: 600,
                fontSize: '0.875rem',
                color: 'hsl(var(--foreground))',
              }}
            >
              Call Trigger
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

        {/* Only Output Handle - Trigger Nodes have no input */}
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            background: '#10b981',
            width: '12px',
            height: '12px',
            border: '2px solid hsl(var(--card))',
          }}
        />
      </div>

      {/* Knowledge Base Sub-Node */}
      {hasKnowledgeBase && (
        <div
          style={{
            position: 'absolute',
            bottom: '-40px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '0.5rem 0.75rem',
            background: 'hsl(var(--muted))',
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '0.5rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            whiteSpace: 'nowrap',
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Database className="w-3 h-3" />
          <span>{data.knowledge_base_ids.length} KB</span>
        </div>
      )}
    </div>
  );
}
