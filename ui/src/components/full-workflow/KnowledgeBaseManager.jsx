import { useState, useEffect } from 'react';
import { fetchWithCSRF } from '../../utils/csrf.utils.js';

/**
 * Knowledge Base Manager Component
 * Manages knowledge base entries for Full Workflows
 * Design: n8n/make.com style
 */
export default function KnowledgeBaseManager({ onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', text: '' });

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const response = await fetchWithCSRF('/api/knowledge-base');
      if (!response.ok) throw new Error('Failed to fetch entries');
      const data = await response.json();
      setEntries(data.data || []);
    } catch (error) {
      console.error('Error fetching knowledge base entries:', error);
      alert('Failed to load knowledge base entries');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.text.trim()) {
      alert('Name and text are required');
      return;
    }

    try {
      const response = await fetchWithCSRF('/api/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          text: formData.text.trim(),
        }),
      });

      if (!response.ok) throw new Error('Failed to create entry');
      await fetchEntries();
      setFormData({ name: '', text: '' });
    } catch (error) {
      console.error('Error creating entry:', error);
      alert('Failed to create knowledge base entry');
    }
  };

  const handleUpdate = async id => {
    if (!formData.name.trim() || !formData.text.trim()) {
      alert('Name and text are required');
      return;
    }

    try {
      const response = await fetchWithCSRF(`/api/knowledge-base/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          text: formData.text.trim(),
        }),
      });

      if (!response.ok) throw new Error('Failed to update entry');
      await fetchEntries();
      setEditingId(null);
      setFormData({ name: '', text: '' });
    } catch (error) {
      console.error('Error updating entry:', error);
      alert('Failed to update knowledge base entry');
    }
  };

  const handleDelete = async id => {
    if (!confirm('Are you sure you want to delete this entry?')) return;

    try {
      const response = await fetchWithCSRF(`/api/knowledge-base/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete entry');
      await fetchEntries();
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete knowledge base entry');
    }
  };

  const startEdit = entry => {
    setEditingId(entry.id);
    setFormData({ name: entry.name, text: entry.text });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ name: '', text: '' });
  };

  return (
    <div
      style={{
        width: '400px',
        background: 'hsl(var(--card))',
        borderLeft: '1px solid hsl(var(--border))',
        padding: '1.5rem',
        overflowY: 'auto',
        height: '100%',
        boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Header */}
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
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#1a202c',
            margin: 0,
          }}
        >
          📚 Knowledge Base
        </h2>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: '#64748b',
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
            e.currentTarget.style.color = '#64748b';
          }}
        >
          ×
        </button>
      </div>

      {/* Create/Edit Form */}
      <div
        style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          background: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
        }}
      >
        <h3
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#1a202c',
            marginBottom: '1rem',
          }}
        >
          {editingId ? 'Edit Entry' : 'Create New Entry'}
        </h3>
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Product Name"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              color: '#111827',
              fontSize: '0.875rem',
              fontFamily: 'inherit',
            }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Text
          </label>
          <textarea
            value={formData.text}
            onChange={e => setFormData({ ...formData, text: e.target.value })}
            placeholder="Enter knowledge base text..."
            rows={4}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontFamily: 'inherit',
              color: '#111827',
              resize: 'vertical',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={editingId ? () => handleUpdate(editingId) : handleCreate}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            {editingId ? 'Update' : 'Create'}
          </button>
          {editingId && (
            <button
              onClick={cancelEdit}
              style={{
                padding: '0.75rem 1rem',
                background: '#f1f5f9',
                color: '#64748b',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Entries List */}
      <div>
        <h3
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#1a202c',
            marginBottom: '1rem',
          }}
        >
          Entries ({entries.length})
        </h3>
        {loading ? (
          <div
            style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}
          >
            Loading...
          </div>
        ) : entries.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '2rem',
              color: '#94a3b8',
              fontSize: '0.875rem',
            }}
          >
            No entries yet. Create your first entry above.
          </div>
        ) : (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
          >
            {entries.map(entry => (
              <div
                key={entry.id}
                style={{
                  padding: '1rem',
                  background:
                    editingId === entry.id
                      ? 'hsl(var(--accent))'
                      : 'hsl(var(--card))',
                  border: `1px solid ${editingId === entry.id ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                  borderRadius: '8px',
                  transition: 'all 0.2s',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '0.5rem',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        color: '#1a202c',
                        marginBottom: '0.25rem',
                      }}
                    >
                      {entry.name}
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: '#64748b',
                        lineHeight: '1.5',
                        maxHeight: '60px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {entry.text}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginTop: '0.75rem',
                  }}
                >
                  <button
                    onClick={() => startEdit(entry)}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      background: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      background: '#fef2f2',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
