/**
 * Main Application Module
 * Initializes and coordinates all modules
 */

import { AudioCapture } from './audio-capture.js';
import { AudioPlayback } from './audio-playback.js';
import { TranscriptManager } from './transcript.js';
import { WebSocketClient } from './websocket-client.js';
import { ConfigManager } from './config.js';
import { CallManager } from './call.js';

// Logger functions - simple UI logging
function log(msg, type = 'info') {
  const logContent = document.getElementById('logContent');
  if (!logContent) return;

  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logContent.appendChild(entry);
  logContent.scrollTop = logContent.scrollHeight;
  console.log(msg);
}

function updateStatus(text, className) {
  const statusElement = document.getElementById('status');
  if (!statusElement) return;
  statusElement.textContent = text;
  statusElement.className = `status ${className}`;
}

function updateButtons(connected) {
  const connectBtn = document.getElementById('connectBtn');
  const disconnectBtn = document.getElementById('disconnectBtn');

  if (connectBtn) connectBtn.disabled = connected;
  if (disconnectBtn) disconnectBtn.disabled = !connected;
}

const transcript = new TranscriptManager();

// We need to create audioPlayback with a function that will get audioContext later
let audioContext = null;
const audioPlayback = new AudioPlayback(log, () => audioContext);

let audioCapture = null;
let wsClient = null;
const configManager = new ConfigManager(log);
const callManager = new CallManager(log, () => configManager.getFromForm());

// Setup configuration toggle
configManager.setupToggle();

// Setup call section
callManager.setupCallSection();

// Connect button
document.getElementById('connectBtn')?.addEventListener('click', async () => {
  try {
    // Create audio capture instance first
    audioCapture = new AudioCapture(null, log);

    // Create WebSocket client
    wsClient = new WebSocketClient(
      log,
      updateStatus,
      updateButtons,
      audioCapture,
      audioPlayback,
      transcript
    );

    // Connect WebSocket
    wsClient.connect(() => configManager.getFromForm());

    // After socket is created, update audioCapture reference and audioContext
    const checkSocket = setInterval(() => {
      const socket = wsClient.getSocket();
      if (socket && audioCapture) {
        audioCapture.socket = socket;
        audioContext = audioCapture.getAudioContext();
        clearInterval(checkSocket);
      }
    }, 100);
  } catch (error) {
    log(`❌ Connection error: ${error.message}`, 'error');
    console.error('Connection error:', error);
  }
});

// Disconnect button
document.getElementById('disconnectBtn')?.addEventListener('click', () => {
  if (wsClient) {
    wsClient.disconnect();
    wsClient = null;
  }
  if (audioCapture) {
    audioCapture.stop();
    audioCapture = null;
  }
  audioPlayback.clear();
  transcript.resetAssistant();
  transcript.resetUser();
});

// Save config button
document
  .getElementById('saveConfigBtn')
  ?.addEventListener('click', async () => {
    await configManager.save();
  });

// Load default config on page load
configManager.loadDefault();

// Initial log messages
log('🚀 OpenAI Realtime API Test UI loaded', 'success');
log('💡 Click "Connect" to start a voice conversation with GPT', 'info');
