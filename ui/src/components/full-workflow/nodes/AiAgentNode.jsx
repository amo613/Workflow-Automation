import { Handle, Position } from 'reactflow';
import { Bot } from 'lucide-react';
import StatusBadge from '@/utils/StatusBadge';

export default function AiAgentNode({ data, selected }) {
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
          status !== 'idle' ? statusColor[status] : '#3b82f6'
        }`,
        borderRadius: '0.75rem',
        padding: '1.5rem',
        minWidth: '150px',
        boxShadow: selected
          ? '0 4px 12px rgba(59, 130, 246, 0.3)'
          : '0 2px 8px rgba(0, 0, 0, 0.2)',
        transition: 'all 0.2s ease',
        textAlign: 'center',
        position: 'relative',
      }}
    >
      <StatusBadge status={status} />
      <div
        style={{
          fontSize: '2rem',
          marginBottom: '0.5rem',
        }}
      >
        <Bot className="w-8 h-8" />
      </div>
      <div
        style={{
          fontWeight: 700,
          fontSize: '1rem',
          color: 'hsl(var(--foreground))',
          marginBottom: '0.25rem',
        }}
      >
        AI Agent
      </div>
      {data?.model && (
        <div
          style={{
            fontSize: '0.75rem',
            color: 'hsl(var(--muted-foreground))',
            marginTop: '0.25rem',
          }}
        >
          {data.model}
        </div>
      )}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: '#3b82f6',
          width: '12px',
          height: '12px',
          border: '2px solid hsl(var(--card))',
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: '#3b82f6',
          width: '12px',
          height: '12px',
          border: '2px solid hsl(var(--card))',
        }}
      />
    </div>
  );
}
