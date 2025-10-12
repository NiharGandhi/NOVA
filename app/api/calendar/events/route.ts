import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCalendarEvents, refreshAccessToken } from '@/utils/googleCalendar';

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role client to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get user's calendar tokens from database
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('google_access_token, google_refresh_token, calendar_connected')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!userData.calendar_connected || !userData.google_refresh_token) {
      return NextResponse.json({ error: 'Calendar not connected' }, { status: 400 });
    }

    let accessToken = userData.google_access_token;

    // Try to fetch events, refresh token if needed
    try {
      const events = await getCalendarEvents(accessToken, userData.google_refresh_token);
      return NextResponse.json({ events });
    } catch (error: any) {
      // If access token expired, refresh it
      if (error.code === 401 || error.message?.includes('invalid_grant')) {
        accessToken = await refreshAccessToken(userData.google_refresh_token);

        // Update access token in database
        await supabaseAdmin
          .from('users')
          .update({ google_access_token: accessToken })
          .eq('id', userId);

        // Retry fetching events
        const events = await getCalendarEvents(accessToken, userData.google_refresh_token);
        return NextResponse.json({ events });
      }

      throw error;
    }
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
