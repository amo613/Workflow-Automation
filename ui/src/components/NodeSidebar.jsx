import { useState, useEffect } from 'react';

function NodeSidebar({ selectedNode, onNodeUpdate, nodes, edges, onClose }) {
  const [localData, setLocalData] = useState({});

  useEffect(() => {
    if (selectedNode) {
      setLocalData(selectedNode.data || {});
    } else {
      setLocalData({});
    }
  }, [selectedNode]);

  if (!selectedNode) {
    return null;
  }

  const handleUpdate = (field, value) => {
    const newData = { ...localData, [field]: value };
    setLocalData(newData);
    if (onNodeUpdate) {
      onNodeUpdate(selectedNode.id, newData);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        width: '400px',
        height: '100%',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.1)',
        borderLeft: '1px solid rgba(102, 126, 234, 0.1)',
        padding: '2rem',
        overflowY: 'auto',
        overflowX: 'hidden',
        zIndex: 50,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <h2
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#1f2937',
            margin: 0,
          }}
        >
          {selectedNode.type === 'start' && '🚀 Start Node'}
          {selectedNode.type === 'step' && '✨ Step Node'}
          {selectedNode.type === 'if' && '🔀 If Node'}
          {selectedNode.type === 'end' && '🏁 End Node'}
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '0.25rem 0.5rem',
              borderRadius: '8px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.color = '#1f2937';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Start Node */}
      {selectedNode.type === 'start' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 600,
                color: '#374151',
                fontSize: '0.875rem',
              }}
            >
              Action
            </label>
            <textarea
              value={localData.action || localData.text || ''}
              onChange={e => handleUpdate('action', e.target.value)}
              placeholder="Start message..."
              className="bubble-input"
              style={{
                width: '100%',
                minHeight: '100px',
                resize: 'vertical',
              }}
            />
          </div>
        </div>
      )}

      {/* Step Node */}
      {selectedNode.type === 'step' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 600,
                color: '#374151',
                fontSize: '0.875rem',
              }}
            >
              Name
            </label>
            <input
              type="text"
              value={localData.name || ''}
              onChange={e => handleUpdate('name', e.target.value)}
              placeholder="Node name..."
              className="bubble-input"
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 600,
                color: '#374151',
                fontSize: '0.875rem',
              }}
            >
              Action
            </label>
            <textarea
              value={localData.action || localData.text || ''}
              onChange={e => handleUpdate('action', e.target.value)}
              placeholder="Step message..."
              className="bubble-input"
              style={{
                width: '100%',
                minHeight: '100px',
                resize: 'vertical',
              }}
            />
          </div>
        </div>
      )}

      {/* If Node */}
      {selectedNode.type === 'if' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 600,
                color: '#374151',
                fontSize: '0.875rem',
              }}
            >
              Condition
            </label>
            <input
              type="text"
              value={localData.condition || ''}
              onChange={e => handleUpdate('condition', e.target.value)}
              placeholder="Condition..."
              className="bubble-input"
            />
          </div>
        </div>
      )}

      {/* End Node */}
      {selectedNode.type === 'end' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 600,
                color: '#374151',
                fontSize: '0.875rem',
              }}
            >
              Action
            </label>
            <textarea
              value={localData.action || localData.text || ''}
              onChange={e => handleUpdate('action', e.target.value)}
              placeholder="End message..."
              className="bubble-input"
              style={{
                width: '100%',
                minHeight: '100px',
                resize: 'vertical',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default NodeSidebar;
