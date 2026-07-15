import nodemailer from 'nodemailer';
import logger from '#config/logger.js';
import { decryptApiKey } from '#utils/encryption.utils.js';
import { NODE_ENV } from '#config/env.js';

// ✅ Cache SMTP transporters to reuse connections
const transporterCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Create SMTP transporter from credentials
 * @param {Object} credentials - SMTP credentials (decrypted)
 * @returns {Object} - Nodemailer transporter
 */
function createTransporter(credentials) {
  const {
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPassword,
    useTls = true,
    service, // Optional: 'gmail', etc.
  } = credentials;

  // ✅ Check cache first
  const cacheKey = `${service || smtpHost}-${smtpUser}`;
  const cached = transporterCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.debug('Using cached SMTP transporter', { cacheKey });
    return cached.transporter;
  }

  let transporter;

  // If service is specified (e.g., 'gmail'), use service config
  if (service === 'gmail') {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      pool: true, // ✅ Enable connection pooling
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
  } else {
    // Otherwise, use host/port configuration
    const port = parseInt(smtpPort, 10);
    const config = {
      host: smtpHost,
      port,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      pool: true, // ✅ Enable connection pooling
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    };

    // ✅ CRITICAL: Port 465 uses direct SSL, port 587 uses STARTTLS
    if (port === 465) {
      config.secure = true;
    } else if (port === 587) {
      config.secure = false;
      config.requireTLS = true;
    } else if (useTls) {
      config.secure = true;
    }

    transporter = nodemailer.createTransport(config);
  }

  // ✅ Cache the transporter
  transporterCache.set(cacheKey, {
    transporter,
    timestamp: Date.now(),
  });

  // ✅ Clean old cache entries
  if (transporterCache.size > 50) {
    const oldestKey = transporterCache.keys().next().value;
    transporterCache.delete(oldestKey);
  }

  return transporter;
}

/**
 * Send email via SMTP
 * @param {Object} options - Email options
 * @param {Object} options.credentials - SMTP credentials (decrypted)
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} options.html - HTML body (optional)
 * @param {Array} options.attachments - Attachments array (optional)
 * @param {string} options.fromEmail - From email address
 * @param {string} options.fromName - From name (optional)
 * @returns {Promise<Object>} - Send result
 */
export async function sendEmail({
  credentials,
  to,
  subject,
  text,
  html,
  attachments = [],
  fromEmail,
  fromName,
}) {
  try {
    if (!credentials) {
      throw new Error('SMTP credentials are required');
    }

    if (!to) {
      throw new Error('Recipient email address is required');
    }

    if (!subject) {
      throw new Error('Email subject is required');
    }

    if (!text && !html) {
      throw new Error('Email body (text or html) is required');
    }

    // Create transporter
    const transporter = createTransporter(credentials);

    // Verify connection only in development (can cause timeouts in production)
    // In production, we skip verify() and let sendMail() handle connection errors
    if (NODE_ENV === 'development') {
      try {
        await Promise.race([
          transporter.verify(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('SMTP verification timeout')),
              8000
            )
          ),
        ]);
        logger.debug('SMTP connection verified', { to });
      } catch (verifyError) {
        // Log warning but continue - verification is not required for sending
        logger.warn('SMTP verification failed, continuing anyway', {
          error: verifyError.message,
          to,
        });
        // Don't throw - we can still try to send the email
      }
    }

    // Prepare email options
    const mailOptions = {
      from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    logger.info('Email sent successfully', {
      messageId: info.messageId,
      to,
      subject,
    });

    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error) {
    logger.error('Error sending email', {
      error: error.message,
      stack: error.stack,
      to,
      subject,
    });
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Decrypt email credentials
 * @param {Object} encryptedCredentials - Encrypted credentials from database
 * @returns {Object} - Decrypted credentials
 */
export function decryptEmailCredentials(encryptedCredentials) {
  try {
    return {
      smtpHost: decryptApiKey(encryptedCredentials.encrypted_smtp_host),
      smtpPort: decryptApiKey(encryptedCredentials.encrypted_smtp_port),
      smtpUser: decryptApiKey(encryptedCredentials.encrypted_smtp_user),
      smtpPassword: decryptApiKey(encryptedCredentials.encrypted_smtp_password),
      fromEmail: decryptApiKey(encryptedCredentials.encrypted_from_email),
      fromName: encryptedCredentials.encrypted_from_name
        ? decryptApiKey(encryptedCredentials.encrypted_from_name)
        : null,
      useTls: encryptedCredentials.use_tls === 1,
    };
  } catch (error) {
    logger.error('Error decrypting email credentials', {
      error: error.message,
    });
    throw new Error('Failed to decrypt email credentials');
  }
}
