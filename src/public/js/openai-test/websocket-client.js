/**
 * WebSocket Client Module
 * Handles WebSocket connection and message handling
 */

export class WebSocketClient {
  constructor(
    logFn,
    updateStatusFn,
    updateButtonsFn,
    audioCapture,
    audioPlayback,
    transcript
  ) {
    this.logFn = logFn;
    this.updateStatusFn = updateStatusFn;
    this.updateButtonsFn = updateButtonsFn;
    this.audioCapture = audioCapture;
    this.audioPlayback = audioPlayback;
    this.transcript = transcript;
    this.socket = null;
    this.connectionClosed = false;
    this.audioStartTime = null;
    this.lastUserInputTime = null;
  }

  setAudioCapture(audioCapture) {
    this.audioCapture = audioCapture;
  }

  async connect(getConfigFromForm) {
    try {
      this.logFn(
        '🔄 Connecting to OpenAI Realtime API via server proxy...',
        'info'
      );
      this.updateStatusFn('Connecting...', 'connecting');

      // Get current config and encode it
      const config = getConfigFromForm();
      const configParam = btoa(JSON.stringify(config));

      // Connect to our server WebSocket proxy with config
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/openai-realtime/connect?sessionId=test-${Date.now()}&config=${encodeURIComponent(configParam)}`;

      this.logFn('🔄 Creating WebSocket connection to server proxy...', 'info');
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => this.handleOpen();
      this.socket.onmessage = event => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (error) {
          this.logFn(`❌ Failed to parse message: ${error.message}`, 'error');
        }
      };
      this.socket.onerror = err => this.handleError(err);
      this.socket.onclose = e => this.handleClose(e);
    } catch (error) {
      this.logFn(`❌ Connection error: ${error.message}`, 'error');
      this.updateStatusFn('Connection Failed', 'disconnected');
      console.error('Connection error:', error);
    }
  }

  async handleOpen() {
    this.logFn('✅ Socket opened', 'success');
    this.updateStatusFn('Connected', 'connected');
    this.updateButtonsFn(true);

    // Start audio capture IMMEDIATELY
    try {
      await this.audioCapture.start();
      this.logFn('🎤 Audio streaming started - speak now!', 'success');
    } catch (error) {
      this.logFn(`❌ Failed to start audio capture: ${error.message}`, 'error');
      console.error('Audio capture error:', error);
    }
  }

  handleMessage(msg) {
    if (
      this.connectionClosed &&
      msg.type !== 'error' &&
      msg.type !== 'disconnected'
    ) {
      return;
    }

    // CRITICAL: Log all incoming messages for debugging
    if (
      msg.type?.includes('transcript') ||
      msg.type?.includes('response') ||
      msg.type?.includes('content')
    ) {
      console.log(`📥 Message received: ${msg.type}`, {
        hasResponseId: !!msg.response_id,
        responseId: msg.response_id,
        activeResponseId: this.audioPlayback.activeResponseId,
        hasDelta: !!msg.delta,
        hasTranscript: !!msg.transcript,
        deltaText: msg.delta?.text || msg.delta,
        transcript: msg.transcript,
        content: msg.content,
      });
    }

    switch (msg.type) {
      case 'connected':
        this.connectionClosed = false;
        this.audioStartTime = performance.now();
        this.logFn('✅ ' + (msg.message || 'Connected'), 'success');
        this.transcript.show();
        break;
      case 'disconnected':
        this.connectionClosed = true;
        this.audioCapture.stop();
        this.logFn('🔌 ' + (msg.reason || 'Disconnected'), 'info');
        break;
      case 'response.created':
        this.handleResponseCreated(msg);
        break;
      case 'response.output_item.added':
        this.handleResponseOutputItemAdded(msg);
        break;
      case 'response.output_audio.delta':
        this.handleResponseAudioDelta(msg);
        break;
      case 'response.output_audio.done':
        this.logFn('✅ Audio output complete', 'success');
        break;
      case 'response.output_audio_transcript.delta':
        this.handleResponseTranscriptDelta(msg);
        break;
      case 'response.output_audio_transcript.done':
        this.handleResponseTranscriptDone(msg);
        break;
      case 'response.content.done':
        this.handleResponseContentDone(msg);
        break;
      case 'response.content.delta':
        this.handleResponseContentDelta(msg);
        break;
      case 'response.done':
        this.handleResponseDone(msg);
        break;
      case 'input_audio_buffer.speech_started':
        this.lastUserInputTime = performance.now();
        this.logFn('🎤 Speech started', 'info');
        break;
      case 'input_audio_buffer.speech_stopped':
        this.logFn('🔇 Speech stopped detected', 'info');
        console.log('🔇 Speech stopped:', msg);
        break;
      case 'response.cancelled':
        this.logFn('⚠️ Response cancelled', 'warning');
        console.log('⚠️ Response cancelled:', {
          response_id: msg.response_id || msg.response?.id,
          status: msg.response?.status,
          status_details: msg.response?.status_details,
          reason: msg.response?.status_details?.reason,
        });
        break;
      case 'input_audio_buffer.committed':
        this.logFn('🎤 Speech committed', 'info');
        break;
      case 'input_audio_buffer.transcription.delta':
        if (msg.delta?.text) {
          this.transcript.updateUserInput(
            this.transcript.currentUserInput + msg.delta.text
          );
        }
        break;
      case 'input_audio_buffer.transcription.done':
        if (msg.transcript) {
          this.transcript.addUserInput(msg.transcript);
          this.logFn(`👤 You: ${msg.transcript}`, 'success');
        }
        break;
      case 'error':
        this.handleError(msg);
        break;
      default:
        // Only log important messages, not every event
        if (msg.type.includes('response') || msg.type.includes('error')) {
          this.logFn(`📥 Received: ${msg.type}`, 'info');
        }
    }
  }

  handleResponseCreated(msg) {
    const createdResponseId = msg.response_id || msg.response?.id;
    if (createdResponseId) {
      // CRITICAL: Set activeResponseId BEFORE clearing to prevent it from being nulled
      this.audioPlayback.setActiveResponseId(createdResponseId);
      this.audioPlayback.setCurrentResponseId(createdResponseId);
      // Clear queue but preserve activeResponseId (clear() doesn't clear it anymore)
      this.audioPlayback.clear();
      this.transcript.resetAssistant();
      this.logFn(`🔄 New response started: ${createdResponseId}`, 'info');
    } else {
      this.logFn('🔄 Response created, waiting for response_id...', 'info');
    }
  }

  handleResponseOutputItemAdded(msg) {
    if (
      msg.response_id &&
      (!this.audioPlayback.activeResponseId ||
        msg.response_id !== this.audioPlayback.activeResponseId)
    ) {
      // CRITICAL: Set activeResponseId BEFORE clearing to prevent it from being nulled
      this.audioPlayback.setActiveResponseId(msg.response_id);
      this.audioPlayback.setCurrentResponseId(msg.response_id);
      // Clear queue but preserve activeResponseId (clear() doesn't clear it anymore)
      this.audioPlayback.clear();
      this.transcript.resetAssistant();
      this.logFn(
        `🔄 New active response set from output_item.added: ${msg.response_id}`,
        'info'
      );
    }
  }

  handleResponseAudioDelta(msg) {
    if (!this.connectionClosed && msg.delta && msg.response_id) {
      if (
        !this.audioPlayback.activeResponseId ||
        msg.response_id !== this.audioPlayback.activeResponseId
      ) {
        // CRITICAL: Set activeResponseId BEFORE clearing to prevent it from being nulled
        this.audioPlayback.setActiveResponseId(msg.response_id);
        this.audioPlayback.setCurrentResponseId(msg.response_id);
        // Clear queue but preserve activeResponseId (clear() doesn't clear it anymore)
        this.audioPlayback.clear();
        this.transcript.resetAssistant();
        this.logFn(
          `🔄 New active response set from audio.delta: ${msg.response_id}`,
          'info'
        );
      }

      // Now activeResponseId should be set correctly
      if (msg.response_id === this.audioPlayback.activeResponseId) {
        this.audioPlayback.queue(msg.delta, msg.response_id);
      } else {
        this.logFn(
          `⚠️ Ignoring audio from non-active response: ${msg.response_id} (active: ${this.audioPlayback.activeResponseId})`,
          'info'
        );
      }
    }
  }

  handleResponseTranscriptDelta(msg) {
    if (msg.response_id) {
      if (
        !this.audioPlayback.activeResponseId ||
        msg.response_id !== this.audioPlayback.activeResponseId
      ) {
        // CRITICAL: Set activeResponseId BEFORE clearing to prevent it from being nulled
        this.audioPlayback.setActiveResponseId(msg.response_id);
        this.audioPlayback.setCurrentResponseId(msg.response_id);
        // Clear queue but preserve activeResponseId (clear() doesn't clear it anymore)
        this.audioPlayback.clear();
        this.transcript.resetAssistant();
        this.logFn(
          `🔄 New active response set from transcript.delta: ${msg.response_id}`,
          'info'
        );
      }
    }

    if (
      msg.delta?.text &&
      msg.response_id &&
      msg.response_id === this.audioPlayback.activeResponseId
    ) {
      this.transcript.updateAssistantOutput(
        this.transcript.currentAssistantOutput + msg.delta.text
      );
    }
  }

  handleResponseTranscriptDone(msg) {
    if (msg.response_id) {
      if (
        !this.audioPlayback.activeResponseId ||
        msg.response_id !== this.audioPlayback.activeResponseId
      ) {
        // CRITICAL: Set activeResponseId BEFORE clearing to prevent it from being nulled
        this.audioPlayback.setActiveResponseId(msg.response_id);
        this.audioPlayback.setCurrentResponseId(msg.response_id);
        // Clear queue but preserve activeResponseId (clear() doesn't clear it anymore)
        this.audioPlayback.clear();
        this.transcript.resetAssistant();
        this.logFn(
          `🔄 New active response set from transcript.done: ${msg.response_id}`,
          'info'
        );
      }
    }

    if (
      msg.transcript &&
      msg.response_id &&
      msg.response_id === this.audioPlayback.activeResponseId
    ) {
      this.transcript.addAssistantOutput(msg.transcript);
      this.logFn(`🤖 Assistant: ${msg.transcript}`, 'success');
    }
  }

  handleResponseContentDone(msg) {
    const content = msg.content?.[0]?.text || msg.content?.text || '';
    if (content) {
      if (msg.response_id && !this.audioPlayback.activeResponseId) {
        this.audioPlayback.setActiveResponseId(msg.response_id);
        this.audioPlayback.setCurrentResponseId(msg.response_id);
        this.logFn(
          `🔄 Setting activeResponseId from content.done: ${msg.response_id}`,
          'info'
        );
      }
      this.transcript.addEntry('assistant', content);
      this.logFn(`🤖 Assistant: ${content}`, 'success');
    }
  }

  handleResponseContentDelta(msg) {
    if (msg.response_id && !this.audioPlayback.activeResponseId) {
      this.audioPlayback.setActiveResponseId(msg.response_id);
      this.audioPlayback.setCurrentResponseId(msg.response_id);
      this.logFn(
        `🔄 Setting activeResponseId from content.delta: ${msg.response_id}`,
        'info'
      );
    }

    const deltaText = msg.delta?.text || '';
    if (deltaText) {
      this.transcript.updateAssistantOutput(
        this.transcript.currentAssistantOutput + deltaText
      );
    }
  }

  handleResponseDone(msg) {
    const doneResponseId = msg.response_id || msg.response?.id;
    if (doneResponseId === this.audioPlayback.activeResponseId) {
      this.logFn(`✅ Response completed: ${doneResponseId}`, 'success');
      this.transcript.resetAssistant();
      // CRITICAL: Don't clear audioQueue or stop playback - let remaining chunks finish!
      // Only clear activeResponseId when response is done - this allows queue to continue playing
      this.audioPlayback.setActiveResponseId(null);
      this.audioPlayback.setCurrentResponseId(null);
      this.logFn(
        `📦 Audio queue still has ${this.audioPlayback.getQueueLength()} chunks to play`,
        'info'
      );
    } else if (doneResponseId) {
      this.logFn(
        `⚠️ Response.done for different response: ${doneResponseId} (active: ${this.audioPlayback.activeResponseId})`,
        'info'
      );
    } else {
      // No response_id in response.done - might be for the active response
      if (this.audioPlayback.activeResponseId) {
        this.logFn(`✅ Response completed (no ID provided)`, 'success');
        this.audioPlayback.setActiveResponseId(null);
        this.audioPlayback.setCurrentResponseId(null);
      }
    }
  }

  handleError(err) {
    const errorMsg = err.error?.message || err.message || 'Unknown error';
    if (!this.connectionClosed) {
      this.logFn(`❌ Error: ${errorMsg}`, 'error');
      if (
        errorMsg.includes('connection closed') ||
        errorMsg.includes('connection lost')
      ) {
        this.connectionClosed = true;
        this.audioCapture.stop();
      }
    }
  }

  handleClose(e) {
    this.logFn(`🔌 Socket closed: ${e.code} ${e.reason || ''}`, 'info');
    this.updateStatusFn('Disconnected', 'disconnected');
    this.updateButtonsFn(false);
    this.audioCapture.stop();
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.updateStatusFn('Disconnected', 'disconnected');
    this.updateButtonsFn(false);
  }

  getSocket() {
    return this.socket;
  }
}
