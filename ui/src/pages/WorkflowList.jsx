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
      <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <h1>Workflows</h1>
        <Link
          to="/new"
          style={{
            padding: '0.75rem 1.5rem',
            background: '#667eea',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px',
            fontWeight: 600,
          }}
        >
          + Create New Workflow
        </Link>
      </div>

      {workflows.length === 0 ? (
        <div
          style={{
            padding: '3rem',
            textAlign: 'center',
            background: 'white',
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
          }}
        >
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            No workflows yet. Create your first workflow to get started.
          </p>
          <Link
            to="/new"
            style={{
              padding: '0.75rem 1.5rem',
              background: '#667eea',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              fontWeight: 600,
              display: 'inline-block',
            }}
          >
            Create Workflow
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {workflows.map(workflow => (
            <div
              key={workflow.id}
              onClick={() => navigate(`/edit/${workflow.id}`)}
              style={{
                padding: '1.5rem',
                background: 'white',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#667eea';
                e.currentTarget.style.boxShadow =
                  '0 2px 8px rgba(102, 126, 234, 0.1)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#e0e0e0';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'start',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <h3 style={{ fontSize: '1.25rem', color: '#333' }}>
                      {workflow.name}
                    </h3>
                    {workflow.is_active && (
                      <span
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: '#d4edda',
                          color: '#155724',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        Active
                      </span>
                    )}
                  </div>
                  {workflow.description && (
                    <p style={{ color: '#666', marginBottom: '0.5rem' }}>
                      {workflow.description}
                    </p>
                  )}
                  <p style={{ color: '#999', fontSize: '0.875rem' }}>
                    Updated: {new Date(workflow.updated_at).toLocaleString()}
                  </p>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={e => handleToggleActive(workflow, e)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: workflow.is_active ? '#6c757d' : '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    {workflow.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={e => handleDelete(workflow.id, e)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    Delete
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
