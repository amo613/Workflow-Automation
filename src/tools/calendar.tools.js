import { InternalFunctionName } from './types.js';

/**
 * Helper function for time description
 */
const timeDescription = type =>
  `${type} datetime in the default timezone in ISO format. Eg: 2025-06-18T21:00:00`;

/**
 * Create Event Function Declaration
 * Used by OpenAI to understand how to call this function
 */
export const createEventFunctionDeclaration = () => ({
  type: 'function',
  name: InternalFunctionName.GOOGLE_CALENDAR_CREATE_EVENT,
  description: `Create a new calendar event in the user's personal calendar. YOU CAN ONLY CREATE EVENT WHERE THE SLOT IS FREE. SO A CREATE CALL ALWAYS REQUIRE A VERIFICATION by calling ${InternalFunctionName.GOOGLE_CALENDAR_LIST_EVENTS} function. You can optionally add attendees by providing their email addresses. The calendar owner (the user) is automatically added as an attendee.`,
  parameters: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: 'Title of the event',
      },
      description: {
        type: 'string',
        description: 'Description of the event (optional)',
      },
      startDateTime: {
        type: 'string',
        description: timeDescription('Start'),
      },
      endDateTime: {
        type: 'string',
        description: timeDescription('End'),
      },
      attendees: {
        type: 'array',
        items: {
          type: 'string',
        },
        description:
          'Optional: List of attendee email addresses. Any email address format is accepted. Example: ["user@example.com", "another@domain.com"] or omit this field if no additional attendees.',
      },
    },
    required: ['summary', 'startDateTime', 'endDateTime'],
  },
});

/**
 * Update Event Function Declaration
 */
export const updateEventFunctionDeclaration = () => ({
  type: 'function',
  name: InternalFunctionName.GOOGLE_CALENDAR_UPDATE_EVENT,
  description: `Update an existing calendar event. Confirm the date before updating it. Don't ask directly about the event id, instead get it from other function calls.`,
  parameters: {
    type: 'object',
    properties: {
      eventId: {
        type: 'string',
        description: 'ID of the event to update',
      },
      summary: {
        type: 'string',
        description: 'Updated title of the event',
      },
      description: {
        type: 'string',
        description: 'Updated description of the event',
      },
      startDateTime: {
        type: 'string',
        description: `Updated ${timeDescription('Start')}`,
      },
      endDateTime: {
        type: 'string',
        description: `Updated ${timeDescription('End')}`,
      },
    },
    required: ['eventId'],
  },
});

/**
 * Delete Event Function Declaration
 */
export const deleteEventFunctionDeclaration = () => ({
  type: 'function',
  name: InternalFunctionName.GOOGLE_CALENDAR_DELETE_EVENT,
  description: `Delete a calendar event. Confirm the date before deleting it. Don't ask directly about the event id, instead get it from other function calls.`,
  parameters: {
    type: 'object',
    properties: {
      eventId: {
        type: 'string',
        description: 'ID of the event to delete',
      },
    },
    required: ['eventId'],
  },
});

/**
 * List Events Function Declaration
 */
export const listEventsFunctionDeclaration = () => ({
  type: 'function',
  name: InternalFunctionName.GOOGLE_CALENDAR_LIST_EVENTS,
  description: `List upcoming calendar events. Use it to get calendar availability too`,
  parameters: {
    type: 'object',
    properties: {
      timeMin: {
        type: 'string',
        description: timeDescription('Start'),
      },
      timeMax: {
        type: 'string',
        description: timeDescription('End'),
      },
    },
    required: ['timeMin', 'timeMax'],
  },
});
