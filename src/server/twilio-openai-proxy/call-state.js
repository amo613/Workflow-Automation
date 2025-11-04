import logger from '#config/logger.js';

/**
 * Call State Management
 * Verwaltet den State einer Twilio-OpenAI Call-Session
 */
export class CallState {
  constructor(callSid = null) {
    this.callSid = callSid;

    // Einfaches State-Tracking - OpenAI übernimmt das Turn-Taking
    this.hasActiveResponse = false;
    this.currentResponseId = null; // ID der aktuellen Response für manuelle Cancellation
    this.audioChunkCount = 0;
    this.lastAssistantAudioAt = 0;

    // Audio Buffer
    this.audioBuffer = [];
    this.MAX_BUFFER_SIZE = 3;
  }

  /**
   * callSid setzen, falls noch nicht gesetzt
   */
  setCallSid(callSid) {
    if (!this.callSid) {
      this.callSid = callSid;
    }
  }

  /**
   * Hilfsfunktion zum Loggen des Gesprächsstatus
   */
  logTurnState(label, additionalState = {}) {
    try {
      logger.info(
        `🎯 Turn state [${label}] for call ${this.callSid || 'UNKNOWN'}`,
        {
          hasActiveResponse: this.hasActiveResponse,
          audioChunkCount: this.audioChunkCount,
          sinceLastAssistantMs: Date.now() - this.lastAssistantAudioAt,
          ...additionalState,
        }
      );
    } catch (_e) {
      logger.error(_e);
    }
  }

  /**
   * Audio-Chunk zum Buffer hinzufügen
   */
  bufferAudio(audioBase64) {
    if (this.audioBuffer.length < this.MAX_BUFFER_SIZE) {
      this.audioBuffer.push(audioBase64);
      return true;
    }
    return false;
  }

  /**
   * Alle gepufferten Audio-Chunks zurückgeben und Buffer leeren
   */
  flushAudioBuffer() {
    const chunks = [...this.audioBuffer];
    this.audioBuffer.length = 0;
    return chunks;
  }

  /**
   * State zurücksetzen
   */
  reset() {
    this.hasActiveResponse = false;
    this.currentResponseId = null;
    this.audioChunkCount = 0;
    this.lastAssistantAudioAt = 0;
    this.audioBuffer.length = 0;
  }
}
