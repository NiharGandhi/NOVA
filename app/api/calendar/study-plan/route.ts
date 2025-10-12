import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCalendarEvents, refreshAccessToken } from '@/utils/googleCalendar';

export async function POST(req: NextRequest) {
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

    // Fetch calendar events
    let accessToken = userData.google_access_token;
    let events;

    try {
      events = await getCalendarEvents(accessToken, userData.google_refresh_token);
    } catch (error: any) {
      // If access token expired, refresh it
      if (error.code === 401 || error.message?.includes('invalid_grant')) {
        accessToken = await refreshAccessToken(userData.google_refresh_token);
        await supabaseAdmin
          .from('users')
          .update({ google_access_token: accessToken })
          .eq('id', userId);
        events = await getCalendarEvents(accessToken, userData.google_refresh_token);
      } else {
        throw error;
      }
    }

    if (events.length === 0) {
      return NextResponse.json({
        plan: 'No upcoming assignments or deadlines found. Enjoy your free time!'
      });
    }

    // Create prompt for AI to generate study plan
    const eventsContext = events.map(event => {
      return `- ${event.summary} (Due: ${new Date(event.start).toLocaleString()})${event.description ? `\n  Description: ${event.description}` : ''}`;
    }).join('\n');

    const prompt = `You are a study planning assistant. Based on the following upcoming assignments and deadlines, create an optimal study plan for the student. Consider task complexity, due dates, and time management.

Current date: ${new Date().toLocaleString()}

Upcoming Assignments and Deadlines:
${eventsContext}

Please create a day-by-day study plan that:
1. Prioritizes urgent tasks
2. Breaks down large assignments into manageable chunks
3. Suggests specific times to work on each task
4. Includes buffer time for unexpected delays
5. Balances workload across available days

Format the response as a clear, actionable study plan with daily tasks and time estimates.`;

    // Call Together AI API
    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful study planning assistant. Create clear, actionable study plans.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate study plan');
    }

    const data = await response.json();
    const studyPlan = data.choices[0]?.message?.content || 'Unable to generate study plan.';

    return NextResponse.json({ plan: studyPlan, events });
  } catch (error) {
    console.error('Error generating study plan:', error);
    return NextResponse.json({ error: 'Failed to generate study plan' }, { status: 500 });
  }
}
