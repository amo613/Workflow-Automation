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

  return (
    <div style={{ color: '#94a3b8' }}>
      No settings available for this node type
    </div>
  );
}
