import { useState, useEffect } from 'react';
import { fetchWithCSRF } from '../../../utils/csrf.utils.js';

/**
 * Email Credentials Manager Component
 * Manages SMTP credentials for email nodes
 */
export default function EmailCredentialsManager({ localData, handleUpdate }) {
  const [showModal, setShowModal] = useState(false);
  const [credentials, setCredentials] = useState({
    smtpHost: '',
    smtpPort: '',
    smtpUser: '',
    smtpPassword: '',
    fromEmail: '',
    fromName: '',
    useTls: true,
  });
  const [saving, setSaving] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check if credentials exist
  useEffect(() => {
    const checkCredentials = async () => {
      try {
        setChecking(true);
        const response = await fetchWithCSRF('/api/email/credentials/check');
        if (response.ok) {
          const data = await response.json();
          setHasCredentials(data.hasCredentials || false);
        }
      } catch (error) {
        console.error('Error checking email credentials:', error);
      } finally {
        setChecking(false);
      }
    };

    checkCredentials();
  }, []);

  const handleSaveCredentials = async () => {
    if (
      !credentials.smtpHost ||
      !credentials.smtpPort ||
      !credentials.smtpUser ||
      !credentials.smtpPassword ||
      !credentials.fromEmail
    ) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      const response = await fetchWithCSRF('/api/email/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (response.ok) {
        setHasCredentials(true);
        setShowModal(false);
        setCredentials({
          smtpHost: '',
          smtpPort: '',
          smtpUser: '',
          smtpPassword: '',
          fromEmail: '',
          fromName: '',
          useTls: true,
        });
        alert('Email credentials saved successfully');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save email credentials');
      }
    } catch (error) {
      console.error('Error saving email credentials:', error);
      alert('Failed to save email credentials');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCredentials = async () => {
    if (!confirm('Are you sure you want to delete your email credentials?')) {
      return;
    }

    try {
      const response = await fetchWithCSRF('/api/email/credentials', {
        method: 'DELETE',
      });

      if (response.ok) {
        setHasCredentials(false);
        alert('Email credentials deleted successfully');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete email credentials');
      }
    } catch (error) {
      console.error('Error deleting email credentials:', error);
      alert('Failed to delete email credentials');
    }
  };

  if (checking) {
    return (
      <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
        Checking email credentials status...
      </div>
    );
  }

  return (
    <>
      {hasCredentials ? (
        <div
          style={{
            padding: '1rem',
            background: '#2a2a2a',
            borderRadius: '8px',
            border: '1px solid #10b981',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem',
            }}
          >
            <span style={{ color: '#10b981', fontSize: '1.25rem' }}>✓</span>
            <span
              style={{
                color: '#10b981',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              Email Credentials Set
            </span>
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: '#94a3b8',
              marginBottom: '1rem',
            }}
          >
            Your SMTP credentials are configured and will be used for this node
            if no node-specific credentials are set.
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setShowModal(true)}
              style={{
                background: '#3b82f6',
                border: 'none',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.75rem',
              }}
            >
              Update
            </button>
            <button
              onClick={handleDeleteCredentials}
              style={{
                background: '#ef4444',
                border: 'none',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.75rem',
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: '1rem',
            background: '#2a2a2a',
            borderRadius: '8px',
            border: '1px solid #64748b',
          }}
        >
          <div
            style={{
              fontSize: '0.875rem',
              color: '#94a3b8',
              marginBottom: '1rem',
            }}
          >
            No email credentials configured. Set up your SMTP credentials to use
            the Email node.
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              background: '#3b82f6',
              border: 'none',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            Set Email Credentials
          </button>
        </div>
      )}

      {/* Modal for entering credentials */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: 'hsl(var(--card))',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
              border: '1px solid #333',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'white',
                marginBottom: '1.5rem',
              }}
            >
              Email Credentials
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                SMTP Host <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={credentials.smtpHost}
                onChange={e =>
                  setCredentials({ ...credentials, smtpHost: e.target.value })
                }
                placeholder="smtp.gmail.com"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#2a2a2a',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                SMTP Port <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={credentials.smtpPort}
                onChange={e =>
                  setCredentials({ ...credentials, smtpPort: e.target.value })
                }
                placeholder="587"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#2a2a2a',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                SMTP User (Email) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="email"
                value={credentials.smtpUser}
                onChange={e =>
                  setCredentials({ ...credentials, smtpUser: e.target.value })
                }
                placeholder="your-email@gmail.com"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#2a2a2a',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                SMTP Password <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="password"
                value={credentials.smtpPassword}
                onChange={e =>
                  setCredentials({
                    ...credentials,
                    smtpPassword: e.target.value,
                  })
                }
                placeholder="Your SMTP password or app password"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#2a2a2a',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                From Email <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="email"
                value={credentials.fromEmail}
                onChange={e =>
                  setCredentials({ ...credentials, fromEmail: e.target.value })
                }
                placeholder="sender@example.com"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#2a2a2a',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                From Name (Optional)
              </label>
              <input
                type="text"
                value={credentials.fromName}
                onChange={e =>
                  setCredentials({ ...credentials, fromName: e.target.value })
                }
                placeholder="Your Name"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#2a2a2a',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={credentials.useTls}
                  onChange={e =>
                    setCredentials({
                      ...credentials,
                      useTls: e.target.checked,
                    })
                  }
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                  }}
                />
                <span style={{ color: 'white', fontSize: '0.875rem' }}>
                  Use TLS/SSL
                </span>
              </label>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid #333',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCredentials}
                disabled={saving}
                style={{
                  background: saving ? '#64748b' : '#3b82f6',
                  border: 'none',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
