import { google } from 'googleapis';
import logger from '#config/logger.js';

// ✅ Cache Google OAuth clients per user to avoid recreating
const oauth2ClientCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Google Sheets Service
 * Handles Google Sheets API operations
 */
export class GoogleSheetsService {
  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID;
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    // Use base redirect URI and construct full URI when needed
    this.baseRedirectUri =
      process.env.GOOGLE_REDIRECT_URI_BASE || process.env.GOOGLE_REDIRECT_URI;
    this.redirectUri = this.baseRedirectUri;

    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      logger.warn(
        'Google OAuth credentials not fully configured. Google Sheets operations may fail.'
      );
    }
  }

  /**
   * Get Google Sheets Client
   * @param {string} accessToken - OAuth access token
   * @param {string} refreshToken - OAuth refresh token (optional)
   * @returns {google.sheets_v4.Sheets} Google Sheets API client
   */
  getSheetsClient(accessToken, refreshToken = null) {
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new Error('Google OAuth credentials not configured');
    }

    // ✅ Check cache first
    const cacheKey = `${accessToken.substring(0, 20)}-${refreshToken?.substring(0, 20) || 'none'}`;
    const cached = oauth2ClientCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug('Using cached Google OAuth client');
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

    const sheetsClient = google.sheets({ version: 'v4', auth: oauth2Client });

    // ✅ Cache the client
    oauth2ClientCache.set(cacheKey, {
      client: sheetsClient,
      timestamp: Date.now(),
    });

    // ✅ Clean old cache entries (max 100)
    if (oauth2ClientCache.size > 100) {
      const oldestKey = oauth2ClientCache.keys().next().value;
      oauth2ClientCache.delete(oldestKey);
    }

    return sheetsClient;
  }

  /**
   * Create a new spreadsheet
   * @param {string} accessToken - OAuth access token
   * @param {string} refreshToken - OAuth refresh token
   * @param {string} title - Spreadsheet title
   * @param {Array<{title: string, hidden?: boolean}>} sheets - Initial sheets
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async createSpreadsheet(accessToken, refreshToken, title, sheets = []) {
    const sheetsClient = this.getSheetsClient(accessToken, refreshToken);

    try {
      const requestBody = {
        properties: {
          title,
        },
      };

      if (sheets.length > 0) {
        requestBody.sheets = sheets.map(sheet => ({
          properties: {
            title: sheet.title,
            hidden: sheet.hidden || false,
          },
        }));
      }

      const response = await sheetsClient.spreadsheets.create({
        requestBody,
      });

      logger.info(`Created spreadsheet: ${response.data.spreadsheetId}`);

      return {
        success: true,
        data: {
          spreadsheetId: response.data.spreadsheetId,
          spreadsheetUrl: response.data.spreadsheetUrl,
          title: response.data.properties?.title,
        },
      };
    } catch (error) {
      logger.error('Error creating spreadsheet:', error);

      if (error.code === 403) {
        return {
          success: false,
          error:
            'Permission denied. Please check your Google Sheets permissions.',
        };
      }
      if (error.code === 429) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
        };
      }

      return {
        success: false,
        error: `Failed to create spreadsheet: ${error.message}`,
      };
    }
  }

  /**
   * Append a row to a sheet
   * @param {string} accessToken - OAuth access token
   * @param {string} refreshToken - OAuth refresh token
   * @param {string} spreadsheetId - Spreadsheet ID
   * @param {string} sheetName - Sheet name
   * @param {Array<any>} values - Row values
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async appendRow(accessToken, refreshToken, spreadsheetId, sheetName, values) {
    const sheetsClient = this.getSheetsClient(accessToken, refreshToken);

    try {
      const range = `${sheetName}!A:Z`;
      const response = await sheetsClient.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [values],
        },
      });

      logger.info(`Appended row to ${sheetName} in ${spreadsheetId}`);

      return {
        success: true,
        data: {
          updatedRange: response.data.updates?.updatedRange,
          updatedRows: response.data.updates?.updatedRows,
          updatedColumns: response.data.updates?.updatedColumns,
          updatedCells: response.data.updates?.updatedCells,
        },
      };
    } catch (error) {
      logger.error('Error appending row:', error);

      if (error.code === 404) {
        return {
          success: false,
          error:
            'Spreadsheet or sheet not found. Please check the ID and sheet name.',
        };
      }
      if (error.code === 403) {
        return {
          success: false,
          error:
            'Permission denied. Please check your Google Sheets permissions.',
        };
      }
      if (error.code === 429) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
        };
      }

      return {
        success: false,
        error: `Failed to append row: ${error.message}`,
      };
    }
  }

  /**
   * Update a row in a sheet
   * @param {string} accessToken - OAuth access token
   * @param {string} refreshToken - OAuth refresh token
   * @param {string} spreadsheetId - Spreadsheet ID
   * @param {string} sheetName - Sheet name
   * @param {number} rowIndex - Row index (1-based)
   * @param {Array<any>} values - Row values
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async updateRow(
    accessToken,
    refreshToken,
    spreadsheetId,
    sheetName,
    rowIndex,
    values
  ) {
    const sheetsClient = this.getSheetsClient(accessToken, refreshToken);

    try {
      const range = `${sheetName}!${rowIndex}:${rowIndex}`;
      const response = await sheetsClient.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [values],
        },
      });

      logger.info(
        `Updated row ${rowIndex} in ${sheetName} of ${spreadsheetId}`
      );

      return {
        success: true,
        data: {
          updatedRange: response.data.updatedRange,
          updatedRows: response.data.updatedRows,
          updatedColumns: response.data.updatedColumns,
          updatedCells: response.data.updatedCells,
        },
      };
    } catch (error) {
      logger.error('Error updating row:', error);

      if (error.code === 404) {
        return {
          success: false,
          error:
            'Spreadsheet or sheet not found. Please check the ID and sheet name.',
        };
      }
      if (error.code === 403) {
        return {
          success: false,
          error:
            'Permission denied. Please check your Google Sheets permissions.',
        };
      }
      if (error.code === 429) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
        };
      }

      return {
        success: false,
        error: `Failed to update row: ${error.message}`,
      };
    }
  }

  /**
   * Get rows from a sheet with optional filters
   * @param {string} accessToken - OAuth access token
   * @param {string} refreshToken - OAuth refresh token
   * @param {string} spreadsheetId - Spreadsheet ID
   * @param {string} sheetName - Sheet name
   * @param {Array<{column: string, value: any}>} filters - Optional filters
   * @param {'AND'|'OR'} combine - How to combine filters (default: 'AND')
   * @returns {Promise<{success: boolean, data?: Array<Object>, error?: string}>}
   */
  async getRows(
    accessToken,
    refreshToken,
    spreadsheetId,
    sheetName,
    filters = [],
    combine = 'AND'
  ) {
    const sheetsClient = this.getSheetsClient(accessToken, refreshToken);

    try {
      // First, get the sheet metadata to find the range
      const spreadsheet = await sheetsClient.spreadsheets.get({
        spreadsheetId,
      });

      const sheet = spreadsheet.data.sheets?.find(
        s => s.properties?.title === sheetName
      );

      if (!sheet) {
        return {
          success: false,
          error: `Sheet "${sheetName}" not found in spreadsheet.`,
        };
      }

      const range = `${sheetName}!A:Z`;
      const response = await sheetsClient.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const rows = response.data.values || [];
      if (rows.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      // First row is headers
      const headers = rows[0].map((h, i) => h || `col_${i + 1}`);
      const dataRows = rows.slice(1);

      // Convert to objects with column names as keys
      let result = dataRows.map(row => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || null;
        });
        return obj;
      });

      // Apply filters if provided
      if (filters.length > 0) {
        result = result.filter(row => {
          if (combine === 'OR') {
            return filters.some(filter => {
              const columnValue = String(row[filter.column] || '');
              const filterValue = String(filter.value || '');
              return columnValue === filterValue;
            });
          } else {
            // AND (default)
            return filters.every(filter => {
              const columnValue = String(row[filter.column] || '');
              const filterValue = String(filter.value || '');
              return columnValue === filterValue;
            });
          }
        });
      }

      logger.info(
        `Retrieved ${result.length} rows from ${sheetName} in ${spreadsheetId}`
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      logger.error('Error getting rows:', error);

      if (error.code === 404) {
        return {
          success: false,
          error:
            'Spreadsheet or sheet not found. Please check the ID and sheet name.',
        };
      }
      if (error.code === 403) {
        return {
          success: false,
          error:
            'Permission denied. Please check your Google Sheets permissions.',
        };
      }
      if (error.code === 429) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
        };
      }

      return {
        success: false,
        error: `Failed to get rows: ${error.message}`,
      };
    }
  }

  /**
   * Delete rows from a sheet
   * @param {string} accessToken - OAuth access token
   * @param {string} refreshToken - OAuth refresh token
   * @param {string} spreadsheetId - Spreadsheet ID
   * @param {string} sheetName - Sheet name
   * @param {Array<number>} rowIndices - Row indices (1-based) to delete
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async deleteRows(
    accessToken,
    refreshToken,
    spreadsheetId,
    sheetName,
    rowIndices
  ) {
    const sheetsClient = this.getSheetsClient(accessToken, refreshToken);

    try {
      // Sort row indices in descending order to delete from bottom to top
      const sortedIndices = [...rowIndices].sort((a, b) => b - a);

      // Get sheet ID first
      const spreadsheet = await sheetsClient.spreadsheets.get({
        spreadsheetId,
      });

      const sheet = spreadsheet.data.sheets?.find(
        s => s.properties?.title === sheetName
      );

      if (!sheet) {
        return {
          success: false,
          error: `Sheet "${sheetName}" not found in spreadsheet.`,
        };
      }

      const sheetId = sheet.properties.sheetId;

      // Build delete requests
      const requests = sortedIndices.map(rowIndex => ({
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex - 1, // Convert to 0-based
            endIndex: rowIndex, // End is exclusive
          },
        },
      }));

      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests,
        },
      });

      logger.info(
        `Deleted ${rowIndices.length} rows from ${sheetName} in ${spreadsheetId}`
      );

      return {
        success: true,
        data: {
          deletedRows: rowIndices.length,
        },
      };
    } catch (error) {
      logger.error('Error deleting rows:', error);

      if (error.code === 404) {
        return {
          success: false,
          error:
            'Spreadsheet or sheet not found. Please check the ID and sheet name.',
        };
      }
      if (error.code === 403) {
        return {
          success: false,
          error:
            'Permission denied. Please check your Google Sheets permissions.',
        };
      }
      if (error.code === 429) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
        };
      }

      return {
        success: false,
        error: `Failed to delete rows: ${error.message}`,
      };
    }
  }

  /**
   * Smart operation: Append or Update row based on unique identifier
   * @param {string} accessToken - OAuth access token
   * @param {string} refreshToken - OAuth refresh token
   * @param {string} spreadsheetId - Spreadsheet ID
   * @param {string} sheetName - Sheet name
   * @param {string} uniqueColumn - Column name to search for unique value
   * @param {any} uniqueValue - Value to match
   * @param {Object} valuesToSet - Key-value pairs to set
   * @param {boolean} appendIfNotFound - Whether to append if not found (default: true)
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async appendOrUpdateRow(
    accessToken,
    refreshToken,
    spreadsheetId,
    sheetName,
    uniqueColumn,
    uniqueValue,
    valuesToSet,
    appendIfNotFound = true
  ) {
    try {
      // First, search for existing row
      const searchResult = await this.getRows(
        accessToken,
        refreshToken,
        spreadsheetId,
        sheetName,
        [{ column: uniqueColumn, value: uniqueValue }],
        'AND'
      );

      if (!searchResult.success) {
        return searchResult;
      }

      const existingRows = searchResult.data || [];

      if (existingRows.length > 0) {
        // Update existing row
        const existingRow = existingRows[0];

        // Get headers to determine row index
        const allRowsResult = await this.getRows(
          accessToken,
          refreshToken,
          spreadsheetId,
          sheetName,
          [],
          'AND'
        );

        if (!allRowsResult.success) {
          return allRowsResult;
        }

        // Find row index (1-based, +1 for header row)
        const allRows = allRowsResult.data || [];
        const rowIndex = allRows.findIndex(
          row => String(row[uniqueColumn]) === String(uniqueValue)
        );

        if (rowIndex === -1) {
          return {
            success: false,
            error: 'Row found but could not determine row index.',
          };
        }

        // Get headers
        const headersResult = await this.getRows(
          accessToken,
          refreshToken,
          spreadsheetId,
          sheetName,
          [],
          'AND'
        );

        if (!headersResult.success) {
          return headersResult;
        }

        // Build update values array based on headers
        const sheetsClient = this.getSheetsClient(accessToken, refreshToken);
        const headersResponse = await sheetsClient.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!1:1`, // Get header row
        });

        const headers = headersResponse.data.values?.[0] || [];
        const updateValues = headers.map(header => {
          if (valuesToSet[header] !== undefined) {
            return valuesToSet[header];
          }
          return existingRow[header] || '';
        });

        return await this.updateRow(
          accessToken,
          refreshToken,
          spreadsheetId,
          sheetName,
          rowIndex + 2, // +2 because: +1 for header, +1 for 0-based to 1-based
          updateValues
        );
      } else {
        // Append new row
        if (!appendIfNotFound) {
          return {
            success: false,
            error: 'Row not found and appendIfNotFound is false.',
          };
        }

        // Get headers to build new row
        const headersResult = await this.getRows(
          accessToken,
          refreshToken,
          spreadsheetId,
          sheetName,
          [],
          'AND'
        );

        if (!headersResult.success) {
          return headersResult;
        }

        const sheetsClient = this.getSheetsClient(accessToken, refreshToken);
        const headersResponse = await sheetsClient.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!1:1`, // Get header row
        });

        const headers = headersResponse.data.values?.[0] || [];
        const newRowValues = headers.map(header => {
          if (valuesToSet[header] !== undefined) {
            return valuesToSet[header];
          }
          if (header === uniqueColumn) {
            return uniqueValue;
          }
          return '';
        });

        const appendResult = await this.appendRow(
          accessToken,
          refreshToken,
          spreadsheetId,
          sheetName,
          newRowValues
        );

        if (appendResult.success) {
          return {
            success: true,
            data: {
              ...appendResult.data,
              action: 'appended',
            },
          };
        }

        return appendResult;
      }
    } catch (error) {
      logger.error('Error in appendOrUpdateRow:', error);
      return {
        success: false,
        error: `Failed to append or update row: ${error.message}`,
      };
    }
  }

  /**
   * List all spreadsheets for the user
   * @param {string} accessToken - OAuth access token
   * @param {string} refreshToken - OAuth refresh token
   * @returns {Promise<{success: boolean, data?: Array<Object>, error?: string}>}
   */
  async listSpreadsheets(accessToken, refreshToken) {
    try {
      // Use Drive API to list spreadsheets
      const oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
        this.redirectUri
      );

      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken || null,
      });

      // Try to refresh token if needed
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        if (credentials.access_token) {
          oauth2Client.setCredentials(credentials);
        }
      } catch (refreshError) {
        // If refresh fails, continue with existing token
        logger.warn(
          'Token refresh failed, using existing token:',
          refreshError.message
        );
      }

      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
        fields: 'files(id, name, createdTime, modifiedTime)',
        pageSize: 100,
        orderBy: 'modifiedTime desc',
      });

      const spreadsheets = (response.data.files || []).map(file => ({
        id: file.id,
        name: file.name,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
      }));

      logger.info(`Listed ${spreadsheets.length} spreadsheets`);

      return {
        success: true,
        data: spreadsheets,
      };
    } catch (error) {
      logger.error('Error listing spreadsheets:', error);

      if (error.code === 403) {
        return {
          success: false,
          error:
            'Permission denied. Please check your Google Drive permissions.',
        };
      }
      if (error.code === 429) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
        };
      }

      return {
        success: false,
        error: `Failed to list spreadsheets: ${error.message}`,
      };
    }
  }

  /**
   * Get sheets in a spreadsheet
   * @param {string} accessToken - OAuth access token
   * @param {string} refreshToken - OAuth refresh token
   * @param {string} spreadsheetId - Spreadsheet ID
   * @returns {Promise<{success: boolean, data?: Array<Object>, error?: string}>}
   */
  async getSheets(accessToken, refreshToken, spreadsheetId) {
    try {
      const sheetsClient = this.getSheetsClient(accessToken, refreshToken);

      logger.info(`Getting sheets for spreadsheet: ${spreadsheetId}`);

      const response = await sheetsClient.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties(title,sheetId,index,hidden)',
      });

      const sheets = (response.data.sheets || []).map(sheet => ({
        title: sheet.properties?.title || 'Untitled',
        sheetId: sheet.properties?.sheetId,
        index: sheet.properties?.index || 0,
        hidden: sheet.properties?.hidden || false,
      }));

      logger.info(
        `Retrieved ${sheets.length} sheets for spreadsheet ${spreadsheetId}`,
        {
          sheetNames: sheets.map(s => s.title),
        }
      );

      return {
        success: true,
        data: sheets,
      };
    } catch (error) {
      logger.error('Error getting sheets:', {
        error: error.message,
        code: error.code,
        spreadsheetId,
        stack: error.stack,
      });

      if (error.code === 404) {
        return {
          success: false,
          error: 'Spreadsheet not found. Please check the ID.',
        };
      }
      if (error.code === 403) {
        return {
          success: false,
          error:
            'Permission denied. Please check your Google Sheets permissions.',
        };
      }
      if (error.code === 429) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
        };
      }

      return {
        success: false,
        error: `Failed to get sheets: ${error.message}`,
      };
    }
  }

  /**
   * Get columns (headers) from a sheet
   * @param {string} accessToken - OAuth access token
   * @param {string} refreshToken - OAuth refresh token
   * @param {string} spreadsheetId - Spreadsheet ID
   * @param {string} sheetName - Sheet name
   * @returns {Promise<{success: boolean, data?: Array<string>, error?: string}>}
   */
  async getColumns(accessToken, refreshToken, spreadsheetId, sheetName) {
    const sheetsClient = this.getSheetsClient(accessToken, refreshToken);

    try {
      logger.info(
        `Getting columns for sheet: ${sheetName} in spreadsheet: ${spreadsheetId}`
      );

      // Get first row (headers)
      const range = `${sheetName}!1:1`;
      const response = await sheetsClient.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const headers = response.data.values?.[0] || [];
      // Map empty headers to col_1, col_2, etc.
      const columns = headers.map((h, i) => h || `col_${i + 1}`);

      logger.info(
        `Retrieved ${columns.length} columns for sheet ${sheetName}`,
        {
          columns,
        }
      );

      return {
        success: true,
        data: columns,
      };
    } catch (error) {
      logger.error('Error getting columns:', {
        error: error.message,
        code: error.code,
        spreadsheetId,
        sheetName,
      });

      return {
        success: false,
        error: `Failed to get columns: ${error.message}`,
      };
    }
  }
}

export const googleSheetsService = new GoogleSheetsService();
