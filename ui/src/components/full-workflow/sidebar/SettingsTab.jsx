import { useState, useEffect } from 'react';
import EmailCredentialsManager from './EmailCredentialsManager.jsx';
import { fetchWithCSRF } from '../../../utils/csrf.utils.js';

/**
 * Settings Tab Component
 * Displays settings for different node types
 */
export default function SettingsTab({
  nodeType,
  localData,
  handleUpdate,
  googleSheets,
  knowledgeBaseEntries,
  onGoogleSheetsAuth,
  onGoogleSheetsDisconnect,
}) {
  if (nodeType === 'google-sheets' || nodeType === 'google-sheets-trigger') {
    return (
      <div>
        {/* Google Sheets OAuth Configuration */}
        <div style={{ marginBottom: '2rem' }}>
          <div
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'white',
              marginBottom: '1rem',
            }}
          >
            Google Sheets Connection
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: '#94a3b8',
              marginBottom: '1rem',
            }}
          >
            Connect your Google account to access Google Sheets
          </div>
          {googleSheets?.status?.connected ? (
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
                  Connected
                </span>
              </div>
              {googleSheets.status.email && (
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                    marginBottom: '0.5rem',
                  }}
                >
                  Account: {googleSheets.status.email}
                </div>
              )}
              <button
                onClick={onGoogleSheetsDisconnect}
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
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={onGoogleSheetsAuth}
              style={{
                background: '#4285f4',
                border: 'none',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>🔗</span>
              <span>Connect Google Account</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (nodeType === 'call-agent') {
    return (
      <>
        {/* Knowledge Base Configuration */}
        <div style={{ marginBottom: '2rem' }}>
          <div
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'white',
              marginBottom: '1rem',
            }}
          >
            Knowledge Base
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: '#94a3b8',
              marginBottom: '1rem',
            }}
          >
            Select knowledge base entries to include in the call prompt
          </div>
          <div style={{ marginBottom: '1rem' }}>
            {knowledgeBaseEntries.length === 0 ? (
              <div
                style={{
                  padding: '1rem',
                  background: '#2a2a2a',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  fontSize: '0.875rem',
                }}
              >
                No knowledge base entries found. Create entries in the Knowledge
                Base Manager.
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                {knowledgeBaseEntries.map(entry => {
                  const isSelected =
                    localData.knowledge_base_ids?.includes(entry.id) || false;
                  return (
                    <label
                      key={entry.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem',
                        background: isSelected ? '#2a2a2a' : '#1a1a1a',
                        border: `1px solid ${isSelected ? '#3b82f6' : '#333'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => {
                          const currentIds = localData.knowledge_base_ids || [];
                          const newIds = e.target.checked
                            ? [...currentIds, entry.id]
                            : currentIds.filter(id => id !== entry.id);
                          handleUpdate('knowledge_base_ids', newIds);
                        }}
                        style={{
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer',
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            color: 'white',
                          }}
                        >
                          {entry.name}
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: '#94a3b8',
                            marginTop: '0.25rem',
                          }}
                        >
                          {entry.text.length > 100
                            ? entry.text.substring(0, 100) + '...'
                            : entry.text}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* OpenAI Configuration */}
        <div
          style={{
            marginTop: '2rem',
            paddingTop: '2rem',
            borderTop: '1px solid #333',
          }}
        >
          <div
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'white',
              marginBottom: '1rem',
            }}
          >
            OpenAI Configuration
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
              Temperature (0-2)
            </label>
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={localData.temperature ?? 1.0}
              onChange={e =>
                handleUpdate('temperature', parseFloat(e.target.value))
              }
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #333',
                borderRadius: '8px',
                fontSize: '0.875rem',
                background: '#2a2a2a',
                color: 'white',
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
              Max Response Tokens (1-4096)
            </label>
            <input
              type="number"
              min="1"
              max="4096"
              value={localData.max_response_output_tokens ?? 4096}
              onChange={e =>
                handleUpdate(
                  'max_response_output_tokens',
                  parseInt(e.target.value, 10)
                )
              }
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #333',
                borderRadius: '8px',
                fontSize: '0.875rem',
                background: '#2a2a2a',
                color: 'white',
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
              VAD Threshold (0-1)
            </label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={localData.vad_threshold ?? 0.5}
              onChange={e =>
                handleUpdate('vad_threshold', parseFloat(e.target.value))
              }
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #333',
                borderRadius: '8px',
                fontSize: '0.875rem',
                background: '#2a2a2a',
                color: 'white',
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
              Tool Choice
            </label>
            <select
              value={localData.tool_choice || 'auto'}
              onChange={e => handleUpdate('tool_choice', e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #333',
                borderRadius: '8px',
                fontSize: '0.875rem',
                background: '#2a2a2a',
                color: 'white',
              }}
            >
              <option value="auto">Auto</option>
              <option value="none">None</option>
              <option value="required">Required</option>
            </select>
          </div>
        </div>
      </>
    );
  }

  if (nodeType === 'ai-agent') {
    return (
      <>
        {/* API Key Configuration */}
        <div style={{ marginBottom: '2rem' }}>
          <div
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'white',
              marginBottom: '1rem',
            }}
          >
            OpenAI API Key
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: '#94a3b8',
              marginBottom: '1rem',
            }}
          >
            Set a custom API key for this node (optional). If not set, your user
            API key or the global API key will be used.
          </div>
          <ApiKeyManager localData={localData} handleUpdate={handleUpdate} />
        </div>

        {/* Memory Configuration */}
        <div
          style={{
            marginTop: '2rem',
            paddingTop: '2rem',
            borderTop: '1px solid #333',
          }}
        >
          <div
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'white',
              marginBottom: '1rem',
            }}
          >
            Memory
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: '#94a3b8',
              marginBottom: '1rem',
            }}
          >
            Enable memory to maintain conversation context across workflow
            executions
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1rem',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={localData.useMemory || false}
              onChange={e => handleUpdate('useMemory', e.target.checked)}
              style={{
                width: '18px',
                height: '18px',
                cursor: 'pointer',
              }}
            />
            <span style={{ color: 'white', fontSize: '0.875rem' }}>
              Enable Memory
            </span>
          </label>
          {localData.useMemory && (
            <div style={{ marginTop: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                Memory Window Length
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={localData.memoryWindowLength || 10}
                onChange={e =>
                  handleUpdate(
                    'memoryWindowLength',
                    parseInt(e.target.value, 10)
                  )
                }
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  background: '#2a2a2a',
                  color: 'white',
                }}
              />
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                  marginTop: '0.5rem',
                }}
              >
                Number of messages to keep in memory (1-100)
              </div>
            </div>
          )}
        </div>

        {/* Temperature Configuration */}
        <div
          style={{
            marginTop: '2rem',
            paddingTop: '2rem',
            borderTop: '1px solid #333',
          }}
        >
          <div
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'white',
              marginBottom: '1rem',
            }}
          >
            Temperature
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: '#94a3b8',
              marginBottom: '1rem',
            }}
          >
            Controls randomness in the model's output (0.0 = deterministic, 2.0
            = very creative)
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={localData.temperature ?? 1.0}
              onChange={e =>
                handleUpdate('temperature', parseFloat(e.target.value))
              }
              style={{
                width: '100%',
                marginBottom: '0.5rem',
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                color: '#94a3b8',
              }}
            >
              <span>0.0</span>
              <span style={{ fontWeight: 600, color: 'white' }}>
                {localData.temperature ?? 1.0}
              </span>
              <span>2.0</span>
            </div>
          </div>
          <input
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={localData.temperature ?? 1.0}
            onChange={e =>
              handleUpdate('temperature', parseFloat(e.target.value))
            }
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #333',
              borderRadius: '8px',
              fontSize: '0.875rem',
              background: '#2a2a2a',
              color: 'white',
            }}
          />
        </div>
      </>
    );
  }

  if (nodeType === 'email') {
    return (
      <>
        {/* Email Credentials Configuration */}
        <div style={{ marginBottom: '2rem' }}>
          <div
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'white',
              marginBottom: '1rem',
            }}
          >
            SMTP Credentials
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: '#94a3b8',
              marginBottom: '1rem',
            }}
          >
            Configure your SMTP credentials to send emails. These credentials
            will be encrypted and stored securely. If not set, environment
            variables (ACCOUNT_EMAIL, EMAIL_PASSWORD) will be used as fallback.
          </div>
          <EmailCredentialsManager
            localData={localData}
            handleUpdate={handleUpdate}
          />
        </div>
      </>
    );
  }

  return (
    <div style={{ color: '#94a3b8' }}>
      No settings available for this node type
    </div>
  );
}

/**
 * API Key Manager Component
 */
function ApiKeyManager({ localData, handleUpdate }) {
  const [showModal, setShowModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check if API key exists
  useEffect(() => {
    const checkApiKey = async () => {
      try {
        setChecking(true);
        const response = await fetchWithCSRF('/api/ai-agent/api-key/check');
        if (response.ok) {
          const data = await response.json();
          setHasApiKey(data.hasApiKey || false);
        }
      } catch (error) {
        console.error('Error checking API key:', error);
      } finally {
        setChecking(false);
      }
    };

    checkApiKey();
  }, []);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      alert('Please enter an API key');
      return;
    }

    try {
      setSaving(true);
      const response = await fetchWithCSRF('/api/ai-agent/api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey }),
      });

      if (response.ok) {
        // API key is encrypted on the server, we don't store it in node data
        // Instead, the handler will use the user's API key from the database
        setHasApiKey(true);
        setShowModal(false);
        setApiKey('');
        alert('API key saved successfully');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save API key');
      }
    } catch (error) {
      console.error('Error saving API key:', error);
      alert('Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteApiKey = async () => {
    if (!confirm('Are you sure you want to delete your API key?')) {
      return;
    }

    try {
      const response = await fetchWithCSRF('/api/ai-agent/api-key', {
        method: 'DELETE',
      });

      if (response.ok) {
        setHasApiKey(false);
        alert('API key deleted successfully');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete API key');
      }
    } catch (error) {
      console.error('Error deleting API key:', error);
      alert('Failed to delete API key');
    }
  };

  if (checking) {
    return (
      <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
        Checking API key status...
      </div>
    );
  }

  return (
    <>
      {hasApiKey ? (
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
              API Key Set
            </span>
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: '#94a3b8',
              marginBottom: '0.5rem',
            }}
          >
            Your API key is encrypted and stored securely
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
              onClick={handleDeleteApiKey}
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
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: '#3b82f6',
            border: 'none',
            color: 'white',
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          Set API Key
        </button>
      )}

      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => !saving && setShowModal(false)}
        >
          <div
            style={{
              background: '#1a1a1a',
              padding: '2rem',
              borderRadius: '12px',
              maxWidth: '500px',
              width: '90%',
              border: '1px solid #333',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3
              style={{
                color: 'white',
                fontSize: '1.25rem',
                fontWeight: 600,
                marginBottom: '1rem',
              }}
            >
              OpenAI API Key
            </h3>
            <div
              style={{
                fontSize: '0.875rem',
                color: '#94a3b8',
                marginBottom: '1rem',
              }}
            >
              Enter your OpenAI API key. It will be encrypted and stored
              securely.
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-..."
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #333',
                borderRadius: '8px',
                fontSize: '0.875rem',
                background: '#2a2a2a',
                color: 'white',
                marginBottom: '1rem',
              }}
              disabled={saving}
            />
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={() => {
                  setShowModal(false);
                  setApiKey('');
                }}
                disabled={saving}
                style={{
                  background: '#333',
                  border: 'none',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveApiKey}
                disabled={saving || !apiKey.trim()}
                style={{
                  background: saving ? '#666' : '#3b82f6',
                  border: 'none',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: saving || !apiKey.trim() ? 'not-allowed' : 'pointer',
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
