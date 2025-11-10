import { Handle, Position } from 'reactflow';

export default function StartNode({ data, selected }) {
  return (
    <div
      style={{
        background: selected ? '#f0fdf4' : 'white',
        border: `2px solid ${selected ? '#10b981' : '#10b981'}`,
        borderRadius: '12px',
        padding: '1.5rem',
        minWidth: '150px',
        boxShadow: selected
          ? '0 4px 12px #10b98140'
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
        🚀
      </div>
      <div
        style={{
          fontWeight: 700,
          fontSize: '1rem',
          color: '#1a202c',
        }}
      >
        Start
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: '#10b981',
          width: '12px',
          height: '12px',
          border: '2px solid white',
        }}
      />
    </div>
  );
}
