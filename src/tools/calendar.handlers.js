import { InternalFunctionName } from './types.js';
import { googleCalendarService } from '#services/google-calendar.service.js';
import logger from '#config/logger.js';

/**
 * Handle Calendar Tool Calls from OpenAI
 * @param {Object} toolCall - Tool call from OpenAI
 * @param {Object} context - Context with integration config and logger
 * @returns {Promise<{output: string}>} Tool call result
 */
export async function handleCalendarToolCall(toolCall, context) {
  // OpenAI Realtime API sends arguments directly in item, not in item.function
  const name = toolCall.name;
  const argsString = toolCall.arguments || toolCall.function?.arguments || '{}';
  let args;
  try {
    args = typeof argsString === 'string' ? JSON.parse(argsString) : argsString;
  } catch (e) {
    logger.error(e);
    args = {};
  }
  const { integrationConfig, logger: sessionLogger } = context;

  if (!integrationConfig || !integrationConfig.is_complete) {
    throw new Error('Google Calendar integration not configured');
  }

  const config = {
    accessToken: integrationConfig.access_token,
    refreshToken: integrationConfig.refresh_token,
    timeZone: integrationConfig.timezone || 'Europe/Berlin',
    email: integrationConfig.email,
    minimumNoticeHours: integrationConfig.minimum_notice_hours || 1,
    maximumDaysAdvance: integrationConfig.maximum_days_advance || 90,
    maximumDurationHours: integrationConfig.maximum_duration_hours || 8,
    mode: integrationConfig.mode || 'PERSONAL_ASSISTANT',
  };

  try {
    switch (name) {
      case InternalFunctionName.GOOGLE_CALENDAR_LIST_EVENTS: {
        sessionLogger.info(
          `🔍 Listing events from ${args.timeMin} to ${args.timeMax}`,
          {
            timeZone: config.timeZone,
            mode: config.mode,
          }
        );

        const events = await googleCalendarService.listEvents(
          config.accessToken,
          config.refreshToken,
          {
            timeMin: args.timeMin,
            timeMax: args.timeMax,
            timeZone: config.timeZone,
            mode: config.mode,
          }
        );

        sessionLogger.info(
          `✅ Listed ${events.length} events from ${args.timeMin} to ${args.timeMax}`,
          {
            eventCount: events.length,
            events: events.slice(0, 5), // Log first 5 events
          }
        );

        const result = {
          success: true,
          busyTimeSlots: events,
          instruction:
            events.length > 0
              ? `The above slots in "busyTimeSlots" are busy. YOU SHOULD NOT CREATE EVENTS IN THESE SLOTS.`
              : `No events found in the specified time range. The calendar is free.`,
        };

        sessionLogger.info(`📤 Returning result to OpenAI:`, {
          success: result.success,
          eventCount: result.busyTimeSlots.length,
        });

        return {
          output: JSON.stringify(result),
        };
      }

      case InternalFunctionName.GOOGLE_CALENDAR_CREATE_EVENT: {
        const event = await googleCalendarService.createEvent(
          config.accessToken,
          config.refreshToken,
          {
            summary: args.summary,
            description: args.description,
            startDateTime: args.startDateTime,
            endDateTime: args.endDateTime,
            attendees: args.attendees,
            timeZone: config.timeZone,
            email: config.email,
            minimumNoticeHours: config.minimumNoticeHours,
            maximumDaysAdvance: config.maximumDaysAdvance,
            maximumDurationHours: config.maximumDurationHours,
          }
        );

        sessionLogger.info(`Created calendar event: ${event.id}`);

        return {
          output: JSON.stringify({
            success: true,
            data: event,
          }),
        };
      }

      case InternalFunctionName.GOOGLE_CALENDAR_UPDATE_EVENT: {
        const event = await googleCalendarService.updateEvent(
          config.accessToken,
          config.refreshToken,
          {
            eventId: args.eventId,
            summary: args.summary,
            description: args.description,
            startDateTime: args.startDateTime,
            endDateTime: args.endDateTime,
            timeZone: config.timeZone,
          }
        );

        sessionLogger.info(`Updated calendar event: ${args.eventId}`);

        return {
          output: JSON.stringify({
            success: true,
            data: event,
          }),
        };
      }

      case InternalFunctionName.GOOGLE_CALENDAR_DELETE_EVENT: {
        await googleCalendarService.deleteEvent(
          config.accessToken,
          config.refreshToken,
          args.eventId
        );

        sessionLogger.info(`Deleted calendar event: ${args.eventId}`);

        return {
          output: JSON.stringify({
            success: true,
            message: 'Event deleted successfully',
          }),
        };
      }

      default:
        throw new Error(`Unknown calendar tool: ${name}`);
    }
  } catch (error) {
    sessionLogger.error(`Error handling calendar tool ${name}:`, error);

    return {
      output: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
}
