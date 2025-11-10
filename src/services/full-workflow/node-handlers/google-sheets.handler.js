import { resolveTemplate } from '#utils/template-engine.js';
import logger from '#config/logger.js';
import { google } from 'googleapis';
import { getIntegration } from '#services/integration.service.js';

/**
 * Execute Google Sheets Node
 * Appends data to a Google Sheet
 */
export async function executeGoogleSheets(data, context) {
  const { spreadsheet_id, range, values } = data;

  if (!spreadsheet_id || !range || !values) {
    throw new Error('Spreadsheet ID, range, and values are required');
  }

  // Resolve templates
  const resolvedSpreadsheetId = resolveTemplate(spreadsheet_id, context);
  const resolvedRange = resolveTemplate(range, context);
  let resolvedValues = [];

  try {
    const valuesStr = resolveTemplate(values, context);
    resolvedValues = JSON.parse(valuesStr);
    if (!Array.isArray(resolvedValues)) {
      resolvedValues = [resolvedValues];
    }
  } catch (error) {
    logger.error('Failed to parse values as JSON', {
      error: error.message,
    });
    throw new Error('Values must be a valid JSON array');
  }

  try {
    // Get user ID from context
    const userId = context.userId || context.workflowInput?.userId;
    if (!userId) {
      throw new Error('User ID not found in context');
    }

    // Get Google integration for user
    const integration = await getIntegration(userId, 'google');
    if (!integration || !integration.access_token) {
      throw new Error('Google integration not found or not authenticated');
    }

    // Initialize Google Sheets API
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: integration.access_token,
      refresh_token: integration.refresh_token,
    });

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    // Append values to sheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: resolvedSpreadsheetId,
      range: resolvedRange,
      valueInputOption: 'RAW',
      requestBody: {
        values: resolvedValues,
      },
    });

    logger.info('Google Sheets updated', {
      spreadsheetId: resolvedSpreadsheetId,
      range: resolvedRange,
      rowsAppended: resolvedValues.length,
    });

    return {
      success: true,
      spreadsheetId: resolvedSpreadsheetId,
      range: resolvedRange,
      updatedCells: response.data.updates?.updatedCells || 0,
      updatedRows: response.data.updates?.updatedRows || 0,
    };
  } catch (error) {
    logger.error('Google Sheets update failed', {
      spreadsheetId: resolvedSpreadsheetId,
      error: error.message,
    });
    throw error;
  }
}
