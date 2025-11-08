import { Handle, Position } from 'reactflow';

function EndNode({ data, id }) {
  // Support both old format (text) and new format (action)
  const displayText = data?.action || data?.text || '';

  // Don't update from node - only show display
  // The sidebar handles all updates

  return (
    <div
      style={{
        padding: '1.25rem',
        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        color: 'white',
        borderRadius: '20px',
        minWidth: '220px',
        boxShadow:
          '0 8px 24px rgba(239, 68, 68, 0.3), 0 4px 12px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
        border: '2px solid rgba(255, 255, 255, 0.2)',
        position: 'relative',
        transition: 'box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow =
          '0 12px 32px rgba(239, 68, 68, 0.4), 0 6px 16px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow =
          '0 8px 24px rgba(239, 68, 68, 0.3), 0 4px 12px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
      }}
    >
      <div
        style={{
          marginBottom: '0.75rem',
          fontWeight: 700,
          fontSize: '0.875rem',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          opacity: 0.95,
        }}
      >
        🏁 END
      </div>
      <div
        style={{
          padding: '0.75rem',
          borderRadius: '12px',
          fontSize: '0.875rem',
          minHeight: '70px',
          background: 'rgba(255, 255, 255, 0.2)',
          color: 'white',
          backdropFilter: 'blur(10px)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {displayText || (
          <span style={{ opacity: 0.5 }}>Click to edit in sidebar</span>
        )}
      </div>
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: 'white',
          border: '3px solid #ef4444',
          width: '16px',
          height: '16px',
        }}
      />
    </div>
  );
}

export default EndNode;
