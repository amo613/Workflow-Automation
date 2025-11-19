import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchWithCSRF } from '../utils/csrf.utils.js';
import {
  Settings,
  Calendar,
  Mail,
  FileSpreadsheet,
  Key,
  Phone,
} from 'lucide-react';
import './OpenAITestPage.css';

function OpenAITestPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('account');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workflows, setWorkflows] = useState([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(true);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
  });

  // Integrations state
  const [integrations, setIntegrations] = useState({
    googleCalendar: { connected: false, email: null },
    googleSheets: { connected: false, email: null },
    email: { configured: false },
    twilio: { configured: false },
  });

  // API Keys state
  const [apiKeys, setApiKeys] = useState({
    openai: { hasKey: false, checking: true },
  });

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to fetch user');
        const data = await response.json();
        setUser(data.user);
        setProfileForm({
          name: data.user.name || '',
          email: data.user.email || '',
        });
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  // Fetch recent workflows
  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        setWorkflowsLoading(true);
        const response = await fetch('/api/full-workflows', {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to fetch workflows');
        const data = await response.json();
        // Get last 5 workflows, sorted by updated_at
        const recent = (data.data || [])
          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
          .slice(0, 5);
        setWorkflows(recent);
      } catch (error) {
        console.error('Error fetching workflows:', error);
      } finally {
        setWorkflowsLoading(false);
      }
    };

    fetchWorkflows();
  }, []);

  // Fetch integrations status
  useEffect(() => {
    const fetchIntegrations = async () => {
      // Google Calendar
      try {
        const gcalRes = await fetch(
          '/api/integrations/google-calendar/status',
          { credentials: 'include' }
        );
        if (gcalRes.ok) {
          const gcalData = await gcalRes.json();
          setIntegrations(prev => ({
            ...prev,
            googleCalendar: {
              connected: gcalData.connected || false,
              email: gcalData.email || null,
            },
          }));
        }
      } catch (error) {
        console.error('Error fetching Google Calendar status:', error);
      }

      // Google Sheets
      try {
        const sheetsRes = await fetch(
          '/api/integrations/google-sheets/status',
          {
            credentials: 'include',
          }
        );
        if (sheetsRes.ok) {
          const sheetsData = await sheetsRes.json();
          setIntegrations(prev => ({
            ...prev,
            googleSheets: {
              connected: sheetsData.connected || false,
              email: sheetsData.email || null,
            },
          }));
        }
      } catch (error) {
        console.error('Error fetching Google Sheets status:', error);
      }

      // Twilio
      try {
        const twilioRes = await fetch('/api/twilio/credentials/check', {
          credentials: 'include',
        });
        if (twilioRes.ok) {
          const twilioData = await twilioRes.json();
          setIntegrations(prev => ({
            ...prev,
            twilio: {
              configured: twilioData.hasCredentials || false,
            },
          }));
        }
      } catch (error) {
        console.error('Error fetching Twilio status:', error);
      }
    };

    fetchIntegrations();
  }, []);

  // Check API keys
  useEffect(() => {
    const checkApiKeys = async () => {
      try {
        const response = await fetch('/api/ai-agent/api-key/check', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setApiKeys(prev => ({
            ...prev,
            openai: { hasKey: data.hasApiKey || false, checking: false },
          }));
        }
      } catch (error) {
        console.error('Error checking API keys:', error);
        setApiKeys(prev => ({
          ...prev,
          openai: { hasKey: false, checking: false },
        }));
      }
    };

    checkApiKeys();
  }, []);

  const handleProfileUpdate = async e => {
    e.preventDefault();
    if (!user) return;

    try {
      const updates = {};
      if (profileForm.name !== user.name) updates.name = profileForm.name;
      if (profileForm.email !== user.email) updates.email = profileForm.email;

      if (Object.keys(updates).length === 0) {
        alert('No changes to save');
        return;
      }

      const response = await fetchWithCSRF(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update profile');
      }

      alert('Profile updated successfully');
      // Refresh user data
      const userRes = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData.user);
        setProfileForm({
          name: userData.user.name || '',
          email: userData.user.email || '',
        });
      }
    } catch (error) {
      alert(error.message || 'Failed to update profile');
    }
  };

  const handleConnectGoogleCalendar = async () => {
    try {
      const res = await fetch('/api/integrations/google-calendar/auth', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to start OAuth');
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      alert(error.message || 'Failed to connect Google Calendar');
    }
  };

  const handleConnectGoogleSheets = async () => {
    try {
      const res = await fetch('/api/integrations/google-sheets/auth', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to start OAuth');
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      alert(error.message || 'Failed to connect Google Sheets');
    }
  };

  // Handle URL params for OAuth callbacks
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('googleCalendar') || urlParams.has('googleSheets')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('googleCalendar');
      url.searchParams.delete('googleSheets');
      window.history.replaceState({}, '', url);
      // Refresh integrations after a delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }, []);

  if (loading) {
    return (
      <div className="dashboard-container">
        <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-content">
        {/* Header */}
        <div className="dashboard-header">
          <h1>Dashboard</h1>
        </div>

        {/* Main Grid */}
        <div className="dashboard-grid">
          {/* Profile Section */}
          <div className="dashboard-card profile-card">
            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                color: '#10b981',
                marginBottom: '1.5rem',
              }}
            >
              Hallo {user?.name || 'User'}
            </div>

            {/* Tabs */}
            <div className="profile-tabs">
              <button
                className={activeTab === 'account' ? 'active' : ''}
                onClick={() => setActiveTab('account')}
              >
                Account
              </button>
              <button
                className={activeTab === 'api-keys' ? 'active' : ''}
                onClick={() => setActiveTab('api-keys')}
              >
                API Keys
              </button>
              <button
                className={activeTab === 'integrations' ? 'active' : ''}
                onClick={() => setActiveTab('integrations')}
              >
                Integrations
              </button>
            </div>

            {/* Tab Content */}
            <div className="profile-tab-content">
              {activeTab === 'account' && (
                <form onSubmit={handleProfileUpdate}>
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      value={profileForm.name}
                      onChange={e =>
                        setProfileForm({ ...profileForm, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={e =>
                        setProfileForm({
                          ...profileForm,
                          email: e.target.value,
                        })
                      }
                    />
                  </div>
                  <p
                    style={{
                      fontSize: '0.875rem',
                      color: '#64748b',
                      marginTop: '1rem',
                    }}
                  >
                    To change your password, please contact support or use the
                    sign-in page.
                  </p>
                  <button type="submit" className="btn-primary">
                    Save Changes
                  </button>
                </form>
              )}

              {activeTab === 'api-keys' && (
                <div>
                  <div className="integration-item">
                    <div className="integration-header">
                      <Key size={20} />
                      <span>OpenAI API Key</span>
                      <span
                        className={
                          apiKeys.openai.hasKey
                            ? 'status-badge success'
                            : 'status-badge error'
                        }
                      >
                        {apiKeys.openai.checking
                          ? 'Checking...'
                          : apiKeys.openai.hasKey
                            ? '✓ Set'
                            : '✗ Not Set'}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: '0.875rem',
                        color: '#64748b',
                        marginTop: '0.5rem',
                      }}
                    >
                      Your personal OpenAI API key for AI Agent nodes
                    </p>
                    <button
                      className="btn-secondary"
                      onClick={() => navigate('/fullWorkflows')}
                      style={{ marginTop: '1rem' }}
                    >
                      {apiKeys.openai.hasKey ? 'Update Key' : 'Set API Key'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'integrations' && (
                <div>
                  {/* Google Calendar */}
                  <div className="integration-item">
                    <div className="integration-header">
                      <Calendar size={20} />
                      <span>Google Calendar</span>
                      <span
                        className={
                          integrations.googleCalendar.connected
                            ? 'status-badge success'
                            : 'status-badge error'
                        }
                      >
                        {integrations.googleCalendar.connected
                          ? '✓ Connected'
                          : '✗ Disconnected'}
                      </span>
                    </div>
                    {integrations.googleCalendar.email && (
                      <p
                        style={{
                          fontSize: '0.875rem',
                          color: '#64748b',
                          marginTop: '0.5rem',
                        }}
                      >
                        Account: {integrations.googleCalendar.email}
                      </p>
                    )}
                    <button
                      className="btn-secondary"
                      onClick={handleConnectGoogleCalendar}
                      style={{ marginTop: '1rem' }}
                    >
                      {integrations.googleCalendar.connected
                        ? 'Manage'
                        : 'Connect Google Calendar'}
                    </button>
                  </div>

                  {/* Google Sheets */}
                  <div
                    className="integration-item"
                    style={{ marginTop: '1.5rem' }}
                  >
                    <div className="integration-header">
                      <FileSpreadsheet size={20} />
                      <span>Google Sheets</span>
                      <span
                        className={
                          integrations.googleSheets.connected
                            ? 'status-badge success'
                            : 'status-badge error'
                        }
                      >
                        {integrations.googleSheets.connected
                          ? '✓ Connected'
                          : '✗ Disconnected'}
                      </span>
                    </div>
                    {integrations.googleSheets.email && (
                      <p
                        style={{
                          fontSize: '0.875rem',
                          color: '#64748b',
                          marginTop: '0.5rem',
                        }}
                      >
                        Account: {integrations.googleSheets.email}
                      </p>
                    )}
                    <button
                      className="btn-secondary"
                      onClick={handleConnectGoogleSheets}
                      style={{ marginTop: '1rem' }}
                    >
                      {integrations.googleSheets.connected
                        ? 'Manage'
                        : 'Connect Google Sheets'}
                    </button>
                  </div>

                  {/* Email */}
                  <div
                    className="integration-item"
                    style={{ marginTop: '1.5rem' }}
                  >
                    <div className="integration-header">
                      <Mail size={20} />
                      <span>Email Credentials</span>
                      <span className="status-badge info">
                        Configure in Workflows
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: '0.875rem',
                        color: '#64748b',
                        marginTop: '0.5rem',
                      }}
                    >
                      Configure email credentials in Call Agent node settings
                    </p>
                    <button
                      className="btn-secondary"
                      onClick={() => navigate('/fullWorkflows')}
                      style={{ marginTop: '1rem' }}
                    >
                      Go to Workflows
                    </button>
                  </div>

                  {/* Twilio */}
                  <div
                    className="integration-item"
                    style={{ marginTop: '1.5rem' }}
                  >
                    <div className="integration-header">
                      <Phone size={20} />
                      <span>Twilio</span>
                      <span
                        className={
                          integrations.twilio.configured
                            ? 'status-badge success'
                            : 'status-badge error'
                        }
                      >
                        {integrations.twilio.configured
                          ? '✓ Configured'
                          : '✗ Not Configured'}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: '0.875rem',
                        color: '#64748b',
                        marginTop: '0.5rem',
                      }}
                    >
                      Configure Twilio credentials in Call Agent or Call Trigger
                      node settings
                    </p>
                    <button
                      className="btn-secondary"
                      onClick={() => navigate('/fullWorkflows')}
                      style={{ marginTop: '1rem' }}
                    >
                      Go to Workflows
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent Workflows Section */}
          <div className="dashboard-card workflows-card">
            <div className="card-header">
              <h2>Recent Workflows</h2>
              <Link to="/fullWorkflows" className="btn-link">
                View All →
              </Link>
            </div>
            {workflowsLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                Loading...
              </div>
            ) : workflows.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '2rem',
                  color: '#64748b',
                }}
              >
                No workflows yet. Create your first workflow!
              </div>
            ) : (
              <div className="workflows-list">
                {workflows.map(workflow => (
                  <div
                    key={workflow.id}
                    className="workflow-item"
                    onClick={() => navigate(`/fullWorkflows/${workflow.id}`)}
                  >
                    <div className="workflow-name">
                      {workflow.name || 'Unnamed Workflow'}
                    </div>
                    <div className="workflow-meta">
                      <span>
                        Updated:{' '}
                        {new Date(workflow.updated_at).toLocaleDateString()}
                      </span>
                      <span
                        className={
                          workflow.is_active
                            ? 'status-badge success'
                            : 'status-badge'
                        }
                      >
                        {workflow.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OpenAITestPage;
