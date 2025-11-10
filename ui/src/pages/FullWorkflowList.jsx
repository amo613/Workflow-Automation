import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function FullWorkflowList() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchWorkflows();
  }, [filterType]);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const url =
        filterType === 'all'
          ? '/api/full-workflows'
          : `/api/full-workflows?type=${filterType}`;
      const response = await fetch(url, {
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
      const response = await fetch(`/api/full-workflows/${id}`, {
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
      const response = await fetch(`/api/full-workflows/${workflow.id}`, {
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
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
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
          ⚙️ Full Workflows
        </h1>
        <Link
          to="/fullWorkflows/new"
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

      {/* Filter */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '2rem',
          padding: '1rem',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}
      >
        <button
          onClick={() => setFilterType('all')}
          style={{
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '8px',
            background: filterType === 'all' ? '#667eea' : '#f3f4f6',
            color: filterType === 'all' ? 'white' : '#333',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          All
        </button>
        <button
          onClick={() => setFilterType('automation')}
          style={{
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '8px',
            background: filterType === 'automation' ? '#667eea' : '#f3f4f6',
            color: filterType === 'automation' ? 'white' : '#333',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Automation
        </button>
        <button
          onClick={() => setFilterType('call-workflow')}
          style={{
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '8px',
            background: filterType === 'call-workflow' ? '#667eea' : '#f3f4f6',
            color: filterType === 'call-workflow' ? 'white' : '#333',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Call Workflow
        </button>
      </div>

      {workflows.length === 0 ? (
        <div
          className="skeu-card"
          style={{
            padding: '3rem',
            textAlign: 'center',
          }}
        >
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              marginBottom: '1rem',
              color: '#333',
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
            Create your first full workflow to get started on your automation
            journey!
          </p>
          <Link
            to="/fullWorkflows/new"
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
            Create New Workflow
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {workflows.map(workflow => (
            <div
              key={workflow.id}
              onClick={() => navigate(`/fullWorkflows/edit/${workflow.id}`)}
              className="skeu-card"
              style={{
                padding: '1.5rem',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {/* Active Badge */}
              {workflow.is_active && (
                <div
                  style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    padding: '0.25rem 0.75rem',
                    background: '#10b981',
                    color: 'white',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  Active
                </div>
              )}

              {/* Type Badge */}
              <div
                style={{
                  display: 'inline-block',
                  padding: '0.25rem 0.75rem',
                  background:
                    workflow.type === 'automation' ? '#667eea' : '#764ba2',
                  color: 'white',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  marginBottom: '1rem',
                }}
              >
                {workflow.type === 'automation'
                  ? '⚙️ Automation'
                  : '📞 Call Workflow'}
              </div>

              <h3
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  marginBottom: '0.5rem',
                  color: '#1a202c',
                }}
              >
                {workflow.name}
              </h3>

              {workflow.description && (
                <p
                  style={{
                    color: '#4a5568',
                    marginBottom: '1rem',
                    fontSize: '0.9rem',
                    lineHeight: '1.5',
                  }}
                >
                  {workflow.description}
                </p>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '1rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <button
                  onClick={e => handleToggleActive(workflow, e)}
                  style={{
                    padding: '0.5rem 1rem',
                    border: 'none',
                    borderRadius: '8px',
                    background: workflow.is_active ? '#ef4444' : '#10b981',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                  }}
                >
                  {workflow.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={e => handleDelete(workflow.id, e)}
                  style={{
                    padding: '0.5rem 1rem',
                    border: 'none',
                    borderRadius: '8px',
                    background: '#ef4444',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.875rem',
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
  );
}

export default FullWorkflowList;
