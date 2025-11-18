import { useState, useEffect, useRef } from 'react';
import { AudioCapture } from '../../../utils/openai-test/audio-capture.js';
import { AudioPlayback } from '../../../utils/openai-test/audio-playback.js';
import { TranscriptManager } from '../../../utils/openai-test/transcript.js';
import { WebSocketClient } from '../../../utils/openai-test/websocket-client.js';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { knowledgeBaseService } from '../../../services/knowledgeBase.service.js';

/**
 * Testing Tab Component for Call Agent Node
 * Provides real-time voice testing functionality similar to OpenAI Test Page
 */
export default function TestingTab({ localData, handleUpdate }) {
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

  // Module instances (useRef to persist across renders)
  const audioContextRef = useRef(null);
  const audioCaptureRef = useRef(null);
  const audioPlaybackRef = useRef(null);
  const transcriptRef = useRef(null);
  const wsClientRef = useRef(null);

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

  // Get config from localData with Knowledge Base integration (like Twilio backend)
  const getConfigFromLocalData = async () => {
    // Get prompt from localData (could be in prompt or instructions field)
    let prompt = localData?.prompt || localData?.instructions || '';

    // Load and integrate Knowledge Base entries if IDs are specified (like call-agent.handler.js)
    const kbIds = localData?.knowledge_base_ids || [];
    if (kbIds.length > 0) {
      try {
        // Fetch all knowledge base entries
        const allEntries = await knowledgeBaseService.fetchEntries();

        // Filter entries by selected IDs (like backend: inArray(knowledgeBaseEntries.id, kbIds))
        const selectedEntries = allEntries.filter(entry =>
          kbIds.includes(entry.id)
        );

        if (selectedEntries.length > 0) {
          // Format knowledge base entries exactly like backend (call-agent.handler.js line 155-157)
          const knowledgeBaseText = selectedEntries
            .map(entry => `**${entry.name}**:\n${entry.text}`)
            .join('\n\n');

          // Integrate knowledge base into prompt exactly like backend (call-agent.handler.js line 189-193)
          prompt = `${prompt}

KNOWLEDGE BASE:
${knowledgeBaseText}`;

          log(
            `📚 Loaded ${selectedEntries.length} knowledge base entries`,
            'success'
          );
        } else {
          log(`⚠️ No knowledge base entries found for selected IDs`, 'warning');
        }
      } catch (error) {
        console.error('Error loading knowledge base entries:', error);
        log(
          `⚠️ Failed to load knowledge base entries: ${error.message}`,
          'warning'
        );
      }
    }

    // Use prompt as instructions, or fallback to default
    const instructions =
      prompt ||
      'You are a helpful voice assistant. Keep responses brief, natural, and conversational.';

    return {
      voice: localData?.voice || 'alloy',
      temperature: parseFloat(localData?.temperature ?? 1.0),
      instructions: instructions,
      vad_threshold: parseFloat(localData?.vad_threshold ?? 0.5),
      max_response_output_tokens: parseInt(
        localData?.max_response_output_tokens ?? 4096
      ),
      tool_choice: localData?.tool_choice || 'auto',
      prefix_padding_ms: parseInt(localData?.prefix_padding_ms ?? 300),
      silence_duration_ms: parseInt(localData?.silence_duration_ms ?? 500),
      tools: [],
      accountEmail: localData?.accountEmail || '',
      emailPassword: localData?.emailPassword || '',
    };
  };

  // Initialize modules
  useEffect(() => {
    transcriptRef.current = new TranscriptManager(handleTranscriptUpdate);
    audioPlaybackRef.current = new AudioPlayback(
      log,
      () => audioContextRef.current
    );

    // Initial log messages
    log('🚀 Testing Tab loaded', 'success');
    log('💡 Click "Connect" to start a voice conversation', 'info');
  }, []);

  // Cleanup: Automatically disconnect when component unmounts (e.g., tab switch, node close)
  useEffect(() => {
    return () => {
      // This cleanup runs when component unmounts (tab switch, node close, etc.)
      // Use refs instead of state to ensure we have the latest values
      if (wsClientRef.current) {
        // Disconnect WebSocket
        try {
          wsClientRef.current.disconnect();
        } catch (error) {
          console.warn('Error disconnecting WebSocket on cleanup:', error);
        }
        wsClientRef.current = null;
      }

      // Stop audio capture
      if (audioCaptureRef.current) {
        try {
          // Clear checkSocket interval if it exists
          if (audioCaptureRef.current._checkSocketInterval) {
            clearInterval(audioCaptureRef.current._checkSocketInterval);
          }
          audioCaptureRef.current.stop();
        } catch (error) {
          console.warn('Error stopping audio capture on cleanup:', error);
        }
        audioCaptureRef.current = null;
      }

      // Clear audio playback and transcript
      try {
        audioPlaybackRef.current?.clear();
        transcriptRef.current?.resetAssistant();
        transcriptRef.current?.resetUser();
      } catch (error) {
        console.warn('Error clearing playback/transcript on cleanup:', error);
      }
    };
  }, []); // Empty dependencies - cleanup only runs on unmount

  // Scroll log to bottom when new entries are added
  useEffect(() => {
    if (logContentRef.current) {
      logContentRef.current.scrollTop = logContentRef.current.scrollHeight;
    }
  }, [logEntries]);

  // Handle connect
  const handleConnect = async () => {
    // Prevent multiple connections
    if (isConnected || wsClientRef.current) {
      log('⚠️ Already connected. Please disconnect first.', 'warning');
      return;
    }

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

      // Connect WebSocket with config from localData (async to load Knowledge Base)
      // getConfigFromLocalData is now async, so we need to await it and pass as function
      const config = await getConfigFromLocalData();
      wsClientRef.current.connect(() => config);

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
      updateButtons(false); // Ensure button state is reset on error
    }
  };

  // Handle disconnect
  const handleDisconnect = () => {
    // Prevent disconnect if already disconnected
    if (!isConnected && !wsClientRef.current) {
      return;
    }

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
    updateStatus('Disconnected', 'disconnected');
    updateButtons(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: '1rem',
      }}
    >
      {/* Status and Connection Controls */}
      <div
        style={{
          padding: '1rem',
          background: 'hsl(var(--muted))',
          borderRadius: '8px',
          border: '1px solid hsl(var(--border))',
        }}
      >
        <div
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: status.className === 'connected' ? '#10b981' : '#ef4444',
            marginBottom: '0.75rem',
          }}
        >
          {status.text}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button
            size="sm"
            onClick={handleConnect}
            disabled={isConnected}
            variant="default"
          >
            🔌 Connect
          </Button>
          <Button
            size="sm"
            onClick={handleDisconnect}
            disabled={!isConnected}
            variant="outline"
          >
            Disconnect
          </Button>
        </div>
      </div>

      {/* Logs Section */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          background: 'hsl(var(--muted))',
          borderRadius: '8px',
          border: '1px solid hsl(var(--border))',
        }}
      >
        <div
          style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid hsl(var(--border))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'hsl(var(--foreground))',
            }}
          >
            Logs
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setLogEntries([])}
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
          >
            Clear
          </Button>
        </div>
        <div
          ref={logContentRef}
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '0.75rem',
            fontSize: '0.75rem',
            fontFamily: 'monospace',
            color: 'hsl(var(--foreground))',
          }}
        >
          {logEntries.length === 0 ? (
            <div
              style={{
                color: 'hsl(var(--muted-foreground))',
                fontStyle: 'italic',
              }}
            >
              No logs yet. Connect to start logging.
            </div>
          ) : (
            logEntries.map(entry => (
              <div
                key={entry.id}
                style={{
                  marginBottom: '0.5rem',
                  color:
                    entry.type === 'error'
                      ? '#ef4444'
                      : entry.type === 'success'
                        ? '#10b981'
                        : 'hsl(var(--foreground))',
                }}
              >
                {entry.message}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Transcript Section */}
      {showTranscript && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            background: 'hsl(var(--muted))',
            borderRadius: '8px',
            border: '1px solid hsl(var(--border))',
          }}
        >
          <div
            style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid hsl(var(--border))',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <MessageSquare className="w-4 h-4" />
              Conversation
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowTranscript(false)}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
            >
              Hide
            </Button>
          </div>
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '0.75rem',
            }}
          >
            {transcriptEntries.length === 0 ? (
              <div
                style={{
                  color: 'hsl(var(--muted-foreground))',
                  fontStyle: 'italic',
                  fontSize: '0.875rem',
                }}
              >
                No conversation yet.
              </div>
            ) : (
              transcriptEntries.map(entry => (
                <div
                  key={entry.id}
                  style={{
                    marginBottom: '0.75rem',
                    padding: '0.75rem',
                    background:
                      entry.speaker === 'user'
                        ? 'hsl(var(--accent))'
                        : 'hsl(var(--card))',
                    borderRadius: '6px',
                    border: '1px solid hsl(var(--border))',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'hsl(var(--muted-foreground))',
                      marginBottom: '0.25rem',
                    }}
                  >
                    {entry.speaker === 'user' ? '👤 You' : '🤖 Assistant'}
                  </div>
                  <div
                    style={{
                      fontSize: '0.875rem',
                      color: 'hsl(var(--foreground))',
                    }}
                  >
                    {entry.text}
                  </div>
                  <div
                    style={{
                      fontSize: '0.7rem',
                      color: 'hsl(var(--muted-foreground))',
                      marginTop: '0.25rem',
                    }}
                  >
                    {entry.timestamp}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Show Transcript Button */}
      {!showTranscript && transcriptEntries.length > 0 && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowTranscript(true)}
          style={{ width: '100%' }}
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          Show Conversation ({transcriptEntries.length} messages)
        </Button>
      )}
    </div>
  );
}
