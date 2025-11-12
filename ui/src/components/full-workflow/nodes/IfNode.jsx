import BaseNode from './BaseNode';
import { Handle, Position } from 'reactflow';

export default function IfNode({ data, selected }) {
  return (
    <div
      style={{
        background: selected ? '#f0f4ff' : 'white',
        border: `2px solid ${selected ? '#f59e0b' : '#e2e8f0'}`,
        borderRadius: '12px',
        padding: '1rem',
        minWidth: '200px',
        boxShadow: selected
          ? '0 4px 12px #f59e0b40'
          : '0 2px 8px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.2s ease',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: '#f59e0b',
          width: '12px',
          height: '12px',
          border: '2px solid white',
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
            borderRadius: '8px',
            background: '#f59e0b20',
            color: '#f59e0b',
          }}
        >
          ❓
        </div>
        <div>
          <div
            style={{
              fontWeight: 600,
              fontSize: '0.875rem',
              color: '#1a202c',
            }}
          >
            If Condition
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

      {(data.condition1 || data.condition2) && (
        <div
          style={{
            fontSize: '0.75rem',
            color: '#64748b',
            marginTop: '0.5rem',
            padding: '0.5rem',
            background: '#f8fafc',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontWeight: 600 }}>{data.condition1 || '?'}</span>
          <span style={{ color: '#f59e0b', fontWeight: 700 }}>
            {data.operator || '=='}
          </span>
          <span style={{ fontWeight: 600 }}>{data.condition2 || '?'}</span>
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
          border: '3px solid white',
          left: '30%',
          boxShadow: '0 0 0 2px #10b981, 0 2px 8px rgba(16, 185, 129, 0.4)',
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
          border: '3px solid white',
          left: '70%',
          boxShadow: '0 0 0 2px #ef4444, 0 2px 8px rgba(239, 68, 68, 0.4)',
        }}
      />
    </div>
  );
}
