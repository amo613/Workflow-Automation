import { useState, useEffect } from 'react';
import EmailCredentialsManager from './EmailCredentialsManager.jsx';
import TwilioCredentialsManager from './TwilioCredentialsManager.jsx';
import VariableAutocomplete from '../VariableAutocomplete.jsx';
import { fetchWithCSRF } from '../../../utils/csrf.utils.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Settings Tab Component
 * Displays settings for different node types
 */
export default function SettingsTab({
  nodeType = null,
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
      <CallAgentSettings
        nodeType={nodeType}
        localData={localData}
        handleUpdate={handleUpdate}
        knowledgeBaseEntries={knowledgeBaseEntries}
      />
    );
  }

  if (nodeType === 'call-trigger') {
    return (
      <CallTriggerSettings
        nodeType={nodeType}
        localData={localData}
        handleUpdate={handleUpdate}
        knowledgeBaseEntries={knowledgeBaseEntries}
      />
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

  if (nodeType === 'hubspot') {
    // HubSpot Integration State
    const [hubspotConnected, setHubspotConnected] = useState(false);
    const [hubspotEmail, setHubspotEmail] = useState(null);
    const [checkingHubspot, setCheckingHubspot] = useState(true);

    // HubSpot Integration Functions
    const refreshHubspotStatus = async () => {
      try {
        setCheckingHubspot(true);
        const res = await fetch('/api/integrations/hubspot/status', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setHubspotConnected(data.connected || false);
          setHubspotEmail(data.email || null);
        } else {
          setHubspotConnected(false);
          setHubspotEmail(null);
        }
      } catch (error) {
        console.error('Error checking HubSpot status:', error);
        setHubspotConnected(false);
        setHubspotEmail(null);
      } finally {
        setCheckingHubspot(false);
      }
    };

    // Load HubSpot status on mount
    useEffect(() => {
      refreshHubspotStatus();
    }, []);

    // Handle URL params for HubSpot callback
    useEffect(() => {
      if (window.location.search.includes('hubspot=connected')) {
        const url = new URL(window.location.href);
        url.searchParams.delete('hubspot');
        window.history.replaceState({}, '', url);
        setTimeout(refreshHubspotStatus, 500);
      }
    }, []);

    // Handle connect HubSpot
    const handleConnectHubspot = async () => {
      try {
        const workflowId = window.location.pathname.includes('/fullWorkflows/')
          ? window.location.pathname.split('/fullWorkflows/')[1]?.split('/')[0]
          : null;
        const returnUrl = workflowId
          ? `/fullWorkflows/${workflowId}`
          : '/fullWorkflows';
        const url = `/api/integrations/hubspot/auth?returnUrl=${encodeURIComponent(returnUrl)}${workflowId ? `&workflowId=${workflowId}` : ''}`;

        const res = await fetchWithCSRF(url);
        if (!res.ok) {
          const data = await res
            .json()
            .catch(() => ({ error: 'Failed to start OAuth' }));
          throw new Error(data.error || 'Failed to start OAuth');
        }
        const data = await res.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
        } else {
          alert('Failed to get auth URL');
        }
      } catch (e) {
        console.error('Error connecting HubSpot:', e);
        alert(e.message || 'Failed to connect HubSpot');
      }
    };

    // Handle disconnect HubSpot
    const handleDisconnectHubspot = async () => {
      if (!confirm('Are you sure you want to disconnect HubSpot?')) {
        return;
      }
      try {
        const res = await fetchWithCSRF('/api/integrations/hubspot', {
          method: 'DELETE',
          credentials: 'include',
        });

        if (res.ok) {
          setHubspotConnected(false);
          setHubspotEmail(null);
          alert('HubSpot disconnected successfully');
          setTimeout(refreshHubspotStatus, 500);
        } else {
          let errorMessage = 'Failed to disconnect';
          try {
            const data = await res.json();
            errorMessage = data.error || data.message || errorMessage;
          } catch {
            errorMessage = res.statusText || `HTTP ${res.status}`;
          }
          throw new Error(errorMessage);
        }
      } catch (e) {
        console.error('Error disconnecting HubSpot:', e);
        alert(e.message || 'Failed to disconnect HubSpot');
      }
    };

    return (
      <>
        {/* HubSpot CRM Integration */}
        <div style={{ marginBottom: '2rem' }}>
          <div
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'white',
              marginBottom: '1rem',
            }}
          >
            HubSpot Connection
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: '#94a3b8',
              marginBottom: '1rem',
            }}
          >
            Connect your HubSpot account to manage contacts and leads
          </div>
          {checkingHubspot ? (
            <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
              Checking connection status...
            </div>
          ) : hubspotConnected ? (
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
              {hubspotEmail && (
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                    marginBottom: '0.5rem',
                  }}
                >
                  Account: {hubspotEmail}
                </div>
              )}
              <button
                onClick={handleDisconnectHubspot}
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
              onClick={handleConnectHubspot}
              style={{
                background: '#ff7a59',
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
              <span>Connect HubSpot</span>
            </button>
          )}
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

  if (nodeType === 'call-trigger') {
    return (
      <CallTriggerSettings
        nodeType={nodeType}
        localData={localData}
        handleUpdate={handleUpdate}
        knowledgeBaseEntries={knowledgeBaseEntries}
      />
    );
  }

  // Default: No settings available
  return (
    <div style={{ color: '#94a3b8' }}>
      No settings available for this node type
    </div>
  );
}

