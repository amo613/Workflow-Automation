import { useState, useEffect } from 'react';
import { workflowVersionService } from '../../services/workflowVersion.service.js';

export default function VersionHistory({ workflowId, onRestore }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (workflowId && isModalOpen) {
      fetchVersions();
    }
  }, [workflowId, isModalOpen]);

  const fetchVersions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await workflowVersionService.getVersions(workflowId);
      setVersions(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching versions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async version => {
    if (
      !window.confirm(
        `Restore workflow to version ${version.version_number}? This will replace the current workflow with this version.`
      )
    ) {
      return;
    }

    setRestoring(true);
    try {
      const restoredWorkflow = await workflowVersionService.restoreVersion(
        workflowId,
        version.id
      );
      if (onRestore && restoredWorkflow.workflow_json) {
        onRestore(restoredWorkflow.workflow_json);
      }
      // Refresh versions after restore
      await fetchVersions();
      // Show success message
      alert(
        `Workflow restored to version ${version.version_number} successfully! The page will reload.`
      );
      // Reload after a short delay to show the alert
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      alert(`Failed to restore version: ${err.message}`);
      console.error('Error restoring version:', err);
    } finally {
      setRestoring(false);
    }
  };

  const formatDate = dateString => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      {/* Button in Sidebar */}
      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow =
              '0 6px 16px rgba(102, 126, 234, 0.4)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow =
              '0 4px 12px rgba(102, 126, 234, 0.3)';
          }}
        >
          <span style={{ fontSize: '1.25rem' }}>📚</span>
          <span>Version History</span>
          {versions.length > 0 && (
            <span
              style={{
                background: 'rgba(255, 255, 255, 0.3)',
                padding: '0.125rem 0.5rem',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              {versions.length}
            </span>
          )}
        </button>
      </div>

      {/* Modal Overlay */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '2rem',
          }}
          onClick={e => {
            if (e.target === e.currentTarget) {
              setIsModalOpen(false);
            }
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '900px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.5rem 2rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.75rem',
                  }}
                >
                  📚
                </div>
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      color: 'white',
                      textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    Version History
                  </h2>
                  <p
                    style={{
                      margin: '0.25rem 0 0 0',
                      fontSize: '0.875rem',
                      color: 'rgba(255, 255, 255, 0.9)',
                      fontWeight: 500,
                    }}
                  >
                    {versions.length} version{versions.length !== 1 ? 's' : ''}{' '}
                    saved
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(10px)',
                  border: 'none',
                  color: 'white',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                  e.currentTarget.style.transform = 'rotate(90deg)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.transform = 'rotate(0deg)';
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '2rem',
                background: '#f8fafc',
              }}
            >
              {loading && (
                <div
                  style={{
                    padding: '1rem',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '0.875rem',
                  }}
                >
                  Loading versions...
                </div>
              )}

              {error && (
                <div
                  style={{
                    padding: '0.75rem',
                    background: '#fee2e2',
                    border: '1px solid #ef4444',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    color: '#dc2626',
                    margin: '0.5rem',
                  }}
                >
                  Error: {error}
                </div>
              )}

              {!loading && !error && versions.length === 0 && (
                <div
                  style={{
                    padding: '1rem',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '0.875rem',
                  }}
                >
                  No versions yet. Versions are automatically created when you
                  save changes.
                </div>
              )}

              {!loading && !error && versions.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  {versions.map((version, index) => (
                    <div
                      key={version.id}
                      style={{
                        padding: '1rem',
                        background:
                          selectedVersion?.id === version.id
                            ? 'linear-gradient(135deg, #f0f4ff 0%, #e9d5ff 100%)'
                            : index === 0
                              ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
                              : '#f8fafc',
                        borderRadius: '10px',
                        border: `2px solid ${
                          selectedVersion?.id === version.id
                            ? '#8b5cf6'
                            : index === 0
                              ? '#f59e0b'
                              : '#e0e0e0'
                        }`,
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow:
                          selectedVersion?.id === version.id
                            ? '0 4px 12px rgba(139, 92, 246, 0.3)'
                            : '0 2px 8px rgba(0, 0, 0, 0.05)',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                      onClick={() => setSelectedVersion(version)}
                      onMouseEnter={e => {
                        if (selectedVersion?.id !== version.id) {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow =
                            '0 4px 12px rgba(0, 0, 0, 0.1)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (selectedVersion?.id !== version.id) {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow =
                            '0 2px 8px rgba(0, 0, 0, 0.05)';
                        }
                      }}
                    >
                      {index === 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '0.5rem',
                            right: '0.5rem',
                            padding: '0.25rem 0.5rem',
                            background: '#f59e0b',
                            color: 'white',
                            borderRadius: '12px',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          Latest
                        </div>
                      )}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '0.75rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                          }}
                        >
                          <div
                            style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '12px',
                              background:
                                index === 0
                                  ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                                  : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.875rem',
                              fontWeight: 700,
                              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
                            }}
                          >
                            v{version.version_number}
                          </div>
                          <div>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: '0.9375rem',
                                color: '#1a202c',
                                marginBottom: '0.25rem',
                              }}
                            >
                              {version.name ||
                                `Version ${version.version_number}`}
                            </div>
                            <div
                              style={{
                                fontSize: '0.8125rem',
                                color: '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                              }}
                            >
                              <span>🕒</span>
                              <span>{formatDate(version.created_at)}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleRestore(version);
                          }}
                          disabled={restoring}
                          style={{
                            padding: '0.5rem 1rem',
                            background:
                              index === 0
                                ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                                : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '0.8125rem',
                            fontWeight: 700,
                            cursor: restoring ? 'not-allowed' : 'pointer',
                            opacity: restoring ? 0.6 : 1,
                            transition: 'all 0.3s ease',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                          }}
                          onMouseEnter={e => {
                            if (!restoring) {
                              e.currentTarget.style.transform = 'scale(1.05)';
                              e.currentTarget.style.boxShadow =
                                '0 4px 12px rgba(0, 0, 0, 0.2)';
                            }
                          }}
                          onMouseLeave={e => {
                            if (!restoring) {
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.boxShadow =
                                '0 2px 8px rgba(0, 0, 0, 0.15)';
                            }
                          }}
                        >
                          {restoring ? '⏳ Restoring...' : '↩️ Restore'}
                        </button>
                      </div>
                      {version.description && (
                        <div
                          style={{
                            fontSize: '0.8125rem',
                            color: '#64748b',
                            marginTop: '0.75rem',
                            paddingTop: '0.75rem',
                            borderTop: '2px solid rgba(0, 0, 0, 0.05)',
                            fontStyle: 'italic',
                          }}
                        >
                          💬 {version.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
