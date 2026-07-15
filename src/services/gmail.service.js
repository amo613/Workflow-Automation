import { google } from 'googleapis';
import logger from '#config/logger.js';

// ✅ Cache Gmail OAuth clients to avoid recreating
const gmailClientCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Gmail Service
 * Handles Gmail API operations
 */
export class GmailService {
  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID;
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    this.baseRedirectUri =
      process.env.GOOGLE_REDIRECT_URI_BASE || process.env.GOOGLE_REDIRECT_URI;
    this.redirectUri = this.getRedirectUri();

    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      logger.warn(
        'Google OAuth credentials not fully configured. Gmail integration may fail.'
      );
    }
  }

  /**
   * Build redirect URI (align with google-oauth.service.js)
   * @returns {string|null}
   */
  getRedirectUri() {
    if (!this.baseRedirectUri) {
      return null;
    }

    if (this.baseRedirectUri.includes('/api/integrations/')) {
      return this.baseRedirectUri;
    }

    const normalizedBase = this.baseRedirectUri.endsWith('/')
      ? this.baseRedirectUri.slice(0, -1)
      : this.baseRedirectUri;

    return `${normalizedBase}/api/integrations/gmail/callback`;
  }

  /**
   * Create Gmail API Client
   * @param {string} accessToken - OAuth access token
   * @param {string} refreshToken - OAuth refresh token (optional)
   * @returns {google.gmail_v1.Gmail} Gmail API client
   */
  getGmailClient(accessToken, refreshToken = null) {
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new Error('Google OAuth credentials not configured');
    }

    // ✅ Check cache first
    const cacheKey = `${accessToken.substring(0, 20)}-${refreshToken?.substring(0, 20) || 'none'}`;
    const cached = gmailClientCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug('Using cached Gmail OAuth client');
      return cached.client;
    }

    const oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );

    if (refreshToken) {
      oauth2Client.setCredentials({
        refresh_token: refreshToken,
        access_token: accessToken,
      });
    } else {
      oauth2Client.setCredentials({ access_token: accessToken });
    }

    const gmailClient = google.gmail({ version: 'v1', auth: oauth2Client });

    // ✅ Cache the client
    gmailClientCache.set(cacheKey, {
      client: gmailClient,
      timestamp: Date.now(),
    });

    // ✅ Clean old cache entries (max 100)
    if (gmailClientCache.size > 100) {
      const oldestKey = gmailClientCache.keys().next().value;
      gmailClientCache.delete(oldestKey);
    }

    return gmailClient;
  }

  /**
   * Send email via Gmail API
   * @param {string} accessToken - OAuth access token
   * @param {string} refreshToken - OAuth refresh token
   * @param {Object} emailData - Email data
   * @param {string|Array} emailData.to - Recipient email(s)
   * @param {string|Array} emailData.cc - CC email(s) (optional)
   * @param {string|Array} emailData.bcc - BCC email(s) (optional)
   * @param {string} emailData.subject - Email subject
   * @param {string} emailData.text - Plain text body (optional)
   * @param {string} emailData.html - HTML body (optional)
   * @param {string} emailData.from - From email address (optional, defaults to authenticated user)
   * @returns {Promise<Object>} Send result
   */
  async sendEmail(accessToken, refreshToken, emailData) {
    const { to, cc = [], bcc = [], subject, text, html, from } = emailData;

    if (!to) {
      throw new Error('Recipient email address (to) is required');
    }

    if (!subject) {
      throw new Error('Email subject is required');
    }

    if (!text && !html) {
      throw new Error('Email body (text or html) is required');
    }

    const gmail = this.getGmailClient(accessToken, refreshToken);

    // Normalize recipients to arrays
    const toArray = Array.isArray(to) ? to : [to];
    const ccArray = Array.isArray(cc) ? cc : cc ? [cc] : [];
    const bccArray = Array.isArray(bcc) ? bcc : bcc ? [bcc] : [];

    // Build MIME message (RFC 2822 format)
    const messageParts = [];

    // Headers
    messageParts.push(`To: ${toArray.join(', ')}`);
    if (ccArray.length > 0) {
      messageParts.push(`Cc: ${ccArray.join(', ')}`);
    }
    if (bccArray.length > 0) {
      messageParts.push(`Bcc: ${bccArray.join(', ')}`);
    }
    messageParts.push(`Subject: ${subject}`);

    // Get from email (use authenticated user's email if not provided)
    let fromEmail = from;
    if (!fromEmail) {
      try {
        fromEmail = await this.getUserEmail(accessToken, refreshToken);
      } catch (error) {
        logger.warn('Could not get user email, using default', {
          error: error.message,
        });
        fromEmail = 'noreply@gmail.com';
      }
    }
    messageParts.push(`From: ${fromEmail}`);

    // Content-Type and body
    if (html && text) {
      // Multipart alternative (both HTML and text)
      const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      messageParts.push('MIME-Version: 1.0');
      messageParts.push(
        `Content-Type: multipart/alternative; boundary="${boundary}"`
      );
      messageParts.push('');
      messageParts.push(`--${boundary}`);
      messageParts.push('Content-Type: text/plain; charset=UTF-8');
      messageParts.push('Content-Transfer-Encoding: 7bit');
      messageParts.push('');
      messageParts.push(text);
      messageParts.push(`--${boundary}`);
      messageParts.push('Content-Type: text/html; charset=UTF-8');
      messageParts.push('Content-Transfer-Encoding: 7bit');
      messageParts.push('');
      messageParts.push(html);
      messageParts.push(`--${boundary}--`);
    } else if (html) {
      // HTML only
      messageParts.push('MIME-Version: 1.0');
      messageParts.push('Content-Type: text/html; charset=UTF-8');
      messageParts.push('Content-Transfer-Encoding: 7bit');
      messageParts.push('');
      messageParts.push(html);
    } else {
      // Text only
      messageParts.push('MIME-Version: 1.0');
      messageParts.push('Content-Type: text/plain; charset=UTF-8');
      messageParts.push('Content-Transfer-Encoding: 7bit');
      messageParts.push('');
      messageParts.push(text);
    }

    // Build complete message
    const rawMessage = messageParts.join('\r\n');

    // Encode message in base64url format (RFC 4648)
    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    try {
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      logger.info('Email sent successfully via Gmail API', {
        messageId: response.data.id,
        to: toArray,
        subject,
      });

      return {
        success: true,
        messageId: response.data.id,
        threadId: response.data.threadId,
        labelIds: response.data.labelIds,
      };
    } catch (error) {
      logger.error('Error sending email via Gmail API', {
        error: error.message,
        to: toArray,
        subject,
      });
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Get user email from Gmail API
   * @param {string} accessToken - OAuth access token
   * @param {string} refreshToken - OAuth refresh token
   * @returns {Promise<string>} User email address
   */
  async getUserEmail(accessToken, refreshToken) {
    const gmail = this.getGmailClient(accessToken, refreshToken);

    try {
      const profile = await gmail.users.getProfile({
        userId: 'me',
      });

      const email = profile.data.emailAddress;
      logger.info(`Retrieved email for Gmail integration: ${email}`);
      return email;
    } catch (error) {
      logger.error('Error getting user email from Gmail API', {
        error: error.message,
      });
      throw new Error(`Failed to get user email: ${error.message}`);
    }
  }
}

export const gmailService = new GmailService();
