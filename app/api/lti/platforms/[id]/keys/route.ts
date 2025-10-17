import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateLTIKeyPair } from '@/utils/lti';

/**
 * POST - Generate new RSA key pair for a platform (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const platformId = params.id;

    // Verify platform exists
    const { data: platform, error: platformError } = await supabase
      .from('lti_platforms')
      .select('id, name')
      .eq('id', platformId)
      .single();

    if (platformError || !platform) {
      return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
    }

    console.log('Generating key pair for platform:', platform.name);

    // Generate RSA key pair
    const { publicKey, privateKey, keyId } = await generateLTIKeyPair();

    console.log('Key pair generated, keyId:', keyId);

    // Deactivate old keys for this platform
    await supabase
      .from('lti_keys')
      .update({ is_active: false })
      .eq('platform_id', platformId);

    console.log('Deactivated old keys');

    // Store new key pair
    const { data: newKey, error: keyError } = await supabase
      .from('lti_keys')
      .insert({
        platform_id: platformId,
        key_id: keyId,
        public_key: publicKey,
        private_key: privateKey,
        algorithm: 'RS256',
        is_active: true,
      })
      .select()
      .single();

    if (keyError) {
      console.error('Error storing key pair:', keyError);
      return NextResponse.json(
        { error: 'Failed to store key pair', details: keyError.message },
        { status: 500 }
      );
    }

    console.log('Key pair stored successfully');

    return NextResponse.json({
      success: true,
      key_id: keyId,
      platform_name: platform.name,
    });
  } catch (error) {
    console.error('Key generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to generate key pair',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Get active key for a platform (returns public key only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const platformId = params.id;

    // Get active key for platform
    const { data: key, error } = await supabase
      .from('lti_keys')
      .select('key_id, algorithm, created_at, is_active')
      .eq('platform_id', platformId)
      .eq('is_active', true)
      .single();

    if (error || !key) {
      return NextResponse.json({ error: 'No active key found' }, { status: 404 });
    }

    return NextResponse.json(key);
  } catch (error) {
    console.error('Get key error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
