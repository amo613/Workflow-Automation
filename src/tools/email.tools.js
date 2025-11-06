import { InternalFunctionName } from './types.js';

/**
 * Email Tool Declarations
 * Defines OpenAI function declarations for email operations
 */

export const sendEmailFunctionDeclaration = () => ({
  type: 'function',
  name: InternalFunctionName.EMAIL_SEND,
  description:
    'Send an email to one or more recipients. If any required field is missing, ask the user for it before calling this function.',
  parameters: {
    type: 'object',
    properties: {
      to: {
        type: 'array',
        items: { type: 'string' },
        description: 'Recipient email addresses (one or more)',
      },
      subject: {
        type: 'string',
        description: 'Email subject line',
      },
      html: {
        type: 'string',
        description: 'HTML content of the email',
      },
    },
    required: ['to', 'subject', 'html'],
  },
});
