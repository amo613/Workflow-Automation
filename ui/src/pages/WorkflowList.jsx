import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function WorkflowList() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/workflows', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch workflows');
      }

      const data = await response.json();
      setWorkflows(data.data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this workflow?')) {
      return;
    }

    try {
      const response = await fetch(`/api/workflows/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete workflow');
      }

      fetchWorkflows();
    } catch (err) {
      alert('Failed to delete workflow: ' + err.message);
      console.error('Error deleting workflow:', err);
    }
  };

  const handleToggleActive = async (workflow, e) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/workflows/${workflow.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          is_active: !workflow.is_active,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update workflow');
      }

      fetchWorkflows();
    } catch (err) {
      alert('Failed to update workflow: ' + err.message);
      console.error('Error updating workflow:', err);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '18px',
          color: '#667eea',
          fontWeight: 600,
        }}
      >
        <div
          style={{
            padding: '24px 48px',
            background: 'white',
            borderRadius: '24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          }}
        >
          ✨ Loading workflows...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#ef4444',
          fontSize: '18px',
        }}
      >
        ❌ Error: {error}
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '2rem',
        maxWidth: '1400px',
        margin: '0 auto',
        position: 'relative',
        zIndex: 1,
      }}
    >
      {/* Header with Bubble Effect */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          padding: '1.5rem 2rem',
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          boxShadow:
            '0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.8)',
        }}
      >
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0,
          }}
        >
          🎨 My Workflows
        </h1>
        <Link
          to="/new"
          className="bubble-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            textDecoration: 'none',
            padding: '0.75rem 1.25rem',
            fontSize: '0.9rem',
          }}
        >
          <span style={{ fontSize: '18px' }}>✨</span>
          Create New
        </Link>
      </div>

      {workflows.length === 0 ? (
        <div
          className="skeu-card"
          style={{
            padding: '3rem',
            textAlign: 'center',
            marginTop: '1rem',
          }}
        >
          <div style={{ fontSize: '3.5rem', marginBottom: '1.25rem' }}>🎯</div>
          <h2
            style={{
              fontSize: '1.35rem',
              color: '#333',
              marginBottom: '0.75rem',
              fontWeight: 700,
            }}
          >
            No workflows yet
          </h2>
          <p
            style={{
              color: '#666',
              marginBottom: '1.5rem',
              fontSize: '1rem',
            }}
          >
            Create your first workflow to get started on your automation
            journey!
          </p>
          <Link
            to="/new"
            className="bubble-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none',
              padding: '0.75rem 1.5rem',
              fontSize: '0.9rem',
            }}
          >
            <span style={{ fontSize: '18px' }}>🚀</span>
            Create Workflow
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
            gap: '1.25rem',
            marginTop: '0.5rem',
          }}
        >
          {workflows.map(workflow => (
            <div
              key={workflow.id}
              onClick={() => navigate(`/edit/${workflow.id}`)}
              className="skeu-card"
              style={{
                padding: '1.5rem',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {/* Active Badge with Glow */}
              {workflow.is_active && (
                <div
                  style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    padding: '0.5rem 1rem',
                    background:
                      'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    boxShadow:
                      '0 4px 12px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    animation: 'glow 2s ease-in-out infinite',
                  }}
                >
                  ⚡ Active
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <h3
                  style={{
                    fontSize: '1.5rem',
                    color: '#1f2937',
                    fontWeight: 700,
                    marginBottom: '0.5rem',
                    marginRight: workflow.is_active ? '80px' : '0',
                  }}
                >
                  {workflow.name}
                </h3>
                {workflow.description && (
                  <p
                    style={{
                      color: '#6b7280',
                      fontSize: '0.95rem',
                      lineHeight: '1.5',
                    }}
                  >
                    {workflow.description}
                  </p>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '1.5rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid rgba(0, 0, 0, 0.05)',
                }}
              >
                <p
                  style={{
                    color: '#9ca3af',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  📅 {new Date(workflow.updated_at).toLocaleDateString()}
                </p>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={e => handleToggleActive(workflow, e)}
                    className="bubble-btn"
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      background: workflow.is_active
                        ? 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    }}
                  >
                    {workflow.is_active ? '⏸️ Deactivate' : '▶️ Activate'}
                  </button>
                  <button
                    onClick={e => handleDelete(workflow.id, e)}
                    className="bubble-btn"
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      background:
                        'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default WorkflowList;
