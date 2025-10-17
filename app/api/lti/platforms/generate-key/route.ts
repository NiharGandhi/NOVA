import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateLTIKeyPair } from '@/utils/lti';

/**
 * Generate RSA key pair for LTI platform
 * Admin-only endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const { platformId } = await request.json();

    if (!platformId) {
      return NextResponse.json(
        { error: 'Missing platformId' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify platform exists
    const { data: platform, error: platformError } = await supabase
      .from('lti_platforms')
      .select('id')
      .eq('id', platformId)
      .single();

    if (platformError || !platform) {
      return NextResponse.json(
        { error: 'Platform not found' },
        { status: 404 }
      );
    }

    // Generate key pair
    const { publicKey, privateKey, keyId } = await generateLTIKeyPair();

    // Store in database
    const { data: key, error: keyError } = await supabase
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
      console.error('Failed to store key:', keyError);
      return NextResponse.json(
        { error: 'Failed to store key' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      keyId,
      publicKey,
    });
  } catch (error) {
    console.error('Key generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
