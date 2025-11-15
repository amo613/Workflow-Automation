/**
 * Audio Playback Module
 * Handles audio queue management and playback
 */

export class AudioPlayback {
  constructor(logFn, getAudioContext) {
    this.logFn = logFn;
    this.getAudioContext = getAudioContext;
    this.audioQueue = [];
    this.isPlayingAudio = false;
    this.currentResponseId = null;
    this.activeResponseId = null;
  }

  setActiveResponseId(responseId) {
    this.activeResponseId = responseId;
  }

  async playQueue() {
    // CRITICAL: Don't play if already playing or queue is empty
    if (this.isPlayingAudio) {
      return; // Already playing, wait for current chunk to finish
    }

    if (this.audioQueue.length === 0) {
      return; // Nothing to play
    }

    this.isPlayingAudio = true;
    const chunk = this.audioQueue.shift();

    // CRITICAL: Verify this chunk belongs to the current active response
    if (
      chunk.responseId !== this.activeResponseId &&
      this.activeResponseId !== null
    ) {
      this.logFn(
        `⚠️ Skipping audio chunk from inactive response: ${chunk.responseId} (active: ${this.activeResponseId})`,
        'warning'
      );
      this.isPlayingAudio = false;
      this.playQueue(); // Try next chunk
      return;
    }

    try {
      let audioContext = this.getAudioContext();
      if (!audioContext) {
        audioContext = new AudioContext({ sampleRate: 24000 });
        // Note: We can't update the external audioContext reference here,
        // but this should only happen if audioContext is null
      }

      // Resume AudioContext if suspended (required by some browsers)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // Decode base64 to ArrayBuffer
      const binaryString = atob(chunk.audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert PCM16 to Float32Array
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0;
      }

      // CRITICAL: Check if buffer is empty or too small
      if (float32.length === 0) {
        this.logFn(`⚠️ Skipping empty audio chunk`, 'warning');
        this.isPlayingAudio = false;
        this.playQueue(); // Try next chunk
        return;
      }

      // Create AudioBuffer and play
      const audioBuffer = audioContext.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32, 0);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      // When this chunk finishes, play next in queue
      source.onended = () => {
        this.isPlayingAudio = false;
        // CRITICAL: Continue playing queue even if AudioContext might be suspended
        if (this.audioQueue.length > 0) {
          this.playQueue(); // Play next chunk
        }
      };

      source.start();

      // Log playback start for debugging
      if (this.audioQueue.length === 0 || this.audioQueue.length % 20 === 0) {
        this.logFn(
          `▶️ Playing audio chunk, ${this.audioQueue.length} remaining`,
          'debug'
        );
      }
    } catch (error) {
      this.logFn(`❌ Failed to play audio: ${error.message}`, 'error');
      console.error('Audio playback error:', error, {
        chunkSize: chunk.audio.length,
        queueLength: this.audioQueue.length,
      });
      this.isPlayingAudio = false;
      // CRITICAL: Continue playing queue even after error
      if (this.audioQueue.length > 0) {
        this.playQueue(); // Try next chunk
      }
    }
  }

  queue(base64Audio, responseId) {
    // CRITICAL: Only clear queue if this is truly a NEW response, not just updating currentResponseId
    if (
      responseId !== this.currentResponseId &&
      this.currentResponseId !== null
    ) {
      // New response detected - stop current playback and clear queue
      this.audioQueue = []; // Clear queue for new response
      this.isPlayingAudio = false; // Stop current playback
      this.currentResponseId = responseId;
      this.logFn(
        `🔄 Switched to new response, cleared audio queue: ${responseId}`,
        'info'
      );
    } else if (this.currentResponseId === null) {
      // First response - just set currentResponseId
      this.currentResponseId = responseId;
    }

    // Add chunk to queue
    this.audioQueue.push({
      audio: base64Audio,
      responseId,
      timestamp: Date.now(),
    });

    // Log queue status for debugging
    if (this.audioQueue.length % 10 === 0 || this.audioQueue.length <= 3) {
      this.logFn(
        `📦 Audio queue: ${this.audioQueue.length} chunks, playing: ${this.isPlayingAudio}`,
        'debug'
      );
    }

    // Start playing if not already playing
    this.playQueue();
  }

  clear() {
    this.audioQueue = [];
    this.isPlayingAudio = false;
    this.currentResponseId = null;
    // NOTE: Don't clear activeResponseId here - it should be cleared explicitly in response.done
  }

  getCurrentResponseId() {
    return this.currentResponseId;
  }

  setCurrentResponseId(responseId) {
    this.currentResponseId = responseId;
  }

  getQueueLength() {
    return this.audioQueue.length;
  }
}
