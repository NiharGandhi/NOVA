import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateLTIKeyPair } from '@/utils/lti';

/**
 * GET - List all LTI platforms (admin only)
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

    // Fetch all platforms
    const { data: platforms, error } = await supabase
      .from('lti_platforms')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching platforms:', error);
      return NextResponse.json({ error: 'Failed to fetch platforms' }, { status: 500 });
    }

    return NextResponse.json(platforms || []);
  } catch (error) {
    console.error('Platforms GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Create a new LTI platform (admin only)
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const {
      name,
      platform_type,
      issuer,
      client_id,
      auth_endpoint,
      token_endpoint,
      jwks_endpoint,
      deployment_id,
      nrps_endpoint,
      auto_provision_users,
    } = body;

    // Validate required fields
    if (!name || !platform_type || !issuer || !client_id || !auth_endpoint || !token_endpoint || !jwks_endpoint) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create platform
    const { data: platform, error: platformError } = await supabase
      .from('lti_platforms')
      .insert({
        name,
        platform_type,
        issuer,
        client_id,
        auth_endpoint,
        token_endpoint,
        jwks_endpoint,
        deployment_id: deployment_id || null,
        nrps_endpoint: nrps_endpoint || null,
        auto_provision_users: auto_provision_users ?? true,
        is_active: true,
        created_by: userId,
      })
      .select()
      .single();

    if (platformError) {
      console.error('Error creating platform:', platformError);
      return NextResponse.json(
        { error: 'Failed to create platform: ' + platformError.message },
        { status: 500 }
      );
    }

    // Generate RSA key pair for this platform
    const { publicKey, privateKey, keyId } = await generateLTIKeyPair();

    // Store key pair
    const { error: keyError } = await supabase
      .from('lti_keys')
      .insert({
        platform_id: platform.id,
        key_id: keyId,
        public_key: publicKey,
        private_key: privateKey,
        algorithm: 'RS256',
        is_active: true,
      });

    if (keyError) {
      console.error('Error storing key pair:', keyError);
      // Don't fail the request, but log the error
      return NextResponse.json({
        ...platform,
        warning: 'Platform created but key generation failed',
      });
    }

    return NextResponse.json(platform);
  } catch (error) {
    console.error('Platforms POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH - Update a platform (admin only)
 */
export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Platform ID required' }, { status: 400 });
    }

    // Update platform
    const { data: platform, error } = await supabase
      .from('lti_platforms')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating platform:', error);
      return NextResponse.json({ error: 'Failed to update platform' }, { status: 500 });
    }

    return NextResponse.json(platform);
  } catch (error) {
    console.error('Platforms PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE - Delete a platform (admin only)
 */
export async function DELETE(request: NextRequest) {
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

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Platform ID required' }, { status: 400 });
    }

    // Delete platform (cascade will delete related records)
    const { error } = await supabase
      .from('lti_platforms')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting platform:', error);
      return NextResponse.json({ error: 'Failed to delete platform' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Platforms DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
