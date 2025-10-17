import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET - List all LTI contexts (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if user is admin
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all contexts with platform info
    const { data: contexts, error } = await supabase
      .from('lti_contexts')
      .select(`
        *,
        platform:lti_platforms(name, platform_type)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching contexts:', error);
      return NextResponse.json({ error: 'Failed to fetch contexts' }, { status: 500 });
    }

    return NextResponse.json(contexts || []);
  } catch (error) {
    console.error('Contexts GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
