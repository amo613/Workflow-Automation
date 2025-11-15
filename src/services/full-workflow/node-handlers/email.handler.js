import { resolveTemplate } from '#utils/template-engine.js';
import logger from '#config/logger.js';
import { sendEmail, decryptEmailCredentials } from '#services/email.service.js';
import { decryptApiKey } from '#utils/encryption.utils.js';
import { db } from '#config/database.js';
import { userEmailCredentials } from '#models/user-email-credentials.model.js';
import { eq } from 'drizzle-orm';
import { ACCOUNT_EMAIL, EMAIL_PASSWORD } from '#config/env.js';

/**
 * Get email credentials for user (from database)
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>} - Decrypted credentials or null
 */
async function getUserEmailCredentials(userId) {
  try {
    const [credentials] = await db
      .select()
      .from(userEmailCredentials)
      .where(eq(userEmailCredentials.user_id, userId))
      .limit(1);

    if (!credentials) {
      return null;
    }

    return decryptEmailCredentials(credentials);
  } catch (error) {
    logger.error('Error getting user email credentials', {
      userId,
      error: error.message,
    });
    return null;
  }
}

/**
 * Execute Email Node
 * @param {Object} node - Node object
 * @param {Object} templateContext - Template context for variable resolution
 * @returns {Promise<Object>} - Node output
 */
export async function executeEmail(node, templateContext) {
  const { data } = node;
  const userId =
    templateContext.userId || templateContext.workflowInput?.userId;

  logger.info('Executing Email Node', {
    nodeId: node.id,
    userId,
    hasTo: !!data.to,
    hasSubject: !!data.subject,
  });

  // Extract node data
  const {
    to,
    subject,
    text,
    html,
    attachments = [],
    fromEmail,
    fromName,
    // Node-level credentials (encrypted, optional)
    smtpHost: nodeSmtpHost,
    smtpPort: nodeSmtpPort,
    smtpUser: nodeSmtpUser,
    smtpPassword: nodeSmtpPassword,
    useTls: nodeUseTls,
  } = data;

  if (!to) {
    throw new Error('Recipient email address (to) is required');
  }

  if (!subject) {
    throw new Error('Email subject is required');
  }

  if (!text && !html) {
    throw new Error('Email body (text or html) is required');
  }

  // Resolve templates
  const resolvedTo = resolveTemplate(to, templateContext);
  const resolvedSubject = resolveTemplate(subject, templateContext);
  const resolvedText = text ? resolveTemplate(text, templateContext) : null;
  const resolvedHtml = html ? resolveTemplate(html, templateContext) : null;
  const resolvedFromEmail = fromEmail
    ? resolveTemplate(fromEmail, templateContext)
    : null;
  const resolvedFromName = fromName
    ? resolveTemplate(fromName, templateContext)
    : null;

  // Resolve attachments (if provided as template variables)
  let resolvedAttachments = [];
  if (attachments && Array.isArray(attachments)) {
    resolvedAttachments = attachments.map(attachment => {
      const resolved = { ...attachment };
      if (attachment.filename) {
        resolved.filename = resolveTemplate(
          attachment.filename,
          templateContext
        );
      }
      if (attachment.path) {
        resolved.path = resolveTemplate(attachment.path, templateContext);
      }
      if (attachment.content) {
        resolved.content = resolveTemplate(attachment.content, templateContext);
      }
      return resolved;
    });
  }

  logger.debug('Email Node templates resolved', {
    nodeId: node.id,
    to: resolvedTo,
    subject: resolvedSubject,
    hasText: !!resolvedText,
    hasHtml: !!resolvedHtml,
    attachmentsCount: resolvedAttachments.length,
  });

  // Get credentials (priority: node credentials > user credentials)
  let credentials = null;

  if (nodeSmtpHost && nodeSmtpPort && nodeSmtpUser && nodeSmtpPassword) {
    // Use node-level credentials (decrypt)
    try {
      credentials = {
        smtpHost: nodeSmtpHost.startsWith('encrypted:')
          ? decryptApiKey(nodeSmtpHost.replace('encrypted:', ''))
          : nodeSmtpHost,
        smtpPort: nodeSmtpPort.startsWith('encrypted:')
          ? decryptApiKey(nodeSmtpPort.replace('encrypted:', ''))
          : nodeSmtpPort,
        smtpUser: nodeSmtpUser.startsWith('encrypted:')
          ? decryptApiKey(nodeSmtpUser.replace('encrypted:', ''))
          : nodeSmtpUser,
        smtpPassword: nodeSmtpPassword.startsWith('encrypted:')
          ? decryptApiKey(nodeSmtpPassword.replace('encrypted:', ''))
          : nodeSmtpPassword,
        useTls: nodeUseTls !== false,
      };
    } catch (error) {
      logger.warn(
        'Failed to decrypt node credentials, trying user credentials',
        {
          nodeId: node.id,
          error: error.message,
        }
      );
    }
  }

  // Fallback to user credentials
  if (!credentials && userId) {
    credentials = await getUserEmailCredentials(userId);
  }

  // Fallback to environment variables (from email job, for testing)
  if (!credentials && ACCOUNT_EMAIL && EMAIL_PASSWORD) {
    logger.info(
      'Using environment variables for email credentials (fallback)',
      {
        nodeId: node.id,
      }
    );
    credentials = {
      service: 'gmail', // Use Gmail service (like email job)
      smtpHost: 'smtp.gmail.com',
      smtpPort: '587',
      smtpUser: ACCOUNT_EMAIL,
      smtpPassword: EMAIL_PASSWORD,
      fromEmail: ACCOUNT_EMAIL,
      fromName: null,
      useTls: true,
    };
  }

  if (!credentials) {
    throw new Error(
      'SMTP credentials are required. Please set them in the node settings, user settings, or configure ACCOUNT_EMAIL and EMAIL_PASSWORD environment variables.'
    );
  }

  // Use fromEmail from node or credentials
  const finalFromEmail = resolvedFromEmail || credentials.fromEmail;
  const finalFromName = resolvedFromName || credentials.fromName;

  if (!finalFromEmail) {
    throw new Error('From email address is required');
  }

  // Send email
  try {
    const result = await sendEmail({
      credentials,
      to: resolvedTo,
      subject: resolvedSubject,
      text: resolvedText,
      html: resolvedHtml,
      attachments: resolvedAttachments,
      fromEmail: finalFromEmail,
      fromName: finalFromName,
    });

    logger.info('Email sent successfully', {
      nodeId: node.id,
      messageId: result.messageId,
      to: resolvedTo,
    });

    return {
      success: true,
      messageId: result.messageId,
      to: resolvedTo,
      subject: resolvedSubject,
      sentAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Failed to send email', {
      nodeId: node.id,
      error: error.message,
      to: resolvedTo,
    });
    throw error;
  }
}
