import { useState, useEffect } from 'react';
import { fetchWithCSRF } from '../../../utils/csrf.utils.js';

/**
 * Twilio Credentials Manager Component
 * Manages Twilio credentials for call trigger nodes
 */
export default function TwilioCredentialsManager({ localData, handleUpdate }) {
  const [showModal, setShowModal] = useState(false);
  const [credentials, setCredentials] = useState({
    accountSid: '',
    authToken: '',
  });
  const [saving, setSaving] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check if credentials exist
  useEffect(() => {
    const checkCredentials = async () => {
      try {
        setChecking(true);
        const response = await fetchWithCSRF('/api/twilio/credentials/check');
        if (response.ok) {
          const data = await response.json();
          setHasCredentials(data.hasCredentials || false);
        }
      } catch (error) {
        console.error('Error checking Twilio credentials:', error);
      } finally {
        setChecking(false);
      }
    };

    checkCredentials();
  }, []);

  const handleSaveCredentials = async () => {
    if (!credentials.accountSid || !credentials.authToken) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      const response = await fetchWithCSRF('/api/twilio/credentials', {
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
          accountSid: '',
          authToken: '',
        });
        alert('Twilio credentials saved successfully');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save Twilio credentials');
      }
    } catch (error) {
      console.error('Error saving Twilio credentials:', error);
      alert('Failed to save Twilio credentials');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCredentials = async () => {
    if (!confirm('Are you sure you want to delete your Twilio credentials?')) {
      return;
    }

    try {
      const response = await fetchWithCSRF('/api/twilio/credentials', {
        method: 'DELETE',
      });

      if (response.ok) {
        setHasCredentials(false);
        alert('Twilio credentials deleted successfully');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete Twilio credentials');
      }
    } catch (error) {
      console.error('Error deleting Twilio credentials:', error);
      alert('Failed to delete Twilio credentials');
    }
  };

  if (checking) {
    return (
      <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
        Checking Twilio credentials status...
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
              Twilio Credentials Set
            </span>
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: '#94a3b8',
              marginBottom: '1rem',
            }}
          >
            Your Twilio credentials are configured and will be used for Call
            Trigger nodes.
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
            No Twilio credentials configured. Set up your Twilio credentials to
            use the Call Trigger node.
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
            Set Twilio Credentials
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
              Twilio Credentials
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
                Account SID <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={credentials.accountSid}
                onChange={e =>
                  setCredentials({ ...credentials, accountSid: e.target.value })
                }
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
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
                Auth Token <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="password"
                value={credentials.authToken}
                onChange={e =>
                  setCredentials({ ...credentials, authToken: e.target.value })
                }
                placeholder="Your Twilio Auth Token"
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