/**
 * Call Agent Settings Component
 */
function CallAgentSettings({
  nodeType,
  localData,
  handleUpdate,
  knowledgeBaseEntries,
}) {
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalEmail, setGcalEmail] = useState(null);
  const [checkingGcal, setCheckingGcal] = useState(true);
  const [gcalSettingsVisible, setGcalSettingsVisible] = useState(false);
  const [savingGcalSettings, setSavingGcalSettings] = useState(false);
  const [gcalSettings, setGcalSettings] = useState({
    timezone: '',
    minimumNoticeHours: '',
    maximumDaysAdvance: '',
    maximumDurationHours: '',
    mode: 'PERSONAL_ASSISTANT',
  });

  // Refresh Google Calendar status
  const refreshGcalStatus = async () => {
    try {
      setCheckingGcal(true);
      const res = await fetch('/api/integrations/google-calendar/status', {
        credentials: 'include',
      });
      if (!res.ok) {
        setGcalConnected(false);
        setGcalEmail(null);
        setGcalSettingsVisible(false);
        return;
      }
      const data = await res.json();
      if (data.connected) {
        setGcalConnected(true);
        setGcalEmail(data.email || null);
        setGcalSettingsVisible(true);
        setGcalSettings({
          timezone: data.timezone || '',
          minimumNoticeHours:
            data.minimumNoticeHours != null
              ? String(data.minimumNoticeHours)
              : '',
          maximumDaysAdvance:
            data.maximumDaysAdvance != null
              ? String(data.maximumDaysAdvance)
              : '',
          maximumDurationHours:
            data.maximumDurationHours != null
              ? String(data.maximumDurationHours)
              : '',
          mode: data.mode || 'PERSONAL_ASSISTANT',
        });
      } else {
        setGcalConnected(false);
        setGcalEmail(null);
        setGcalSettingsVisible(false);
      }
    } catch (e) {
      setGcalConnected(false);
      setGcalEmail(null);
      setGcalSettingsVisible(false);
    } finally {
      setCheckingGcal(false);
    }
  };

  // Handle connect Google Calendar
  const handleConnectGoogle = async () => {
    try {
      const res = await fetch('/api/integrations/google-calendar/auth', {
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({ error: 'Failed to start OAuth' }));
        throw new Error(data.error || 'Failed to start OAuth');
      }
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        alert('Failed to get auth URL');
      }
    } catch (e) {
      alert(e.message);
    }
  };

  // Handle disconnect Google Calendar
  const handleDisconnectGoogle = async () => {
    if (!confirm('Are you sure you want to disconnect Google Calendar?')) {
      return;
    }
    try {
      const res = await fetch('/api/integrations/google-calendar', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        setGcalConnected(false);
        setGcalEmail(null);
        alert('Google Calendar disconnected successfully');
        setTimeout(refreshGcalStatus, 500);
      } else {
        let errorMessage = 'Failed to disconnect';
        try {
          const data = await res.json();
          errorMessage = data.error || data.message || errorMessage;
        } catch {
          errorMessage = res.statusText || `HTTP ${res.status}`;
        }
        throw new Error(errorMessage);
      }
    } catch (e) {
      console.error('Error disconnecting Google Calendar:', e);
      alert(e.message || 'Failed to disconnect Google Calendar');
    }
  };

  const handleSaveGcalSettings = async () => {
    try {
      setSavingGcalSettings(true);
      const response = await fetchWithCSRF(
        '/api/integrations/google-calendar/settings',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timezone: gcalSettings.timezone || undefined,
            minimumNoticeHours: gcalSettings.minimumNoticeHours
              ? Number(gcalSettings.minimumNoticeHours)
              : undefined,
            maximumDaysAdvance: gcalSettings.maximumDaysAdvance
              ? Number(gcalSettings.maximumDaysAdvance)
              : undefined,
            maximumDurationHours: gcalSettings.maximumDurationHours
              ? Number(gcalSettings.maximumDurationHours)
              : undefined,
            mode: gcalSettings.mode || undefined,
          }),
        }
      );
      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({ error: 'Failed to save settings' }));
        throw new Error(data.error || 'Failed to save settings');
      }
      alert('Calendar settings saved successfully');
    } catch (error) {
      alert(error.message);
    } finally {
      setSavingGcalSettings(false);
    }
  };

  // Load Google Calendar status on mount
  useEffect(() => {
    refreshGcalStatus();
  }, []);

  // Handle URL params for Google Calendar callback
  useEffect(() => {
    if (window.location.search.includes('googleCalendar=connected')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('googleCalendar');
      window.history.replaceState({}, '', url);
      // Refresh status after a short delay to allow backend to process
      setTimeout(refreshGcalStatus, 500);
    }
  }, []);


  return (
    <>
      {/* Knowledge Base Configuration - Show for call-agent and call-trigger */}
      {(nodeType === 'call-agent' || nodeType === 'call-trigger') && (
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
                        background: isSelected
                          ? 'hsl(var(--accent))'
                          : 'hsl(var(--muted))',
                        border: `1px solid ${isSelected ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
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
      )}

      {/* Google Calendar Integration */}
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
          Google Calendar Connection
        </div>
        <div
          style={{
            fontSize: '0.75rem',
            color: '#94a3b8',
            marginBottom: '1rem',
          }}
        >
          Connect your Google Calendar to enable calendar tools in calls
        </div>
        {checkingGcal ? (
          <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            Checking connection status...
          </div>
        ) : gcalConnected ? (
          <div
            style={{
              padding: '1rem',
              background: '#2a2a2a',
              borderRadius: '8px',
              border: '1px solid #10b981',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
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
            {gcalEmail && (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                  marginBottom: '0.5rem',
                }}
              >
                Account: {gcalEmail}
              </div>
            )}
            <button
              onClick={handleDisconnectGoogle}
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
            onClick={handleConnectGoogle}
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
            <span>Connect Google Calendar</span>
          </button>
        )}

        {gcalSettingsVisible && (
          <div
            style={{
              marginTop: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <Label htmlFor="call-agent-gcal-timezone">Timezone</Label>
                <Input
                  id="call-agent-gcal-timezone"
                  placeholder="Europe/Berlin"
                  value={gcalSettings.timezone}
                  onChange={e =>
                    setGcalSettings({
                      ...gcalSettings,
                      timezone: e.target.value,
                    })
                  }
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <Label htmlFor="call-agent-gcal-min-notice">
                  Min notice (hours)
                </Label>
                <Input
                  id="call-agent-gcal-min-notice"
                  type="number"
                  min="0"
                  value={gcalSettings.minimumNoticeHours}
                  onChange={e =>
                    setGcalSettings({
                      ...gcalSettings,
                      minimumNoticeHours: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <Label htmlFor="call-agent-gcal-max-days">
                  Max days in advance
                </Label>
                <Input
                  id="call-agent-gcal-max-days"
                  type="number"
                  min="0"
                  value={gcalSettings.maximumDaysAdvance}
                  onChange={e =>
                    setGcalSettings({
                      ...gcalSettings,
                      maximumDaysAdvance: e.target.value,
                    })
                  }
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <Label htmlFor="call-agent-gcal-max-duration">
                  Max duration (hours)
                </Label>
                <Input
                  id="call-agent-gcal-max-duration"
                  type="number"
                  min="1"
                  value={gcalSettings.maximumDurationHours}
                  onChange={e =>
                    setGcalSettings({
                      ...gcalSettings,
                      maximumDurationHours: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              <Label htmlFor="call-agent-gcal-mode">Mode</Label>
              <Select
                value={gcalSettings.mode}
                onValueChange={value =>
                  setGcalSettings({
                    ...gcalSettings,
                    mode: value,
                  })
                }
              >
                <SelectTrigger id="call-agent-gcal-mode">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERSONAL_ASSISTANT">
                    Personal Assistant (can view, create, update, delete events)
                  </SelectItem>
                  <SelectItem value="MEETING_SCHEDULER">
                    Meeting Scheduler (can only create events)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleSaveGcalSettings}
              disabled={savingGcalSettings}
              style={{ alignSelf: 'flex-start' }}
            >
              {savingGcalSettings ? 'Saving...' : 'Save Calendar Settings'}
            </Button>
          </div>
        )}
      </div>


      {/* Email Credentials */}
      {(nodeType === 'call-agent' || nodeType === 'email') && (
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
            Email Credentials
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: '#94a3b8',
              marginBottom: '1rem',
            }}
          >
            Configure your SMTP credentials to enable email tools in calls
          </div>
          <EmailCredentialsManager
            localData={localData}
            handleUpdate={handleUpdate}
          />
        </div>
      )}

      {/* Twilio Credentials */}
      {(nodeType === 'call-trigger' || nodeType === 'call-agent') && (
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
            Twilio Credentials
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: '#94a3b8',
              marginBottom: '1rem',
            }}
          >
            Configure your Twilio credentials (Account SID, Auth Token). Phone
            numbers are configured per node.
          </div>
          <TwilioCredentialsManager
            localData={localData}
            handleUpdate={handleUpdate}
          />
          {/* From Phone Number (for call-agent only) */}
          {nodeType === 'call-agent' && (
            <div style={{ marginTop: '1.5rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                From Phone Number <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={localData.from_phone_number || ''}
                onChange={e =>
                  handleUpdate('from_phone_number', e.target.value)
                }
                placeholder="+1234567890"
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
                Your Twilio phone number (the number that will make the call) in
                E.164 format
              </div>
            </div>
          )}
        </div>
      )}

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

/**
 * Call Trigger Settings Component
 * Similar to CallAgentSettings but for call-trigger nodes
 */
function CallTriggerSettings({
  nodeType,
  localData,
  handleUpdate,
  knowledgeBaseEntries,
}) {
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalEmail, setGcalEmail] = useState(null);
  const [checkingGcal, setCheckingGcal] = useState(true);
  const [gcalSettingsVisible, setGcalSettingsVisible] = useState(false);
  const [savingGcalSettings, setSavingGcalSettings] = useState(false);
  const [gcalSettings, setGcalSettings] = useState({
    timezone: '',
    minimumNoticeHours: '',
    maximumDaysAdvance: '',
    maximumDurationHours: '',
    mode: 'PERSONAL_ASSISTANT',
  });

  // Refresh Google Calendar status
  const refreshGcalStatus = async () => {
    try {
      setCheckingGcal(true);
      const res = await fetch('/api/integrations/google-calendar/status', {
        credentials: 'include',
      });
      if (!res.ok) {
        setGcalConnected(false);
        setGcalEmail(null);
        setGcalSettingsVisible(false);
        return;
      }
      const data = await res.json();
      if (data.connected) {
        setGcalConnected(true);
        setGcalEmail(data.email || null);
        setGcalSettingsVisible(true);
        setGcalSettings({
          timezone: data.timezone || '',
          minimumNoticeHours:
            data.minimumNoticeHours != null
              ? String(data.minimumNoticeHours)
              : '',
          maximumDaysAdvance:
            data.maximumDaysAdvance != null
              ? String(data.maximumDaysAdvance)
              : '',
          maximumDurationHours:
            data.maximumDurationHours != null
              ? String(data.maximumDurationHours)
              : '',
          mode: data.mode || 'PERSONAL_ASSISTANT',
        });
      } else {
        setGcalConnected(false);
        setGcalEmail(null);
        setGcalSettingsVisible(false);
      }
    } catch (e) {
      setGcalConnected(false);
      setGcalEmail(null);
      setGcalSettingsVisible(false);
    } finally {
      setCheckingGcal(false);
    }
  };

  // Handle connect Google Calendar
  const handleConnectGoogle = async () => {
    try {
      const res = await fetch('/api/integrations/google-calendar/auth', {
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({ error: 'Failed to start OAuth' }));
        throw new Error(data.error || 'Failed to start OAuth');
      }
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        alert('Failed to get auth URL');
      }
    } catch (e) {
      alert(e.message);
    }
  };

  // Handle disconnect Google Calendar
  const handleDisconnectGoogle = async () => {
    if (!confirm('Are you sure you want to disconnect Google Calendar?')) {
      return;
    }
    try {
      const res = await fetch('/api/integrations/google-calendar', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        setGcalConnected(false);
        setGcalEmail(null);
        alert('Google Calendar disconnected successfully');
        setTimeout(refreshGcalStatus, 500);
      } else {
        let errorMessage = 'Failed to disconnect';
        try {
          const data = await res.json();
          errorMessage = data.error || data.message || errorMessage;
        } catch {
          errorMessage = res.statusText || `HTTP ${res.status}`;
        }
        throw new Error(errorMessage);
      }
    } catch (e) {
      console.error('Error disconnecting Google Calendar:', e);
      alert(e.message || 'Failed to disconnect Google Calendar');
    }
  };

  const handleSaveGcalSettings = async () => {
    try {
      setSavingGcalSettings(true);
      const response = await fetchWithCSRF(
        '/api/integrations/google-calendar/settings',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timezone: gcalSettings.timezone || undefined,
            minimumNoticeHours: gcalSettings.minimumNoticeHours
              ? Number(gcalSettings.minimumNoticeHours)
              : undefined,
            maximumDaysAdvance: gcalSettings.maximumDaysAdvance
              ? Number(gcalSettings.maximumDaysAdvance)
              : undefined,
            maximumDurationHours: gcalSettings.maximumDurationHours
              ? Number(gcalSettings.maximumDurationHours)
              : undefined,
            mode: gcalSettings.mode || undefined,
          }),
        }
      );
      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({ error: 'Failed to save settings' }));
        throw new Error(data.error || 'Failed to save settings');
      }
      alert('Calendar settings saved successfully');
    } catch (error) {
      alert(error.message);
    } finally {
      setSavingGcalSettings(false);
    }
  };

  // Load Google Calendar status on mount
  useEffect(() => {
    refreshGcalStatus();
  }, []);

  // Handle URL params for Google Calendar callback
  useEffect(() => {
    if (window.location.search.includes('googleCalendar=connected')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('googleCalendar');
      window.history.replaceState({}, '', url);
      setTimeout(refreshGcalStatus, 500);
    }
  }, []);

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
                      background: isSelected
                        ? 'hsl(var(--accent))'
                        : 'hsl(var(--muted))',
                      border: `1px solid ${isSelected ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
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

      {/* Phone Number */}
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
          Phone Number <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          type="text"
          value={localData.phone_number || ''}
          onChange={e => handleUpdate('phone_number', e.target.value)}
          placeholder="+1234567890"
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
            fontSize: '0.7rem',
            color: '#94a3b8',
            marginTop: '0.25rem',
          }}
        >
          Your Twilio phone number (the number that receives calls) in E.164
          format
        </div>
      </div>

      {/* Greeting */}
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
          Greeting <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <VariableAutocomplete
          value={localData.greeting || ''}
          onChange={e => handleUpdate('greeting', e.target.value)}
          availableVariables={[]}
          placeholder="Hello, how can I help you? (Agent speaks first)"
          multiline
        />
        <div
          style={{
            fontSize: '0.7rem',
            color: '#94a3b8',
            marginTop: '0.25rem',
          }}
        >
          Initial greeting message. The agent will speak this first when the
          call is answered.
        </div>
      </div>

      {/* Voice */}
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
          Voice
        </label>
        <select
          value={localData.voice || 'alloy'}
          onChange={e => handleUpdate('voice', e.target.value)}
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
          <option value="alloy">Alloy</option>
          <option value="echo">Echo</option>
          <option value="fable">Fable</option>
          <option value="onyx">Onyx</option>
          <option value="nova">Nova</option>
          <option value="shimmer">Shimmer</option>
        </select>
      </div>

      {/* Instructions */}
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
          Instructions
        </label>
        <VariableAutocomplete
          value={
            localData.instructions ||
            'You are a helpful voice assistant. Keep responses brief, natural, and conversational.'
          }
          onChange={e => handleUpdate('instructions', e.target.value)}
          availableVariables={[]}
          placeholder="System instructions for the agent..."
          multiline
        />
      </div>

      {/* Advanced Settings */}
      <div
        style={{
          marginTop: '1.5rem',
          paddingTop: '1.5rem',
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
          Advanced Settings
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
            Max Response Output Tokens (1-4096)
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
            <option value="required">Required</option>
            <option value="none">None</option>
          </select>
        </div>
      </div>

      {/* Google Calendar Integration - Same as CallAgentSettings */}
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
          Google Calendar Connection
        </div>
        <div
          style={{
            fontSize: '0.75rem',
            color: '#94a3b8',
            marginBottom: '1rem',
          }}
        >
          Connect your Google Calendar to enable calendar tools in calls
        </div>
        {checkingGcal ? (
          <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            Checking connection status...
          </div>
        ) : gcalConnected ? (
          <div
            style={{
              padding: '1rem',
              background: '#2a2a2a',
              borderRadius: '8px',
              border: '1px solid #10b981',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
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
            {gcalEmail && (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                  marginBottom: '0.5rem',
                }}
              >
                Account: {gcalEmail}
              </div>
            )}
            <button
              onClick={handleDisconnectGoogle}
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
            onClick={handleConnectGoogle}
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
            <span>Connect Google Calendar</span>
          </button>
        )}

        {gcalSettingsVisible && (
          <div
            style={{
              marginTop: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <Label htmlFor="call-trigger-gcal-timezone">Timezone</Label>
                <Input
                  id="call-trigger-gcal-timezone"
                  placeholder="Europe/Berlin"
                  value={gcalSettings.timezone}
                  onChange={e =>
                    setGcalSettings({
                      ...gcalSettings,
                      timezone: e.target.value,
                    })
                  }
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <Label htmlFor="call-trigger-gcal-min-notice">
                  Min notice (hours)
                </Label>
                <Input
                  id="call-trigger-gcal-min-notice"
                  type="number"
                  min="0"
                  value={gcalSettings.minimumNoticeHours}
                  onChange={e =>
                    setGcalSettings({
                      ...gcalSettings,
                      minimumNoticeHours: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <Label htmlFor="call-trigger-gcal-max-days">
                  Max days in advance
                </Label>
                <Input
                  id="call-trigger-gcal-max-days"
                  type="number"
                  min="0"
                  value={gcalSettings.maximumDaysAdvance}
                  onChange={e =>
                    setGcalSettings({
                      ...gcalSettings,
                      maximumDaysAdvance: e.target.value,
                    })
                  }
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <Label htmlFor="call-trigger-gcal-max-duration">
                  Max duration (hours)
                </Label>
                <Input
                  id="call-trigger-gcal-max-duration"
                  type="number"
                  min="1"
                  value={gcalSettings.maximumDurationHours}
                  onChange={e =>
                    setGcalSettings({
                      ...gcalSettings,
                      maximumDurationHours: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              <Label htmlFor="call-trigger-gcal-mode">Mode</Label>
              <Select
                value={gcalSettings.mode}
                onValueChange={value =>
                  setGcalSettings({
                    ...gcalSettings,
                    mode: value,
                  })
                }
              >
                <SelectTrigger id="call-trigger-gcal-mode">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERSONAL_ASSISTANT">
                    Personal Assistant (can view, create, update, delete events)
                  </SelectItem>
                  <SelectItem value="MEETING_SCHEDULER">
                    Meeting Scheduler (can only create events)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleSaveGcalSettings}
              disabled={savingGcalSettings}
              style={{ alignSelf: 'flex-start' }}
            >
              {savingGcalSettings ? 'Saving...' : 'Save Calendar Settings'}
            </Button>
          </div>
        )}
      </div>

      {/* Email Credentials */}
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
          Email Credentials
        </div>
        <div
          style={{
            fontSize: '0.75rem',
            color: '#94a3b8',
            marginBottom: '1rem',
          }}
        >
          Configure your SMTP credentials to enable email tools in calls
        </div>
        <EmailCredentialsManager
          localData={localData}
          handleUpdate={handleUpdate}
        />
      </div>

      {/* Twilio Credentials */}
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
          Twilio Credentials
        </div>
        <div
          style={{
            fontSize: '0.75rem',
            color: '#94a3b8',
            marginBottom: '1rem',
          }}
        >
          Configure your Twilio credentials (Account SID, Auth Token). Phone
          numbers are configured per node.
        </div>
        <TwilioCredentialsManager
          localData={localData}
          handleUpdate={handleUpdate}
        />
      </div>
    </>
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
            zIndex: 2000,
          }}
          onClick={() => !saving && setShowModal(false)}
        >
          <div
            style={{
              background: 'hsl(var(--card))',
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
