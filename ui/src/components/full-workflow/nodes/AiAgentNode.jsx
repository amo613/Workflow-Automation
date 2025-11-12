import { Handle, Position } from 'reactflow';

export default function AiAgentNode({ data, selected }) {
  return (
    <div
      style={{
        background: selected ? '#f0f9ff' : 'white',
        border: `2px solid ${selected ? '#3b82f6' : '#3b82f6'}`,
        borderRadius: '12px',
        padding: '1.5rem',
        minWidth: '150px',
        boxShadow: selected
          ? '0 4px 12px #3b82f640'
          : '0 2px 8px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.2s ease',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: '2rem',
          marginBottom: '0.5rem',
        }}
      >
        🤖
      </div>
      <div
        style={{
          fontWeight: 700,
          fontSize: '1rem',
          color: '#1a202c',
          marginBottom: '0.25rem',
        }}
      >
        AI Agent
      </div>
      {data?.model && (
        <div
          style={{
            fontSize: '0.75rem',
            color: '#64748b',
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
          border: '2px solid white',
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: '#3b82f6',
          width: '12px',
          height: '12px',
          border: '2px solid white',
        }}
      />
    </div>
  );
}
