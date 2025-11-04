import logger from '#config/logger.js';

/**
 * Audio Converter Utilities
 * Converts between Twilio's μ-law format and Hume's PCM Linear16 format
 */

// μ-law to PCM conversion lookup table (standard ITU-T G.711)
const MULAW_TO_PCM_TABLE = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  const sign = i & 0x80;
  const exponent = (i >> 4) & 0x07;
  const mantissa = i & 0x0f;
  let sample;

  if (exponent === 0) {
    sample = (mantissa << 3) + 132;
  } else {
    sample = ((mantissa << (exponent + 2)) | (1 << (exponent + 2))) + 132;
  }

  if (sign) {
    sample = -sample;
  }

  MULAW_TO_PCM_TABLE[i] = sample;
}

// PCM to μ-law conversion lookup table (standard ITU-T G.711)
const PCM_TO_MULAW_TABLE = new Uint8Array(65536);
for (let i = 0; i < 65536; i++) {
  const pcm = i - 32768;
  const sign = pcm < 0 ? 0x80 : 0x00;
  let magnitude = Math.abs(pcm);

  if (magnitude > 32635) {
    magnitude = 32635;
  }

  magnitude += 132;

  let exponent = 0;
  let expMask = 0x7f80;
  while ((magnitude & expMask) === 0 && exponent < 7) {
    exponent++;
    expMask >>= 1;
  }

  const mantissa = (magnitude >> (exponent + 3)) & 0x0f;
  PCM_TO_MULAW_TABLE[i] = sign | (exponent << 4) | mantissa;
}

/**
 * Convert μ-law (Twilio format) to PCM Linear16 (Hume format)
 * Twilio: 8-bit μ-law @ 8000Hz
 * Hume: 16-bit PCM Linear16 @ 16000Hz
 * @param {Buffer} mulawBuffer - μ-law audio buffer (8kHz, 8-bit)
 * @returns {Buffer} PCM Linear16 audio buffer (16kHz, 16-bit)
 */
export function mulawToPCM16(mulawBuffer) {
  try {
    // Step 1: Convert μ-law to PCM @ 8000Hz (16-bit)
    const pcm8kBuffer = Buffer.allocUnsafe(mulawBuffer.length * 2);
    for (let i = 0; i < mulawBuffer.length; i++) {
      const pcmSample = MULAW_TO_PCM_TABLE[mulawBuffer[i]];
      pcm8kBuffer.writeInt16LE(pcmSample, i * 2);
    }

    // Step 2: Upsample from 8000Hz to 16000Hz (simple duplication)
    // CRITICAL: For 8kHz -> 16kHz, we need to double each sample
    // Output buffer should be exactly 2x the input buffer size
    const pcm16kBuffer = Buffer.allocUnsafe(pcm8kBuffer.length * 2);

    // For each 16-bit PCM sample at 8kHz, output 2 samples at 16kHz
    for (let i = 0; i < pcm8kBuffer.length / 2; i++) {
      const sample = pcm8kBuffer.readInt16LE(i * 2);

      // Duplicate the sample (simple upsampling)
      // Output position: i * 4 (16-bit = 2 bytes, double = 4 bytes per original sample)
      pcm16kBuffer.writeInt16LE(sample, i * 4); // First sample
      pcm16kBuffer.writeInt16LE(sample, i * 4 + 2); // Duplicate sample
    }

    return pcm16kBuffer;
  } catch (error) {
    logger.error('Error converting μ-law to PCM16:', error);
    throw error;
  }
}

/**
 * Convert PCM Linear16 (Hume format) to μ-law (Twilio format)
 * Hume: 16-bit PCM Linear16 @ 16000Hz
 * Twilio: 8-bit μ-law @ 8000Hz
 * @param {Buffer} pcm16Buffer - PCM Linear16 audio buffer (16kHz, 16-bit)
 * @returns {Buffer} μ-law audio buffer (8kHz, 8-bit)
 */
export function pcm16ToMulaw(pcm16Buffer) {
  try {
    // Step 1: Downsample from 16000Hz to 8000Hz (simple decimation: take every 2nd sample)
    const pcm8kLength = pcm16Buffer.length / 2;
    const pcm8kBuffer = Buffer.allocUnsafe(pcm8kLength);

    for (let i = 0; i < pcm8kLength / 2; i++) {
      // Take every 2nd sample from 16kHz buffer
      const pcmSample = pcm16Buffer.readInt16LE(i * 4);
      pcm8kBuffer.writeInt16LE(pcmSample, i * 2);
    }

    // Step 2: Convert 16-bit PCM to μ-law (8-bit)
    const mulawBuffer = Buffer.allocUnsafe(pcm8kBuffer.length / 2);
    for (let i = 0; i < pcm8kBuffer.length / 2; i++) {
      const pcmSample = pcm8kBuffer.readInt16LE(i * 2);
      // Convert signed 16-bit PCM to unsigned 16-bit index
      const index = pcmSample + 32768;
      mulawBuffer[i] = PCM_TO_MULAW_TABLE[Math.max(0, Math.min(65535, index))];
    }

    return mulawBuffer;
  } catch (error) {
    logger.error('Error converting PCM16 to μ-law:', error);
    throw error;
  }
}

/**
 * Convert base64 encoded μ-law to base64 encoded PCM16
 * @param {string} base64Mulaw - Base64 encoded μ-law audio
 * @returns {string} Base64 encoded PCM16 audio
 */
export function base64MulawToBase64PCM16(base64Mulaw) {
  try {
    const mulawBuffer = Buffer.from(base64Mulaw, 'base64');
    const pcm16Buffer = mulawToPCM16(mulawBuffer);
    return pcm16Buffer.toString('base64');
  } catch (error) {
    logger.error('Error converting base64 μ-law to base64 PCM16:', error);
    throw error;
  }
}

/**
 * Convert base64 encoded PCM16 to base64 encoded μ-law
 * @param {string} base64PCM16 - Base64 encoded PCM16 audio
 * @returns {string} Base64 encoded μ-law audio
 */
export function base64PCM16ToBase64Mulaw(base64PCM16) {
  try {
    const pcm16Buffer = Buffer.from(base64PCM16, 'base64');
    const mulawBuffer = pcm16ToMulaw(pcm16Buffer);
    return mulawBuffer.toString('base64');
  } catch (error) {
    logger.error('Error converting base64 PCM16 to base64 μ-law:', error);
    throw error;
  }
}
