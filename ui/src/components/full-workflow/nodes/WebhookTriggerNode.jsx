import BaseNode from './BaseNode';
import { Handle, Position } from 'reactflow';

export default function WebhookTriggerNode({ data, selected }) {
  return (
    <div
      style={{
        background: selected ? '#f0f4ff' : 'white',
        border: `2px solid ${
          data.status === 'running'
            ? '#3b82f6'
            : data.status === 'success'
              ? '#10b981'
              : data.status === 'failed'
                ? '#ef4444'
                : selected
                  ? '#8b5cf6'
                  : '#e2e8f0'
        }`,
        borderRadius: '12px',
        padding: '1rem',
        minWidth: '200px',
        boxShadow: selected
          ? '0 4px 12px rgba(139, 92, 246, 0.4)'
          : '0 2px 8px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.2s ease',
        position: 'relative',
      }}
    >
      {/* Status Badge */}
      {data.status && data.status !== 'idle' && (
        <div
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background:
              data.status === 'running'
                ? '#3b82f6'
                : data.status === 'success'
                  ? '#10b981'
                  : '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            zIndex: 10,
          }}
        >
          {data.status === 'running'
            ? '⏳'
            : data.status === 'success'
              ? '✅'
              : '❌'}
        </div>
      )}

      {/* No Input Handle - Triggers don't have inputs */}

      {/* Node Header */}
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
            borderRadius: '8px',
            background: '#8b5cf620',
            color: '#8b5cf6',
          }}
        >
          🔗
        </div>
        <div>
          <div
            style={{
              fontWeight: 600,
              fontSize: '0.875rem',
              color: '#1a202c',
            }}
          >
            Webhook Trigger
          </div>
          {data.name && (
            <div
              style={{
                fontSize: '0.75rem',
                color: '#64748b',
                marginTop: '0.25rem',
              }}
            >
              {data.name}
            </div>
          )}
        </div>
      </div>

      {/* Node Content */}
      {data.description && (
        <div
          style={{
            fontSize: '0.75rem',
            color: '#64748b',
            marginTop: '0.5rem',
            padding: '0.5rem',
            background: '#f8fafc',
            borderRadius: '6px',
          }}
        >
          {data.description}
        </div>
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: '#8b5cf6',
          width: '12px',
          height: '12px',
          border: '2px solid white',
        }}
      />
    </div>
  );
}
