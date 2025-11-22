import { resolveTemplate } from '#utils/template-engine.js';
import logger from '#config/logger.js';
import { hubspotService } from '#services/hubspot.service.js';

/**
 * Execute HubSpot CRM Node
 * Supports: Create Contact, Update Contact, Get Contact, Add to List
 */
export async function executeHubspot(data, context) {
  const { actionType } = data;

  if (!actionType) {
    throw new Error('Action type is required for HubSpot node');
  }

  // Get user ID from context
  const userId =
    context.userId ||
    context.workflowInput?.userId ||
    context.variables?.userId;

  if (!userId) {
    throw new Error('User ID not found in context');
  }

  // Get authenticated client
  const { accessToken } = await hubspotService.getAuthenticatedClient(userId);

  // Resolve template variables
  const resolveField = field => {
    if (!field) return null;
    const resolved = resolveTemplate(field, context);
    return resolved && resolved.trim() !== '' ? resolved.trim() : null;
  };

  try {
    switch (actionType) {
      case 'create-contact': {
        const firstName = resolveField(data.firstName);
        const lastName = resolveField(data.lastName);
        const email = resolveField(data.email);
        const phone = resolveField(data.phone);
        const company = resolveField(data.company);

        if (!email) {
          throw new Error('Email is required to create a contact');
        }

        const contact = await hubspotService.createContact(accessToken, {
          firstName,
          lastName,
          email,
          phone,
          company,
        });

        logger.info('HubSpot contact created', {
          contactId: contact.id,
          email,
        });

        return {
          success: true,
          action: 'create-contact',
          contact: {
            id: contact.id,
            properties: contact.properties,
          },
        };
      }

      case 'update-contact': {
        const contactEmail = resolveField(data.email);
        if (!contactEmail) {
          throw new Error('Contact email is required to update a contact');
        }

        const firstName = resolveField(data.firstName);
        const lastName = resolveField(data.lastName);
        const email = resolveField(data.email);
        const phone = resolveField(data.phone);
        const company = resolveField(data.company);

        const contact = await hubspotService.updateContact(
          accessToken,
          contactEmail,
          {
            firstName,
            lastName,
            email,
            phone,
            company,
          }
        );

        logger.info('HubSpot contact updated', {
          contactId: contact.id,
          email: contactEmail,
        });

        return {
          success: true,
          action: 'update-contact',
          contact: {
            id: contact.id,
            properties: contact.properties,
          },
        };
      }

      case 'get-contact': {
        const contactEmail = resolveField(data.contactEmail || data.email);
        if (!contactEmail) {
          throw new Error('Contact email is required to get a contact');
        }

        const contact = await hubspotService.getContactByEmail(
          accessToken,
          contactEmail
        );

        if (!contact) {
          return {
            success: true,
            action: 'get-contact',
            contact: null,
            message: `Contact with email ${contactEmail} not found`,
          };
        }

        logger.info('HubSpot contact retrieved', {
          contactId: contact.id,
          email: contactEmail,
        });

        return {
          success: true,
          action: 'get-contact',
          contact: {
            id: contact.id,
            properties: contact.properties,
          },
        };
      }

      case 'add-to-list': {
        const contactEmail = resolveField(data.contactEmail || data.email);
        const listId = resolveField(data.listId);

        if (!contactEmail) {
          throw new Error('Contact email is required');
        }
        if (!listId) {
          throw new Error('List ID is required');
        }

        const result = await hubspotService.addContactToList(
          accessToken,
          contactEmail,
          listId
        );

        logger.info('HubSpot contact added to list', {
          contactEmail,
          listId,
        });

        return {
          success: true,
          action: 'add-to-list',
          contactEmail,
          listId,
          result,
        };
      }

      case 'create-company': {
        const name = resolveField(data.name);
        const domain = resolveField(data.domain);
        const phone = resolveField(data.phone);
        const city = resolveField(data.city);
        const country = resolveField(data.country);
        const industry = resolveField(data.industry);

        if (!name) {
          throw new Error('Company name is required');
        }

        const company = await hubspotService.createCompany(accessToken, {
          name,
          domain,
          phone,
          city,
          country,
          industry,
        });

        logger.info('HubSpot company created', {
          companyId: company.id,
          name,
        });

        return {
          success: true,
          action: 'create-company',
          company: {
            id: company.id,
            properties: company.properties,
          },
        };
      }

      case 'update-company': {
        const companyId = resolveField(data.companyId);
        if (!companyId) {
          throw new Error('Company ID is required to update a company');
        }

        const name = resolveField(data.name);
        const domain = resolveField(data.domain);
        const phone = resolveField(data.phone);
        const city = resolveField(data.city);
        const country = resolveField(data.country);
        const industry = resolveField(data.industry);

        const company = await hubspotService.updateCompany(
          accessToken,
          companyId,
          {
            name,
            domain,
            phone,
            city,
            country,
            industry,
          }
        );

        logger.info('HubSpot company updated', {
          companyId: company.id,
        });

        return {
          success: true,
          action: 'update-company',
          company: {
            id: company.id,
            properties: company.properties,
          },
        };
      }

      case 'get-company': {
        const companyId = resolveField(data.companyId);
        const domain = resolveField(data.domain);

        if (!companyId && !domain) {
          throw new Error('Company ID or domain is required to get a company');
        }

        let company;
        if (companyId) {
          company = await hubspotService.getCompanyById(accessToken, companyId);
        } else {
          company = await hubspotService.getCompanyByDomain(
            accessToken,
            domain
          );
        }

        if (!company) {
          return {
            success: true,
            action: 'get-company',
            company: null,
            message: `Company ${companyId || domain} not found`,
          };
        }

        logger.info('HubSpot company retrieved', {
          companyId: company.id,
        });

        return {
          success: true,
          action: 'get-company',
          company: {
            id: company.id,
            properties: company.properties,
          },
        };
      }

      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
  } catch (error) {
    logger.error('HubSpot node execution failed', {
      actionType,
      error: error.message,
    });
    throw error;
  }
}

