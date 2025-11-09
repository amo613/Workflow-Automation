import { useState, useEffect } from 'react';
import { toCamelCase } from '../utils/variable-utils.js';

function KnowledgeBaseSidebar({ knowledgeBase, onUpdate, onClose }) {
  const [localKB, setLocalKB] = useState([]);

  useEffect(() => {
    setLocalKB(knowledgeBase || []);
  }, [knowledgeBase]);

  const handleAdd = () => {
    const newKB = [...localKB, { name: '', text: '' }];
    setLocalKB(newKB);
    if (onUpdate) {
      onUpdate(newKB);
    }
  };

  const handleUpdate = (index, field, value) => {
    const newKB = [...localKB];
    // If updating name field, keep original but also store normalized version
    if (field === 'name') {
      newKB[index] = {
        ...newKB[index],
        [field]: value,
        normalizedName: toCamelCase(value),
      };
    } else {
      newKB[index] = { ...newKB[index], [field]: value };
    }
    setLocalKB(newKB);
    if (onUpdate) {
      onUpdate(newKB);
    }
  };

  const handleDelete = index => {
    const newKB = localKB.filter((_, i) => i !== index);
    setLocalKB(newKB);
    if (onUpdate) {
      onUpdate(newKB);
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
          📚 Knowledge Base
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

      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={handleAdd}
          className="bubble-btn"
          style={{
            width: '100%',
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          }}
        >
          ➕ Add Knowledge Entry
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {localKB.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: '#6b7280',
              fontSize: '0.875rem',
              padding: '2rem',
            }}
          >
            No knowledge entries yet. Click "Add Knowledge Entry" to get
            started.
          </div>
        ) : (
          localKB.map((kb, index) => (
            <div
              key={index}
              style={{
                padding: '1rem',
                background: 'rgba(102, 126, 234, 0.05)',
                borderRadius: '12px',
                border: '1px solid rgba(102, 126, 234, 0.1)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                }}
              >
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                  }}
                >
                  Entry {index + 1}
                </span>
                <button
                  onClick={() => handleDelete(index)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    color: '#ef4444',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  🗑️
                </button>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    color: '#374151',
                    fontSize: '0.875rem',
                  }}
                >
                  Name (Variable Name)
                </label>
                <input
                  type="text"
                  value={kb.name || ''}
                  onChange={e => handleUpdate(index, 'name', e.target.value)}
                  placeholder="e.g., productName"
                  className="bubble-input"
                  style={{ width: '100%' }}
                />
                <div
                  style={{
                    marginTop: '0.25rem',
                    fontSize: '0.75rem',
                    color: '#6b7280',
                  }}
                >
                  Use this name in nodes: {'{'}
                  {kb.normalizedName || toCamelCase(kb.name) || 'variableName'}
                  {'}'}
                  {kb.name &&
                    kb.name.trim() &&
                    toCamelCase(kb.name) !== kb.name.trim() && (
                      <span style={{ marginLeft: '0.5rem', color: '#9ca3af' }}>
                        (from "{kb.name}")
                      </span>
                    )}
                </div>
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
                  Text (Content)
                </label>
                <textarea
                  value={kb.text || ''}
                  onChange={e => handleUpdate(index, 'text', e.target.value)}
                  placeholder="Enter knowledge base content..."
                  className="bubble-input"
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default KnowledgeBaseSidebar;
