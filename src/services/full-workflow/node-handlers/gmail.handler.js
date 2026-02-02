import { resolveTemplate } from '#utils/template-engine.js';
import logger from '#config/logger.js';
import { gmailService } from '#services/gmail.service.js';
import { getIntegration } from '#services/integration.service.js';
import { googleOAuthService } from '#services/google-oauth.service.js';

/**
 * Execute Gmail Node
 * Sends emails via Gmail API (OAuth2)
 * @param {Object} node - Node object
 * @param {Object} templateContext - Template context for variable resolution
 * @returns {Promise<Object>} - Node output
 */
export async function executeGmail(node, templateContext) {
  const { data } = node;
  const userId =
    templateContext.userId || templateContext.workflowInput?.userId;

  logger.info('Executing Gmail Node', {
    nodeId: node.id,
    userId,
    hasTo: !!data.to,
    hasSubject: !!data.subject,
  });

  // Extract node data
  const {
    to,
    cc,
    bcc,
    subject,
    text,
    html,
    fromEmail,
    attachments = [],
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

  // Get Gmail integration for user
  const integration = await getIntegration(userId, 'GOOGLE_GMAIL');

  if (!integration || !integration.isComplete) {
    throw new Error(
      'Gmail integration not found or not authenticated. Please connect your Gmail account in the Settings tab.'
    );
  }

  // Resolve templates
  const resolvedTo = resolveTemplate(to, templateContext);
  const resolvedCc = cc ? resolveTemplate(cc, templateContext) : null;
  const resolvedBcc = bcc ? resolveTemplate(bcc, templateContext) : null;
  const resolvedSubject = resolveTemplate(subject, templateContext);
  const resolvedText = text ? resolveTemplate(text, templateContext) : null;
  const resolvedHtml = html ? resolveTemplate(html, templateContext) : null;
  const resolvedFromEmail = fromEmail
    ? resolveTemplate(fromEmail, templateContext)
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
        resolved.content = resolveTemplate(
          attachment.content,
          templateContext
        );
      }
      return resolved;
    });
  }

  logger.debug('Gmail Node templates resolved', {
    nodeId: node.id,
    to: resolvedTo,
    cc: resolvedCc,
    bcc: resolvedBcc,
    subject: resolvedSubject,
    hasText: !!resolvedText,
    hasHtml: !!resolvedHtml,
    attachmentsCount: resolvedAttachments.length,
  });

  // Get access token (refresh if needed)
  let accessToken = integration.accessToken;
  let refreshToken = integration.refreshToken;

  // Check if token is expired and refresh if needed
  if (integration.tokenExpiresAt && new Date(integration.tokenExpiresAt) < new Date()) {
    try {
      logger.info('Gmail access token expired, refreshing...', {
        nodeId: node.id,
        userId,
      });
      const refreshed = await googleOAuthService.refreshAccessToken(
        refreshToken,
        'GOOGLE_GMAIL'
      );
      accessToken = refreshed.accessToken;
      // Note: Integration update should be handled by a background job
      // For now, we just use the refreshed token
    } catch (error) {
      logger.error('Failed to refresh Gmail access token', {
        nodeId: node.id,
        userId,
        error: error.message,
      });
      throw new Error(
        'Gmail access token expired and could not be refreshed. Please reconnect your Gmail account.'
      );
    }
  }

  // Send email via Gmail API
  try {
    const result = await gmailService.sendEmail(
      accessToken,
      refreshToken,
      {
        to: resolvedTo,
        cc: resolvedCc,
        bcc: resolvedBcc,
        subject: resolvedSubject,
        text: resolvedText,
        html: resolvedHtml,
        from: resolvedFromEmail,
        attachments: resolvedAttachments,
      }
    );

    logger.info('Email sent successfully via Gmail API', {
      nodeId: node.id,
      messageId: result.messageId,
      to: resolvedTo,
      subject: resolvedSubject,
    });

    return {
      success: true,
      messageId: result.messageId,
      threadId: result.threadId,
      to: resolvedTo,
      subject: resolvedSubject,
      sentAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Failed to send email via Gmail API', {
      nodeId: node.id,
      error: error.message,
      to: resolvedTo,
      subject: resolvedSubject,
    });
    throw error;
  }
}


