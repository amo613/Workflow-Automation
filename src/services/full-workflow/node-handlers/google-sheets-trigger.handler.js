import logger from '#config/logger.js';

/**
 * Execute Google Sheets Trigger Node
 * This is a trigger node that doesn't execute anything itself
 * It's used to start workflows when triggered
 */
export async function executeGoogleSheetsTrigger(data, context) {
  // Trigger nodes don't execute anything themselves
  // They just pass through the trigger data
  logger.info('Google Sheets Trigger executed', {
    spreadsheetId: data.spreadsheetId,
    sheetName: data.sheetName,
    triggerOn: data.triggerOn,
  });

  return {
    success: true,
    triggerData: {
      spreadsheetId: data.spreadsheetId,
      sheetName: data.sheetName,
      triggerOn: data.triggerOn,
      event: context.event || 'triggered',
      row: context.row || null,
    },
  };
}
