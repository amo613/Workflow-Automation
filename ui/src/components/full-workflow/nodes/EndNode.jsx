import { Handle, Position } from 'reactflow';

export default function EndNode({ data, selected }) {
  return (
    <div
      style={{
        background: selected ? '#fef2f2' : 'white',
        border: `2px solid ${selected ? '#ef4444' : '#ef4444'}`,
        borderRadius: '12px',
        padding: '1.5rem',
        minWidth: '150px',
        boxShadow: selected
          ? '0 4px 12px #ef444440'
          : '0 2px 8px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.2s ease',
        textAlign: 'center',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: '#ef4444',
          width: '12px',
          height: '12px',
          border: '2px solid white',
        }}
      />
      <div
        style={{
          fontSize: '2rem',
          marginBottom: '0.5rem',
        }}
      >
        🏁
      </div>
      <div
        style={{
          fontWeight: 700,
          fontSize: '1rem',
          color: '#1a202c',
        }}
      >
        End
      </div>
    </div>
  );
}
