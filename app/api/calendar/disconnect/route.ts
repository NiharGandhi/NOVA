import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    // Remove calendar tokens from database
    const { error } = await supabaseAdmin
      .from('users')
      .update({
        google_access_token: null,
        google_refresh_token: null,
        calendar_connected: false,
      })
      .eq('id', userId);

    if (error) {
      console.error('Error disconnecting calendar:', error);
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in calendar disconnect:', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
