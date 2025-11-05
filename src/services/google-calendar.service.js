import { google } from 'googleapis';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import logger from '#config/logger.js';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Google Calendar Service
 * Handles Google Calendar API operations
 */
export class GoogleCalendarService {
  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID;
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    this.redirectUri = process.env.GOOGLE_REDIRECT_URI;
  }

  /**
   * Erstelle Google Calendar Client
   * @param {string} accessToken - OAuth access token
   * @param {string} refreshToken - OAuth refresh token (optional)
   * @returns {google.calendar_v3.Calendar} Google Calendar API client
   */
  getCalendarClient(accessToken, refreshToken = null) {
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new Error('Google OAuth credentials not configured');
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

    return google.calendar({ version: 'v3', auth: oauth2Client });
  }

  /**
   * Liste Events für einen Zeitraum
   * @param {string} accessToken - OAuth access token
   * @param {string} refreshToken - OAuth refresh token
   * @param {Object} config - Configuration
   * @param {string} config.timeMin - Start time (local timezone, ISO format without timezone)
   * @param {string} config.timeMax - End time (local timezone, ISO format without timezone)
   * @param {string} config.timeZone - Timezone (e.g., 'Europe/Berlin')
   * @param {string} config.mode - 'MEETING_SCHEDULER' | 'PERSONAL_ASSISTANT'
   * @returns {Promise<Array>} List of events
   */
  async listEvents(accessToken, refreshToken, config) {
    const { timeMin, timeMax, timeZone, mode = 'PERSONAL_ASSISTANT' } = config;

    // Validate timezone format
    if (timeMin.endsWith('Z') || timeMin.includes('+')) {
      throw new Error(
        `Start time contains timezone information. Use local time for ${timeZone}`
      );
    }
    if (timeMax.endsWith('Z') || timeMax.includes('+')) {
      throw new Error(
        `End time contains timezone information. Use local time for ${timeZone}`
      );
    }

    const timeMinISO = dayjs(timeMin).tz(timeZone).toISOString();
    const timeMaxISO = dayjs(timeMax).tz(timeZone).toISOString();

    const calendar = this.getCalendarClient(accessToken, refreshToken);

    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMinISO,
        timeMax: timeMaxISO,
        maxResults: 30,
        singleEvents: true,
        orderBy: 'startTime',
        timeZone,
      });

      if (mode === 'MEETING_SCHEDULER') {
        return (
          response.data.items?.map(e => ({
            start: e.start?.dateTime,
            end: e.end?.dateTime,
            status: 'BUSY',
          })) || []
        );
      } else {
        return (
          response.data.items?.map(e => ({
            id: e.id,
            summary: e.summary,
            description: e.description,
            start: e.start?.dateTime,
            end: e.end?.dateTime,
            attendees: e.attendees?.map(a => a.email),
            status: e.status,
          })) || []
        );
      }
    } catch (error) {
      logger.error('Error listing calendar events:', error);
      throw new Error(`Failed to list events: ${error.message}`);
    }
  }

  /**
   * Erstelle ein neues Event
   * @param {string} accessToken - OAuth access token
   * @param {string} refreshToken - OAuth refresh token
   * @param {Object} config - Event configuration
   * @returns {Promise<Object>} Created event
   */
  async createEvent(accessToken, refreshToken, config) {
    const {
      summary,
      description,
      startDateTime,
      endDateTime,
      attendees = [],
      timeZone,
      email,
      minimumNoticeHours,
      maximumDaysAdvance,
      maximumDurationHours,
    } = config;

    // Validate timezone format
    if (startDateTime.endsWith('Z') || startDateTime.includes('+')) {
      throw new Error(
        `Start time contains timezone information. Use local time for ${timeZone}`
      );
    }
    if (endDateTime.endsWith('Z') || endDateTime.includes('+')) {
      throw new Error(
        `End time contains timezone information. Use local time for ${timeZone}`
      );
    }

    const startISO = dayjs(startDateTime).tz(timeZone).toISOString();
    const endISO = dayjs(endDateTime).tz(timeZone).toISOString();

    // Check if start is before end
    if (dayjs(startISO).isAfter(dayjs(endISO))) {
      throw new Error(
        `Start time is after end time. Start: ${startISO}, End: ${endISO}`
      );
    }

    const currentTime = dayjs().tz(timeZone).toISOString();

    // Check if start is in the past
    if (dayjs(currentTime).isAfter(dayjs(startISO))) {
      throw new Error(
        `Start time is in the past. Start: ${startISO}, Current: ${currentTime}`
      );
    }

    // Validate minimum notice
    const minimumNoticeTime = dayjs(currentTime)
      .add(minimumNoticeHours, 'hours')
      .toISOString();
    if (dayjs(startISO).isBefore(dayjs(minimumNoticeTime))) {
      throw new Error(
        `Start time is before minimum notice. Start: ${startISO}, Minimum: ${minimumNoticeTime}`
      );
    }

    // Validate maximum days in advance
    const maximumAdvanceTime = dayjs(currentTime)
      .add(maximumDaysAdvance, 'days')
      .toISOString();
    if (dayjs(endISO).isAfter(dayjs(maximumAdvanceTime))) {
      throw new Error(
        `End time is after maximum days in advance. End: ${endISO}, Maximum: ${maximumAdvanceTime}`
      );
    }

    // Validate duration
    const durationHours = dayjs(endISO).diff(dayjs(startISO), 'hours');
    if (durationHours > maximumDurationHours) {
      throw new Error(
        `Duration is more than maximum duration. Duration: ${durationHours}h, Maximum: ${maximumDurationHours}h`
      );
    }

    const calendar = this.getCalendarClient(accessToken, refreshToken);

    // Check if slot is free
    try {
      const existingEvents = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startISO,
        timeMax: endISO,
        maxResults: 1,
        singleEvents: true,
        orderBy: 'startTime',
      });

      if (existingEvents.data.items && existingEvents.data.items.length > 0) {
        throw new Error(`Slot is not free. Start: ${startISO}, End: ${endISO}`);
      }
    } catch (error) {
      if (error.message.includes('Slot is not free')) {
        throw error;
      }
      logger.warn('Error checking slot availability:', error);
      // Continue anyway, let Google Calendar handle it
    }

    // Create event
    const event = {
      summary,
      description,
      start: { dateTime: startISO },
      end: { dateTime: endISO },
      attendees: [
        ...attendees.map(emailAddr => ({ email: emailAddr })),
        { email },
      ],
    };

    try {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });

      logger.info(`Created calendar event: ${response.data.id}`);

      return {
        id: response.data.id,
        summary: response.data.summary,
        description: response.data.description,
        start: response.data.start,
        end: response.data.end,
        attendees: response.data.attendees?.map(a => a.email),
      };
    } catch (error) {
      logger.error('Error creating calendar event:', error);
      throw new Error(`Failed to create event: ${error.message}`);
    }
  }

  /**
   * Update ein bestehendes Event
   * @param {string} accessToken - OAuth access token
   * @param {string} refreshToken - OAuth refresh token
   * @param {Object} config - Update configuration
   * @returns {Promise<Object>} Updated event
   */
  async updateEvent(accessToken, refreshToken, config) {
    const {
      eventId,
      summary,
      description,
      startDateTime,
      endDateTime,
      timeZone,
    } = config;

    const calendar = this.getCalendarClient(accessToken, refreshToken);
    const event = {};

    if (summary) event.summary = summary;
    if (description) event.description = description;
    if (startDateTime) {
      const startISO = dayjs(startDateTime).tz(timeZone).toISOString();
      event.start = { dateTime: startISO, timeZone };
    }
    if (endDateTime) {
      const endISO = dayjs(endDateTime).tz(timeZone).toISOString();
      event.end = { dateTime: endISO, timeZone };
    }

    try {
      const response = await calendar.events.patch({
        calendarId: 'primary',
        eventId,
        requestBody: event,
      });

      logger.info(`Updated calendar event: ${eventId}`);

      return {
        id: response.data.id,
        summary: response.data.summary,
        description: response.data.description,
        start: response.data.start,
        end: response.data.end,
        attendees: response.data.attendees?.map(a => a.email),
      };
    } catch (error) {
      logger.error('Error updating calendar event:', error);
      throw new Error(`Failed to update event: ${error.message}`);
    }
  }

  /**
   * Lösche ein Event
   * @param {string} accessToken - OAuth access token
   * @param {string} refreshToken - OAuth refresh token
   * @param {string} eventId - Event ID to delete
   * @returns {Promise<void>}
   */
  async deleteEvent(accessToken, refreshToken, eventId) {
    const calendar = this.getCalendarClient(accessToken, refreshToken);

    try {
      await calendar.events.delete({
        calendarId: 'primary',
        eventId,
      });

      logger.info(`Deleted calendar event: ${eventId}`);
    } catch (error) {
      logger.error('Error deleting calendar event:', error);
      throw new Error(`Failed to delete event: ${error.message}`);
    }
  }

  /**
   * Get user email from Google Calendar
   * @param {string} accessToken - OAuth access token
   * @param {string} refreshToken - OAuth refresh token
   * @returns {Promise<string>} User email
   */
  async getUserEmail(accessToken, refreshToken) {
    const calendar = this.getCalendarClient(accessToken, refreshToken);

    try {
      const calendarList = await calendar.calendarList.list();
      const primaryCalendar = calendarList.data.items?.find(c => c.primary);

      return primaryCalendar?.id || 'unknown';
    } catch (error) {
      logger.error('Error getting user email:', error);
      throw new Error(`Failed to get user email: ${error.message}`);
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();
