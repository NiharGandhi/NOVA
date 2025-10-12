import { google } from 'googleapis';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  isDeadline?: boolean;
  isHomework?: boolean;
  isAssignment?: boolean;
}

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

export function getOAuthUrl(userId: string): string {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/calendar/callback`
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: userId,
    prompt: 'consent',
  });

  return url;
}

export async function getCalendarEvents(
  accessToken: string,
  refreshToken: string
): Promise<CalendarEvent[]> {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/calendar/callback`
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const now = new Date();
    const twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(now.getDate() + 14);

    console.log('Fetching events from', now.toISOString(), 'to', twoWeeksFromNow.toISOString());

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: twoWeeksFromNow.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
    });

    const events = response.data.items || [];
    console.log(`Found ${events.length} total events from calendar`);

    // Filter and categorize events
    const calendarEvents: CalendarEvent[] = events
      .filter((event) => event.summary)
      .map((event) => {
        const summary = event.summary?.toLowerCase() || '';
        const description = event.description?.toLowerCase() || '';
        const combined = `${summary} ${description}`;

        const isDeadline = combined.includes('deadline') || combined.includes('due');
        const isHomework = combined.includes('homework') || combined.includes('hw');
        const isAssignment =
          combined.includes('assignment') ||
          combined.includes('assignement') || // Common typo
          combined.includes('project') ||
          combined.includes('essay') ||
          combined.includes('paper') ||
          combined.includes('quiz') ||
          combined.includes('exam') ||
          combined.includes('midterm') ||
          combined.includes('test');

        return {
          id: event.id || '',
          summary: event.summary || '',
          description: event.description || undefined,
          start: event.start?.dateTime || event.start?.date || '',
          end: event.end?.dateTime || event.end?.date || '',
          isDeadline,
          isHomework,
          isAssignment,
        };
      })
      .filter((event) => event.isDeadline || event.isHomework || event.isAssignment);

    console.log(`Filtered to ${calendarEvents.length} relevant events (deadlines/homework/assignments)`);
    console.log('Event dates:', calendarEvents.map(e => ({ title: e.summary, date: e.start })));

    return calendarEvents;
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw error;
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/calendar/callback`
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials.access_token || '';
}
