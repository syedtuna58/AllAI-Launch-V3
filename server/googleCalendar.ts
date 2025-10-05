import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-calendar',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Calendar not connected');
  }
  return accessToken;
}

async function getUncachableGoogleCalendarClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export async function createCalendarEvent(
  summary: string,
  description: string,
  startDateTime: Date,
  endDateTime: Date,
  attendeeEmails?: string[]
) {
  try {
    const calendar = await getUncachableGoogleCalendarClient();

    const event = {
      summary,
      description,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'America/Los_Angeles',
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'America/Los_Angeles',
      },
      attendees: attendeeEmails?.map(email => ({ email })) || [],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      sendUpdates: 'all',
    });

    return response.data.id;
  } catch (error) {
    console.error('Error creating Google Calendar event:', error);
    throw error;
  }
}

export async function updateCalendarEvent(
  eventId: string,
  summary: string,
  description: string,
  startDateTime: Date,
  endDateTime: Date,
  attendeeEmails?: string[]
) {
  try {
    const calendar = await getUncachableGoogleCalendarClient();

    const event = {
      summary,
      description,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'America/Los_Angeles',
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'America/Los_Angeles',
      },
      attendees: attendeeEmails?.map(email => ({ email })) || [],
    };

    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId,
      requestBody: event,
      sendUpdates: 'all',
    });

    return response.data.id;
  } catch (error) {
    console.error('Error updating Google Calendar event:', error);
    throw error;
  }
}

export async function checkAvailability(
  startDateTime: Date,
  endDateTime: Date
): Promise<{ available: boolean; conflicts: any[] }> {
  try {
    const calendar = await getUncachableGoogleCalendarClient();

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startDateTime.toISOString(),
      timeMax: endDateTime.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];
    
    const conflicts = events.filter(event => {
      if (!event.start?.dateTime || !event.end?.dateTime) return false;
      
      const eventStart = new Date(event.start.dateTime);
      const eventEnd = new Date(event.end.dateTime);
      
      const overlaps = (
        (startDateTime >= eventStart && startDateTime < eventEnd) ||
        (endDateTime > eventStart && endDateTime <= eventEnd) ||
        (startDateTime <= eventStart && endDateTime >= eventEnd)
      );
      
      return overlaps;
    });

    return {
      available: conflicts.length === 0,
      conflicts: conflicts.map(c => ({
        summary: c.summary,
        start: c.start?.dateTime,
        end: c.end?.dateTime,
      }))
    };
  } catch (error) {
    console.error('Error checking calendar availability:', error);
    throw new Error('Failed to check calendar availability. Please try again or contact support.');
  }
}

export async function findAvailableSlots(
  startDate: Date,
  endDate: Date,
  durationMinutes: number
): Promise<{ start: Date; end: Date }[]> {
  try {
    const calendar = await getUncachableGoogleCalendarClient();

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const busyEvents = (response.data.items || []).filter(
      e => e.start?.dateTime && e.end?.dateTime
    );

    const availableSlots: { start: Date; end: Date }[] = [];
    const workingHoursStart = 9;
    const workingHoursEnd = 17;

    let currentDate = new Date(startDate);
    while (currentDate < endDate) {
      if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      let slotStart = new Date(currentDate);
      slotStart.setHours(workingHoursStart, 0, 0, 0);
      
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(workingHoursEnd, 0, 0, 0);

      while (slotStart < dayEnd) {
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);
        
        if (slotEnd > dayEnd) break;

        const hasConflict = busyEvents.some(event => {
          const eventStart = new Date(event.start!.dateTime!);
          const eventEnd = new Date(event.end!.dateTime!);
          
          return (
            (slotStart >= eventStart && slotStart < eventEnd) ||
            (slotEnd > eventStart && slotEnd <= eventEnd) ||
            (slotStart <= eventStart && slotEnd >= eventEnd)
          );
        });

        if (!hasConflict) {
          availableSlots.push({
            start: new Date(slotStart),
            end: new Date(slotEnd),
          });
        }

        slotStart = new Date(slotEnd);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return availableSlots.slice(0, 10);
  } catch (error) {
    console.error('Error finding available slots:', error);
    return [];
  }
}

export async function deleteCalendarEvent(eventId: string) {
  try {
    const calendar = await getUncachableGoogleCalendarClient();

    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
      sendUpdates: 'all',
    });

    return true;
  } catch (error) {
    console.error('Error deleting Google Calendar event:', error);
    throw error;
  }
}

export async function getCalendarEvent(eventId: string) {
  try {
    const calendar = await getUncachableGoogleCalendarClient();

    const response = await calendar.events.get({
      calendarId: 'primary',
      eventId,
    });

    return response.data;
  } catch (error) {
    console.error('Error getting Google Calendar event:', error);
    throw error;
  }
}
