import logger from '#config/logger.js';
import { hubspotOAuthService } from './hubspot-oauth.service.js';
import { getIntegration } from './integration.service.js';
import { db } from '#config/database.js';
import { integrations } from '#models/integration.model.js';
import { eq, and } from 'drizzle-orm';
import { httpsAgent } from '#config/http-agent.js';

// ✅ Cache HubSpot access tokens to reduce DB queries
const hubspotTokenCache = new Map();
const CACHE_TTL = 4 * 60 * 1000; // 4 minutes (refresh 1 min before expiry)

/**
 * HubSpot Service
 * Handles HubSpot CRM API operations
 * Note: Native Node.js fetch doesn't support agent parameter.
 * For production, consider using undici or node-fetch for connection pooling.
 */
export class HubSpotService {
  /**
   * Get HubSpot API client with authentication
   * @param {number} userId - User ID
   * @returns {Promise<{accessToken: string}>} - Access token for API calls
   */
  async getAuthenticatedClient(userId) {
    // ✅ Check cache first
    const cacheKey = `hubspot-token-${userId}`;
    const cached = hubspotTokenCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug('Using cached HubSpot token', { userId });
      return { accessToken: cached.accessToken };
    }

    const integration = await getIntegration(userId, 'HUBSPOT');

    if (!integration) {
      throw new Error(
        'HubSpot integration not found. Please connect your HubSpot account in Settings.'
      );
    }

    let accessToken = integration.accessToken;

    // Check if token is expired and refresh if needed
    if (integration.tokenExpiresAt) {
      const expiresAt = new Date(integration.tokenExpiresAt);
      const now = new Date();
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();

      // Refresh if token expires in less than 5 minutes
      if (timeUntilExpiry < 5 * 60 * 1000 && integration.refreshToken) {
        try {
          logger.info('Refreshing HubSpot access token', { userId });
          const refreshed = await hubspotOAuthService.refreshAccessToken(
            integration.refreshToken
          );
          accessToken = refreshed.accessToken;

          // Update integration with new token in database
          await db
            .update(integrations)
            .set({
              access_token: refreshed.accessToken,
              refresh_token: refreshed.refreshToken || integration.refreshToken,
              token_expires_at: refreshed.expiresAt,
              updated_at: new Date(),
            })
            .where(
              and(
                eq(integrations.user_id, userId),
                eq(integrations.integration_type, 'HUBSPOT')
              )
            );

          logger.info('HubSpot token refreshed and saved to database', {
            userId,
          });
        } catch (error) {
          logger.error('Failed to refresh HubSpot token', {
            userId,
            error: error.message,
          });
          throw new Error(
            'HubSpot access token expired and refresh failed. Please reconnect your HubSpot account.'
          );
        }
      }
    }

    // ✅ Cache the token
    hubspotTokenCache.set(cacheKey, {
      accessToken,
      timestamp: Date.now(),
    });
    
    // ✅ Clean old cache entries (max 100)
    if (hubspotTokenCache.size > 100) {
      const oldestKey = hubspotTokenCache.keys().next().value;
      hubspotTokenCache.delete(oldestKey);
    }

