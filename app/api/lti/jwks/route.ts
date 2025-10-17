import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as jose from 'jose';

/**
 * JWKS Endpoint
 * Returns the public keys used to verify JWTs from NOVA
 * LMS platforms will fetch this to verify tokens from our tool
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Fetch all active LTI keys
    const { data: keys, error } = await supabase
      .from('lti_keys')
      .select('key_id, public_key, algorithm')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching LTI keys:', error);
      return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 });
    }

    // Convert PEM public keys to JWK format
    const jwks = await Promise.all(
      (keys || []).map(async (key) => {
        const publicKey = await jose.importSPKI(key.public_key, key.algorithm);
        const jwk = await jose.exportJWK(publicKey);

        return {
          ...jwk,
          kid: key.key_id,
          alg: key.algorithm,
          use: 'sig',
        };
      })
    );

    return NextResponse.json(
      {
        keys: jwks,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        },
      }
    );
  } catch (error) {
    console.error('JWKS endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
