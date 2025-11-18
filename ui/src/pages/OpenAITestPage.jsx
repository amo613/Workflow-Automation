import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AudioCapture } from '../utils/openai-test/audio-capture.js';
import { AudioPlayback } from '../utils/openai-test/audio-playback.js';
import { TranscriptManager } from '../utils/openai-test/transcript.js';
import { WebSocketClient } from '../utils/openai-test/websocket-client.js';
import { ConfigManager } from '../utils/openai-test/config.js';
import { CallManager } from '../utils/openai-test/call.js';
import { fetchWithCSRF } from '../utils/csrf.utils.js';
import { Settings, Lightbulb, MessageSquare } from 'lucide-react';
import './OpenAITestPage.css';

function OpenAITestPage() {
  // Status and connection state
  const [status, setStatus] = useState({
    text: 'Disconnected - Click Connect to start',
    className: 'disconnected',
  });
  const [isConnected, setIsConnected] = useState(false);

  // Log entries
  const [logEntries, setLogEntries] = useState([]);
  const logContentRef = useRef(null);

  // Transcript entries
  const [transcriptEntries, setTranscriptEntries] = useState([]);
  const [showTranscript, setShowTranscript] = useState(false);

  // Config state
  const [configExpanded, setConfigExpanded] = useState(false);
  const [formValues, setFormValues] = useState({
    voice: 'alloy',
    temperature: '1.0',
    instructions:
      'You are a helpful voice assistant. Keep responses brief, natural, and conversational.',
    vad_threshold: '0.5',
    max_response_output_tokens: '4096',
    tool_choice: 'auto',
    prefix_padding_ms: '300',
    silence_duration_ms: '500',
    tool_web_search: false,
    accountEmail: '',
    emailPassword: '',
  });
  const [workflowPrompt, setWorkflowPrompt] = useState('');

  // Call state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isCalling, setIsCalling] = useState(false);
  const [callButtonText, setCallButtonText] = useState('Make Call');

  // Google Calendar state
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalSettingsVisible, setGcalSettingsVisible] = useState(false);
  const [gcalSettings, setGcalSettings] = useState({
    timezone: '',
    minimumNoticeHours: '',
    maximumDaysAdvance: '',
    maximumDurationHours: '',
    mode: 'PERSONAL_ASSISTANT',
  });

  // Module instances (useRef to persist across renders)
  const audioContextRef = useRef(null);
  const audioCaptureRef = useRef(null);
  const audioPlaybackRef = useRef(null);
  const transcriptRef = useRef(null);
  const wsClientRef = useRef(null);
  const configManagerRef = useRef(null);
  const callManagerRef = useRef(null);

  // Logger function
  const log = (msg, type = 'info') => {
    const entry = {
      id: Date.now() + Math.random(),
      message: `[${new Date().toLocaleTimeString()}] ${msg}`,
      type,
    };
    setLogEntries(prev => [...prev, entry]);
    console.log(msg);
  };

  // Update status
  const updateStatus = (text, className) => {
    setStatus({ text, className });
  };

  // Update buttons
  const updateButtons = connected => {
    setIsConnected(connected);
  };

  // Transcript update callback
  const handleTranscriptUpdate = entries => {
    setTranscriptEntries(entries);
  };

  // Config loaded callback
  const handleConfigLoaded = (config, workflowPromptValue) => {
    setFormValues({
      voice: config.voice || 'alloy',
      temperature: String(config.temperature || 1.0),
      instructions:
        config.instructions ||
        'You are a helpful voice assistant. Keep responses brief, natural, and conversational.',
      vad_threshold: String(config.vad_threshold || 0.5),
      max_response_output_tokens: String(
        config.max_response_output_tokens || 4096
      ),
      tool_choice: config.tool_choice || 'auto',
      prefix_padding_ms: String(config.prefix_padding_ms || 300),
      silence_duration_ms: String(config.silence_duration_ms || 500),
      tool_web_search: config.tools?.some(t => t.type === 'function') || false,
      accountEmail: config.accountEmail || '',
      emailPassword: config.emailPassword || '',
    });
    setWorkflowPrompt(workflowPromptValue || '');
  };

  // Call state change callback
  const handleCallStateChange = (calling, buttonText) => {
    setIsCalling(calling);
    setCallButtonText(buttonText);
  };

  // Google Calendar functions
  const refreshGcalStatus = async () => {
    try {
      const res = await fetch('/api/integrations/google-calendar/status', {
        credentials: 'include',
      });
      if (!res.ok) {
        setGcalConnected(false);
        setGcalSettingsVisible(false);
        return;
      }
      const data = await res.json();
      if (data.connected) {
        setGcalConnected(true);
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
        setGcalSettingsVisible(false);
      }
    } catch (e) {
      setGcalConnected(false);
      setGcalSettingsVisible(false);
    }
  };

  // Initialize modules
  useEffect(() => {
    transcriptRef.current = new TranscriptManager(handleTranscriptUpdate);
    audioPlaybackRef.current = new AudioPlayback(
      log,
      () => audioContextRef.current
    );
    configManagerRef.current = new ConfigManager(log, handleConfigLoaded);

    // Load default config
    configManagerRef.current.loadDefault();

    // Load Google Calendar status
    refreshGcalStatus();

    // Initial log messages
    log('🚀 OpenAI Realtime API Test UI loaded', 'success');
    log('💡 Click "Connect" to start a voice conversation with GPT', 'info');
  }, []);

  // Update callManager when formValues change
  useEffect(() => {
    if (configManagerRef.current) {
      callManagerRef.current = new CallManager(
        log,
        () => configManagerRef.current.getFromForm(formValues),
        handleCallStateChange
      );
    }
  }, [formValues]);

  // Scroll log to bottom when new entries are added
  useEffect(() => {
    if (logContentRef.current) {
      logContentRef.current.scrollTop = logContentRef.current.scrollHeight;
    }
  }, [logEntries]);

  // Handle connect
  const handleConnect = async () => {
    try {
      // Create audio capture instance
      audioCaptureRef.current = new AudioCapture(null, log);

      // Create WebSocket client
      wsClientRef.current = new WebSocketClient(
        log,
        updateStatus,
        updateButtons,
        audioCaptureRef.current,
        audioPlaybackRef.current,
        transcriptRef.current
      );

      // Connect WebSocket
      wsClientRef.current.connect(() =>
        configManagerRef.current.getFromForm(formValues)
      );

      // After socket is created, update audioCapture reference and audioContext
      const checkSocket = setInterval(() => {
        const socket = wsClientRef.current?.getSocket();
        if (socket && audioCaptureRef.current) {
          audioCaptureRef.current.socket = socket;
          audioContextRef.current = audioCaptureRef.current.getAudioContext();
          clearInterval(checkSocket);
        }
      }, 100);

      // Store interval ID for cleanup on disconnect
      audioCaptureRef.current._checkSocketInterval = checkSocket;
    } catch (error) {
      log(`❌ Connection error: ${error.message}`, 'error');
    }
  };

  // Handle disconnect
  const handleDisconnect = () => {
    if (wsClientRef.current) {
      wsClientRef.current.disconnect();
      wsClientRef.current = null;
    }
    if (audioCaptureRef.current) {
      // Clear checkSocket interval if it exists
      if (audioCaptureRef.current._checkSocketInterval) {
        clearInterval(audioCaptureRef.current._checkSocketInterval);
      }
      audioCaptureRef.current.stop();
      audioCaptureRef.current = null;
    }
    audioPlaybackRef.current?.clear();
    transcriptRef.current?.resetAssistant();
    transcriptRef.current?.resetUser();
  };

  // Handle save config
  const handleSaveConfig = async () => {
    if (configManagerRef.current) {
      await configManagerRef.current.save(formValues);
    }
  };

  // Handle make call
  const handleMakeCall = () => {
    if (callManagerRef.current) {
      callManagerRef.current.makeCall(phoneNumber);
    } else if (configManagerRef.current) {
      // Create callManager if it doesn't exist
      callManagerRef.current = new CallManager(
        log,
        () => configManagerRef.current.getFromForm(formValues),
        handleCallStateChange
      );
      callManagerRef.current.makeCall(phoneNumber);
    }
  };

  // Handle phone number keypress
  const handlePhoneKeyPress = e => {
    if (e.key === 'Enter') {
      handleMakeCall();
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

  const handleSaveGcalSettings = async () => {
    try {
      const res = await fetchWithCSRF(
        '/api/integrations/google-calendar/settings',
        {
          method: 'PUT',
          credentials: 'include',
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
      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({ error: 'Failed to save' }));
        throw new Error(data.error || 'Failed to save');
      }
      alert('Saved');
    } catch (e) {
      alert(e.message);
    }
  };

  // Refresh Google Calendar status on mount and after delay
  useEffect(() => {
    refreshGcalStatus();
    const timer = setTimeout(refreshGcalStatus, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Handle URL params for Google Calendar callback
  useEffect(() => {
    if (window.location.search.includes('googleCalendar=connected')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('googleCalendar');
      window.history.replaceState({}, '', url);
      refreshGcalStatus();
    }
  }, []);

  return (
    <div className="openai-test-container">
      <div className="openai-test-content">
        <h1>OpenAI Realtime Voice Assistant</h1>
        <div className={`status ${status.className}`}>{status.text}</div>
        <button
          className="btn-connect"
          onClick={handleConnect}
          disabled={isConnected}
        >
          🔌 Connect & Start Conversation
        </button>
        <button
          className="btn-disconnect"
          onClick={handleDisconnect}
          disabled={!isConnected}
        >
          Disconnect
        </button>

        <div className="call-section">
          <Link
            to="/fullWorkflows"
            style={{
              display: 'block',
              padding: '0.75rem 1.5rem',
              background: 'hsl(var(--secondary))',
              color: 'hsl(var(--secondary-foreground))',
              textDecoration: 'none',
              borderRadius: '0.5rem',
              textAlign: 'center',
              fontWeight: 500,
              border: '1px solid hsl(var(--border))',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'hsl(var(--accent))';
              e.currentTarget.style.borderColor = 'hsl(var(--primary))';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'hsl(var(--secondary))';
              e.currentTarget.style.borderColor = 'hsl(var(--border))';
            }}
          >
            <Settings className="w-4 h-4 mr-1" /> Workflow Builder
          </Link>
        </div>

        <div className="config-section">
          <h2
            onClick={() => setConfigExpanded(!configExpanded)}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            ⚙️ Configuration <span>{configExpanded ? '▲' : '▼'}</span>
          </h2>
          <div className={`config-content ${configExpanded ? 'expanded' : ''}`}>
            <div className="config-row">
              <div className="input-group">
                <label htmlFor="voice">Voice:</label>
                <select
                  id="voice"
                  value={formValues.voice}
                  onChange={e =>
                    setFormValues({ ...formValues, voice: e.target.value })
                  }
                >
                  <option value="alloy">Alloy</option>
                  <option value="echo">Echo</option>
                  <option value="fable">Fable</option>
                  <option value="onyx">Onyx</option>
                  <option value="nova">Nova</option>
                  <option value="shimmer">Shimmer</option>
                </select>
              </div>
              <div className="input-group">
                <label htmlFor="temperature">Temperature (0-2):</label>
                <input
                  type="number"
                  id="temperature"
                  min="0"
                  max="2"
                  step="0.1"
                  value={formValues.temperature}
                  onChange={e =>
                    setFormValues({
                      ...formValues,
                      temperature: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="config-row full">
              <div className="input-group">
                <label htmlFor="workflowPrompt">
                  Active Workflow Prompt (Read-only):
                </label>
                <textarea
                  id="workflowPrompt"
                  readOnly
                  placeholder="No active workflow. Create and activate a workflow in the Workflow Builder."
                  value={workflowPrompt}
                  style={{
                    backgroundColor: 'hsl(var(--muted))',
                    cursor: 'not-allowed',
                    color: 'hsl(var(--muted-foreground))',
                  }}
                />
              </div>
            </div>
            <div className="config-row full">
              <div className="input-group">
                <label htmlFor="instructions">
                  Instructions (System Prompt):
                </label>
                <textarea
                  id="instructions"
                  placeholder="You are a helpful voice assistant. Keep responses brief, natural, and conversational."
                  value={formValues.instructions}
                  onChange={e =>
                    setFormValues({
                      ...formValues,
                      instructions: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="config-row">
              <div className="input-group">
                <label htmlFor="vad_threshold">VAD Threshold (0-1):</label>
                <input
                  type="number"
                  id="vad_threshold"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formValues.vad_threshold}
                  onChange={e =>
                    setFormValues({
                      ...formValues,
                      vad_threshold: e.target.value,
                    })
                  }
                />
                <small
                  style={{
                    color: 'hsl(var(--muted-foreground))',
                    fontSize: '0.85em',
                    marginTop: '4px',
                    display: 'block',
                  }}
                >
                  Voice Activity Detection threshold
                </small>
              </div>
              <div className="input-group">
                <label htmlFor="max_response_output_tokens">
                  Max Response Tokens (1-4096):
                </label>
                <input
                  type="number"
                  id="max_response_output_tokens"
                  min="1"
                  max="4096"
                  value={formValues.max_response_output_tokens}
                  onChange={e =>
                    setFormValues({
                      ...formValues,
                      max_response_output_tokens: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="config-row">
              <div className="input-group">
                <label htmlFor="tool_choice">Tool Choice:</label>
                <select
                  id="tool_choice"
                  value={formValues.tool_choice}
                  onChange={e =>
                    setFormValues({
                      ...formValues,
                      tool_choice: e.target.value,
                    })
                  }
                >
                  <option value="auto">Auto</option>
                  <option value="none">None</option>
                  <option value="required">Required</option>
                </select>
              </div>
              <div className="input-group">
                <label htmlFor="prefix_padding_ms">Prefix Padding (ms):</label>
                <input
                  type="number"
                  id="prefix_padding_ms"
                  min="0"
                  value={formValues.prefix_padding_ms}
                  onChange={e =>
                    setFormValues({
                      ...formValues,
                      prefix_padding_ms: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="config-row">
              <div className="input-group">
                <label htmlFor="silence_duration_ms">
                  Silence Duration (ms):
                </label>
                <input
                  type="number"
                  id="silence_duration_ms"
                  min="0"
                  value={formValues.silence_duration_ms}
                  onChange={e =>
                    setFormValues({
                      ...formValues,
                      silence_duration_ms: e.target.value,
                    })
                  }
                />
              </div>
              <div className="input-group">
                <span
                  style={{
                    display: 'block',
                    marginBottom: '5px',
                    color: 'hsl(var(--foreground))',
                    fontWeight: 500,
                  }}
                >
                  Tools:
                </span>
                <div style={{ marginTop: '10px' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <input
                      type="checkbox"
                      id="tool_web_search"
                      checked={formValues.tool_web_search}
                      onChange={e =>
                        setFormValues({
                          ...formValues,
                          tool_web_search: e.target.checked,
                        })
                      }
                    />
                    <label
                      htmlFor="tool_web_search"
                      style={{ marginLeft: '8px', fontWeight: 'normal' }}
                    >
                      Web Search
                    </label>
                  </div>
                  <div>
                    <small
                      style={{
                        color: 'hsl(var(--muted-foreground))',
                        fontSize: '0.85em',
                      }}
                    >
                      Note: Tools must be configured server-side
                    </small>
                  </div>
                </div>
              </div>
            </div>
            <div className="config-row full">
              <div className="input-group">
                <label
                  htmlFor="accountEmail"
                  title="Get this from Gmail App Password settings"
                >
                  Account Email (Gmail):
                </label>
                <input
                  type="email"
                  id="accountEmail"
                  placeholder="your-email@gmail.com (optional - uses ENV if not provided)"
                  value={formValues.accountEmail}
                  onChange={e =>
                    setFormValues({
                      ...formValues,
                      accountEmail: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="config-row full">
              <div className="input-group">
                <label
                  htmlFor="emailPassword"
                  title="Get this from Gmail App Password settings (not your regular password)"
                >
                  Email Password (App Password):
                </label>
                <input
                  type="password"
                  id="emailPassword"
                  placeholder="Your Gmail App Password (optional - uses ENV if not provided)"
                  value={formValues.emailPassword}
                  onChange={e =>
                    setFormValues({
                      ...formValues,
                      emailPassword: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <button className="btn-save-config" onClick={handleSaveConfig}>
              Save Configuration
            </button>
          </div>
        </div>

        {showTranscript && (
          <div className="transcript-section">
            <h2>
              <MessageSquare className="w-4 h-4 mr-1" /> Conversation
            </h2>
            <div className="transcript-content">
              {transcriptEntries.map(entry => (
                <div
                  key={entry.id}
                  className={`transcript-entry ${entry.speaker}`}
                >
                  <div className="label">
                    {entry.speaker === 'user' ? '👤 You' : '🤖 Assistant'}
                  </div>
                  <div className="text">{entry.text}</div>
                  <div className="timestamp">{entry.timestamp}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="call-section">
          <h2>📞 Outbound Call (Twilio)</h2>
          <div className="input-group">
            <label htmlFor="phoneNumber">
              Phone Number(s) (E.164 format, e.g. +1234567890):
            </label>
            <input
              type="tel"
              id="phoneNumber"
              placeholder="+49123456789, +49987654321"
              pattern="^\+[1-9]\d{1,14}$"
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
              onKeyPress={handlePhoneKeyPress}
            />
            <small
              style={{
                color: 'hsl(var(--muted-foreground))',
                fontSize: '0.85em',
                marginTop: '4px',
                display: 'block',
              }}
            >
              <Lightbulb className="w-3 h-3 mr-1" /> Tip: Separate multiple
              numbers with commas (e.g., +49123456789, +49987654321) for bulk
              calls
            </small>
          </div>
          <button
            className="btn-call"
            onClick={handleMakeCall}
            disabled={isCalling}
          >
            {callButtonText}
          </button>
        </div>

        <div className="call-section">
          <h2>Google Calendar</h2>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '10px',
            }}
          >
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: gcalConnected
                  ? '#10b981'
                  : 'hsl(var(--destructive))',
              }}
            />
            <span>{gcalConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <button className="btn-connect" onClick={handleConnectGoogle}>
            Connect Google Calendar
          </button>
          {gcalSettingsVisible && (
            <div style={{ marginTop: '12px' }}>
              <div className="config-row">
                <div className="input-group">
                  <label htmlFor="gcalTz">Timezone</label>
                  <input
                    id="gcalTz"
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
                <div className="input-group">
                  <label htmlFor="gcalMinNotice">Min notice (hours)</label>
                  <input
                    id="gcalMinNotice"
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
              <div className="config-row">
                <div className="input-group">
                  <label htmlFor="gcalMaxDays">Max days in advance</label>
                  <input
                    id="gcalMaxDays"
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
                <div className="input-group">
                  <label htmlFor="gcalMaxDur">Max duration (hours)</label>
                  <input
                    id="gcalMaxDur"
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
              <div className="config-row full">
                <div className="input-group">
                  <label htmlFor="gcalMode">Mode</label>
                  <select
                    id="gcalMode"
                    value={gcalSettings.mode}
                    onChange={e =>
                      setGcalSettings({ ...gcalSettings, mode: e.target.value })
                    }
                  >
                    <option value="PERSONAL_ASSISTANT">
                      Personal Assistant (can view, create, update, delete
                      events)
                    </option>
                    <option value="MEETING_SCHEDULER">
                      Meeting Scheduler (can only create events)
                    </option>
                  </select>
                </div>
              </div>
              <button
                className="btn-save-config"
                onClick={handleSaveGcalSettings}
              >
                Save Calendar Settings
              </button>
            </div>
          )}
        </div>

        <div className="log">
          <h2>Log</h2>
          <div ref={logContentRef} className="log-content">
            {logEntries.map(entry => (
              <div key={entry.id} className={`log-entry ${entry.type}`}>
                {entry.message}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OpenAITestPage;
