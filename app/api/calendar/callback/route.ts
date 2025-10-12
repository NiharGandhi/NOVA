import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // userId

    if (!code || !state) {
      console.error('Missing code or state:', { code: !!code, state: !!state });
      return NextResponse.redirect(new URL('/?error=missing_params', req.url));
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/calendar/callback`
    );

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      console.error('Missing tokens:', { hasAccess: !!tokens.access_token, hasRefresh: !!tokens.refresh_token });
      return NextResponse.redirect(new URL('/?error=token_error', req.url));
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

    // Store tokens in Supabase
    const { error } = await supabaseAdmin
      .from('users')
      .update({
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token,
        calendar_connected: true,
      })
      .eq('id', state);

    if (error) {
      console.error('Error storing tokens:', error);
      return NextResponse.redirect(new URL('/?error=db_error', req.url));
    }

    console.log('Successfully stored calendar tokens for user:', state);
    return NextResponse.redirect(new URL('/?calendar=connected', req.url));
  } catch (error) {
    console.error('Error in calendar callback:', error);
    return NextResponse.redirect(new URL('/?error=callback_error', req.url));
  }
}
