import { resolveTemplate } from '#utils/template-engine.js';
import logger from '#config/logger.js';
import { googleSheetsService } from '#services/google-sheets.service.js';
import { getIntegration } from '#services/integration.service.js';

/**
 * Execute Google Sheets Node
 * Supports multiple operations: create, append, update, get, delete
 */
export async function executeGoogleSheets(data, context) {
  const {
    resource,
    operation,
    // Document operations
    title,
    sheets,
    // Sheet operations
    spreadsheetId,
    sheetName,
    // Append/Update operations
    uniqueColumn,
    uniqueValue,
    valuesToSet,
    appendIfNotFound,
    // Get operations
    filters,
    combineFilters,
    // Update operations
    rowIndex,
    // Delete operations
    rowIndices,
  } = data;

  try {
    // Get user ID from context (try multiple locations)
    const userId =
      context.userId ||
      context.workflowInput?.userId ||
      context.variables?.userId;
    if (!userId) {
      logger.error('User ID not found in context', {
        contextKeys: Object.keys(context),
        hasWorkflowInput: !!context.workflowInput,
        workflowInputKeys: context.workflowInput
          ? Object.keys(context.workflowInput)
          : [],
      });
      throw new Error(
        'User ID not found in context. Please ensure you are authenticated.'
      );
    }

    // Get Google Sheets integration for user
    const integration = await getIntegration(userId, 'GOOGLE_SHEETS');
    if (!integration || !integration.accessToken) {
      throw new Error(
        'Google Sheets integration not found or not authenticated. Please connect your Google account in the Settings tab.'
      );
    }

    // Resolve templates
    const resolvedSpreadsheetId = spreadsheetId
      ? resolveTemplate(spreadsheetId, context)
      : null;
    const resolvedSheetName = sheetName
      ? resolveTemplate(sheetName, context)
      : null;

    // Handle different operations based on resource and operation
    if (resource === 'Document') {
      if (operation === 'Create') {
        const resolvedTitle = resolveTemplate(
          title || 'New Spreadsheet',
          context
        );
        const resolvedSheets = sheets || [];

        const result = await googleSheetsService.createSpreadsheet(
          integration.accessToken,
          integration.refreshToken,
          resolvedTitle,
          resolvedSheets
        );

        if (!result.success) {
          throw new Error(result.error);
        }

        return {
          success: true,
          ...result.data,
        };
      } else if (operation === 'Delete') {
        if (!resolvedSpreadsheetId) {
          throw new Error('Spreadsheet ID is required for delete operation');
        }

        // Note: Google Sheets API doesn't have a direct delete method
        // We would need to use Drive API, but for now we'll return an error
        throw new Error(
          'Delete spreadsheet operation not yet implemented. Please delete manually from Google Drive.'
        );
      }
    } else if (resource === 'Sheet Within Document') {
      if (operation === 'Append Row') {
        if (!resolvedSpreadsheetId || !resolvedSheetName) {
          throw new Error(
            'Spreadsheet ID and Sheet Name are required for append operation'
          );
        }

        // Parse valuesToSet
        let resolvedValues = [];
        if (valuesToSet) {
          try {
            const valuesStr =
              typeof valuesToSet === 'string'
                ? valuesToSet
                : JSON.stringify(valuesToSet);
            const parsed = JSON.parse(valuesStr);
            if (Array.isArray(parsed)) {
              resolvedValues = parsed;
            } else if (typeof parsed === 'object') {
              // Convert object to array of values
              resolvedValues = Object.values(parsed);
            } else {
              resolvedValues = [parsed];
            }
          } catch (error) {
            logger.warn('Failed to parse valuesToSet as JSON', {
              error: error.message,
            });
            // Try to parse as template
            const resolved = resolveTemplate(String(valuesToSet), context);
            resolvedValues = [resolved];
          }
        }

        const result = await googleSheetsService.appendRow(
          integration.accessToken,
          integration.refreshToken,
          resolvedSpreadsheetId,
          resolvedSheetName,
          resolvedValues
        );

        if (!result.success) {
          throw new Error(result.error);
        }

        return {
          success: true,
          ...result.data,
        };
      } else if (operation === 'Update Row') {
        if (!resolvedSpreadsheetId || !resolvedSheetName || !rowIndex) {
          throw new Error(
            'Spreadsheet ID, Sheet Name, and Row Index are required for update operation'
          );
        }

        // Parse valuesToSet
        let resolvedValues = [];
        if (valuesToSet) {
          try {
            const valuesStr =
              typeof valuesToSet === 'string'
                ? valuesToSet
                : JSON.stringify(valuesToSet);
            const parsed = JSON.parse(valuesStr);
            if (Array.isArray(parsed)) {
              resolvedValues = parsed;
            } else if (typeof parsed === 'object') {
              resolvedValues = Object.values(parsed);
            } else {
              resolvedValues = [parsed];
            }
          } catch (error) {
            logger.warn('Failed to parse valuesToSet as JSON', {
              error: error.message,
            });
            const resolved = resolveTemplate(String(valuesToSet), context);
            resolvedValues = [resolved];
          }
        }

        const resolvedRowIndex = parseInt(
          resolveTemplate(String(rowIndex), context),
          10
        );

        const result = await googleSheetsService.updateRow(
          integration.accessToken,
          integration.refreshToken,
          resolvedSpreadsheetId,
          resolvedSheetName,
          resolvedRowIndex,
          resolvedValues
        );

        if (!result.success) {
          throw new Error(result.error);
        }

        return {
          success: true,
          ...result.data,
        };
      } else if (operation === 'Get Row(s)') {
        if (!resolvedSpreadsheetId || !resolvedSheetName) {
          throw new Error(
            'Spreadsheet ID and Sheet Name are required for get operation'
          );
        }

        // Parse filters
        let resolvedFilters = [];
        if (filters && Array.isArray(filters)) {
          resolvedFilters = filters.map(filter => ({
            column: resolveTemplate(filter.column || '', context),
            value: resolveTemplate(String(filter.value || ''), context),
          }));
        }

        const resolvedCombine = combineFilters || 'AND';

        const result = await googleSheetsService.getRows(
          integration.accessToken,
          integration.refreshToken,
          resolvedSpreadsheetId,
          resolvedSheetName,
          resolvedFilters,
          resolvedCombine
        );

        if (!result.success) {
          throw new Error(result.error);
        }

        return {
          success: true,
          rows: result.data || [],
          count: result.data?.length || 0,
        };
      } else if (operation === 'Delete Rows') {
        if (!resolvedSpreadsheetId || !resolvedSheetName || !rowIndices) {
          throw new Error(
            'Spreadsheet ID, Sheet Name, and Row Indices are required for delete operation'
          );
        }

        // Parse rowIndices
        let resolvedRowIndices = [];
        try {
          const indicesStr =
            typeof rowIndices === 'string'
              ? rowIndices
              : JSON.stringify(rowIndices);
          const parsed = JSON.parse(indicesStr);
          if (Array.isArray(parsed)) {
            resolvedRowIndices = parsed.map(idx =>
              parseInt(resolveTemplate(String(idx), context), 10)
            );
          } else {
            resolvedRowIndices = [
              parseInt(resolveTemplate(String(parsed), context), 10),
            ];
          }
        } catch (error) {
          logger.warn('Failed to parse rowIndices as JSON', {
            error: error.message,
          });
          throw new Error('Row Indices must be a valid JSON array');
        }

        const result = await googleSheetsService.deleteRows(
          integration.accessToken,
          integration.refreshToken,
          resolvedSpreadsheetId,
          resolvedSheetName,
          resolvedRowIndices
        );

        if (!result.success) {
          throw new Error(result.error);
        }

        return {
          success: true,
          ...result.data,
        };
      } else if (operation === 'Append or Update Row') {
        // Smart operation: search and update or append
        if (
          !resolvedSpreadsheetId ||
          !resolvedSheetName ||
          !uniqueColumn ||
          !uniqueValue
        ) {
          throw new Error(
            'Spreadsheet ID, Sheet Name, Unique Column, and Unique Value are required for append/update operation'
          );
        }

        const resolvedUniqueColumn = resolveTemplate(uniqueColumn, context);
        const resolvedUniqueValue = resolveTemplate(
          String(uniqueValue),
          context
        );

        // Parse valuesToSet
        let resolvedValuesToSet = {};
        if (valuesToSet) {
          try {
            const valuesStr =
              typeof valuesToSet === 'string'
                ? valuesToSet
                : JSON.stringify(valuesToSet);
            resolvedValuesToSet = JSON.parse(valuesStr);
          } catch (error) {
            logger.warn('Failed to parse valuesToSet as JSON', {
              error: error.message,
            });
            // Try to resolve as template
            const resolved = resolveTemplate(String(valuesToSet), context);
            try {
              resolvedValuesToSet = JSON.parse(resolved);
            } catch {
              throw new Error('Values to Set must be a valid JSON object');
            }
          }
        }

        const resolvedAppendIfNotFound = appendIfNotFound !== false; // Default: true

        const result = await googleSheetsService.appendOrUpdateRow(
          integration.accessToken,
          integration.refreshToken,
          resolvedSpreadsheetId,
          resolvedSheetName,
          resolvedUniqueColumn,
          resolvedUniqueValue,
          resolvedValuesToSet,
          resolvedAppendIfNotFound
        );

        if (!result.success) {
          throw new Error(result.error);
        }

        return {
          success: true,
          ...result.data,
        };
      }
    }

    throw new Error(
      `Unknown operation: ${operation} for resource: ${resource}`
    );
  } catch (error) {
    logger.error('Google Sheets operation failed', {
      operation,
      resource,
      error: error.message,
    });
    throw error;
  }
}