    return { accessToken };
  }

  /**
   * Create a contact in HubSpot
   * @param {string} accessToken - HubSpot access token
   * @param {Object} contactData - Contact data
   * @returns {Promise<Object>} - Created contact
   */
  async createContact(accessToken, contactData) {
    const { firstName, lastName, email, phone, company } = contactData;

    if (!email) {
      throw new Error('Email is required to create a contact');
    }

    const properties = {};
    if (firstName) properties.firstname = firstName;
    if (lastName) properties.lastname = lastName;
    if (email) properties.email = email;
    if (phone) properties.phone = phone;
    if (company) properties.company = company;

    const url = 'https://api.hubapi.com/crm/v3/objects/contacts';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ properties }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('HubSpot create contact failed', {
        status: response.status,
        error: errorText,
      });
      throw new Error(
        `Failed to create contact: ${response.status} ${errorText}`
      );
    }

    const result = await response.json();
    logger.info('HubSpot contact created', { contactId: result.id });
    return result;
  }

  /**
   * Update a contact in HubSpot
   * @param {string} accessToken - HubSpot access token
   * @param {string} contactEmail - Contact email to search for
   * @param {Object} contactData - Contact data to update
   * @returns {Promise<Object>} - Updated contact
   */
  async updateContact(accessToken, contactEmail, contactData) {
    if (!contactEmail) {
      throw new Error('Contact email is required to update a contact');
    }

    // First, search for the contact by email
    const contact = await this.getContactByEmail(accessToken, contactEmail);

    if (!contact) {
      throw new Error(`Contact with email ${contactEmail} not found`);
    }

    const { firstName, lastName, email, phone, company } = contactData;

    const properties = {};
    if (firstName) properties.firstname = firstName;
    if (lastName) properties.lastname = lastName;
    if (email) properties.email = email;
    if (phone) properties.phone = phone;
    if (company) properties.company = company;

    const url = `https://api.hubapi.com/crm/v3/objects/contacts/${contact.id}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ properties }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('HubSpot update contact failed', {
        status: response.status,
        error: errorText,
      });
      throw new Error(
        `Failed to update contact: ${response.status} ${errorText}`
      );
    }

    const result = await response.json();
    logger.info('HubSpot contact updated', { contactId: result.id });
    return result;
  }

  /**
   * Get a contact by email
   * @param {string} accessToken - HubSpot access token
   * @param {string} email - Contact email
   * @returns {Promise<Object|null>} - Contact or null if not found
   */
  async getContactByEmail(accessToken, email) {
    if (!email) {
      throw new Error('Email is required to get a contact');
    }

    // HubSpot V3 Search API
    const url = 'https://api.hubapi.com/crm/v3/objects/contacts/search';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'email',
                operator: 'EQ',
                value: email,
              },
            ],
          },
        ],
        properties: ['firstname', 'lastname', 'email', 'phone', 'company'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('HubSpot get contact failed', {
        status: response.status,
        error: errorText,
      });
      throw new Error(`Failed to get contact: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    if (result.results && result.results.length > 0) {
      return result.results[0];
    }

    return null;
  }

  /**
   * Get all lists from HubSpot
   * @param {string} accessToken - HubSpot access token
   * @returns {Promise<Array>} - List of lists
   */
  async getLists(accessToken) {
    // HubSpot V1 Lists API
    const url = 'https://api.hubapi.com/contacts/v1/lists';
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('HubSpot get lists failed', {
        status: response.status,
        error: errorText,
      });
      throw new Error(`Failed to get lists: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    return result.lists || [];
  }

  /**
   * Get all contacts from HubSpot
   * @param {string} accessToken - HubSpot access token
   * @param {number} limit - Maximum number of contacts to retrieve (default: 100)
   * @returns {Promise<Array>} - List of contacts
   */
  async getContacts(accessToken, limit = 100) {
    const url = `https://api.hubapi.com/crm/v3/objects/contacts?limit=${limit}&properties=firstname,lastname,email,phone,company`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('HubSpot get contacts failed', {
        status: response.status,
        error: errorText,
      });
      throw new Error(
        `Failed to get contacts: ${response.status} ${errorText}`
      );
    }

    const result = await response.json();
    return result.results || [];
  }

  /**
   * Add a contact to a list
   * @param {string} accessToken - HubSpot access token
   * @param {string} contactEmail - Contact email
   * @param {string} listId - List ID
   * @returns {Promise<Object>} - Result
   */
  async addContactToList(accessToken, contactEmail, listId) {
    if (!contactEmail) {
      throw new Error('Contact email is required');
    }
    if (!listId) {
      throw new Error('List ID is required');
    }

    // First, get the contact by email
    const contact = await this.getContactByEmail(accessToken, contactEmail);

    if (!contact) {
      throw new Error(`Contact with email ${contactEmail} not found`);
    }

    // HubSpot V1 Lists API - Add contact to list
    const url = `https://api.hubapi.com/contacts/v1/lists/${listId}/add`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        emails: [contactEmail],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('HubSpot add to list failed', {
        status: response.status,
        error: errorText,
      });
      throw new Error(
        `Failed to add contact to list: ${response.status} ${errorText}`
      );
    }

    const result = await response.json();
    logger.info('HubSpot contact added to list', {
      contactEmail,
      listId,
    });
    return result;
  }

  /**
   * Create a company in HubSpot
   * @param {string} accessToken - HubSpot access token
   * @param {Object} companyData - Company data
   * @returns {Promise<Object>} - Created company
   */
  async createCompany(accessToken, companyData) {
    const { name, domain, phone, city, country, industry } = companyData;

    if (!name) {
      throw new Error('Company name is required');
    }

    const properties = {
      name,
    };
    if (domain) properties.domain = domain;
    if (phone) properties.phone = phone;
    if (city) properties.city = city;
    if (country) properties.country = country;
    if (industry) properties.industry = industry;

    const url = 'https://api.hubapi.com/crm/v3/objects/companies';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ properties }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('HubSpot create company failed', {
        status: response.status,
        error: errorText,
      });
      throw new Error(
        `Failed to create company: ${response.status} ${errorText}`
      );
    }

    const result = await response.json();
    logger.info('HubSpot company created', { companyId: result.id });
    return result;
  }

  /**
   * Update a company in HubSpot
   * @param {string} accessToken - HubSpot access token
   * @param {string} companyId - Company ID
   * @param {Object} companyData - Company data to update
   * @returns {Promise<Object>} - Updated company
   */
  async updateCompany(accessToken, companyId, companyData) {
    if (!companyId) {
      throw new Error('Company ID is required to update a company');
    }

    const { name, domain, phone, city, country, industry } = companyData;

    const properties = {};
    if (name) properties.name = name;
    if (domain) properties.domain = domain;
    if (phone) properties.phone = phone;
    if (city) properties.city = city;
    if (country) properties.country = country;
    if (industry) properties.industry = industry;

    if (Object.keys(properties).length === 0) {
      throw new Error('No valid properties provided to update company');
    }

    const url = `https://api.hubapi.com/crm/v3/objects/companies/${companyId}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ properties }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('HubSpot update company failed', {
        status: response.status,
        error: errorText,
        companyId,
      });
      throw new Error(
        `Failed to update company: ${response.status} ${errorText}`
      );
    }

    const result = await response.json();
    logger.info('HubSpot company updated', { companyId: result.id });
    return result;
  }

  /**
   * Get a company by ID
   * @param {string} accessToken - HubSpot access token
   * @param {string} companyId - Company ID
   * @returns {Promise<Object|null>} - Company or null if not found
   */
  async getCompanyById(accessToken, companyId) {
    if (!companyId) {
      throw new Error('Company ID is required');
    }

    const url = `https://api.hubapi.com/crm/v3/objects/companies/${companyId}?properties=name,domain,phone,city,country,industry`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const errorText = await response.text();
      logger.error('HubSpot get company failed', {
        status: response.status,
        error: errorText,
        companyId,
      });
      throw new Error(`Failed to get company: ${response.status} ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Get a company by domain
   * @param {string} accessToken - HubSpot access token
   * @param {string} domain - Company domain
   * @returns {Promise<Object|null>} - Company or null if not found
   */
  async getCompanyByDomain(accessToken, domain) {
    if (!domain) {
      throw new Error('Domain is required to search for a company');
    }

    // HubSpot V3 Search API
    const url = 'https://api.hubapi.com/crm/v3/objects/companies/search';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'domain',
                operator: 'EQ',
                value: domain,
              },
            ],
          },
        ],
        properties: ['name', 'domain', 'phone', 'city', 'country', 'industry'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('HubSpot search company failed', {
        status: response.status,
        error: errorText,
      });
      throw new Error(
        `Failed to search company: ${response.status} ${errorText}`
      );
    }

    const result = await response.json();
    if (result.results && result.results.length > 0) {
      return result.results[0];
    }

    return null;
  }

  /**
   * Get all companies from HubSpot
   * @param {string} accessToken - HubSpot access token
   * @param {number} limit - Maximum number of companies to retrieve (default: 100)
   * @returns {Promise<Array>} - List of companies
   */
  async getCompanies(accessToken, limit = 100) {
    const url = `https://api.hubapi.com/crm/v3/objects/companies?limit=${limit}&properties=name,domain,phone,city,country,industry`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('HubSpot get companies failed', {
        status: response.status,
        error: errorText,
      });
      throw new Error(
        `Failed to get companies: ${response.status} ${errorText}`
      );
    }

    const result = await response.json();
    return result.results || [];
  }
}

export const hubspotService = new HubSpotService();
