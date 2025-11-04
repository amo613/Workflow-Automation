/**
 * Audio Capture Module
 * Handles microphone input and audio streaming to OpenAI
 */

export class AudioCapture {
  constructor(socket, logFn) {
    this.socket = socket;
    this.logFn = logFn;
    this.recorder = null;
    this.audioContext = null;
    this.sourceNode = null;
  }

  async start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 24000, // OpenAI Realtime API uses 24kHz
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      this.audioContext = new AudioContext({ sampleRate: 24000 });
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);

      // Create ScriptProcessorNode for PCM16 audio capture
      const bufferSize = 4096;
      const processor = this.audioContext.createScriptProcessor(
        bufferSize,
        1,
        1
      );

      processor.onaudioprocess = e => {
        if (this.socket?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);

          // Convert Float32Array to Int16Array (PCM16)
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }

          // Convert to base64
          const base64 = btoa(
            String.fromCharCode(...new Uint8Array(pcm16.buffer))
          );

          // Send to OpenAI via our proxy
          this.socket.send(
            JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: base64,
            })
          );
        }
      };

      this.sourceNode.connect(processor);
      processor.connect(this.audioContext.destination);

      this.recorder = { stream, processor, sourceNode: this.sourceNode };
      this.logFn('🎤 Audio capture started', 'success');
      return this.recorder;
    } catch (error) {
      this.logFn(`❌ Failed to start audio capture: ${error.message}`, 'error');
      throw error;
    }
  }

  stop() {
    if (this.recorder) {
      this.recorder.stream.getTracks().forEach(t => t.stop());
      if (this.recorder.processor) {
        this.recorder.processor.disconnect();
      }
      if (this.recorder.sourceNode) {
        this.recorder.sourceNode.disconnect();
      }
      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }
      this.recorder = null;
    }
  }

  getAudioContext() {
    return this.audioContext;
  }
}
