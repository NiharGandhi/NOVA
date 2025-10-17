import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateState, generateNonce, buildOIDCAuthUrl } from '@/utils/lti';

/**
 * LTI OIDC Login Initiation Endpoint
 * This is the first step in the LTI 1.3 launch flow
 * The LMS will redirect the user here to start authentication
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const iss = formData.get('iss') as string;
    const login_hint = formData.get('login_hint') as string;
    const target_link_uri = formData.get('target_link_uri') as string;
    const lti_message_hint = formData.get('lti_message_hint') as string;
    const client_id = formData.get('client_id') as string;
    const lti_deployment_id = formData.get('lti_deployment_id') as string;

    if (!iss || !login_hint) {
      return NextResponse.json(
        { error: 'Missing required parameters: iss or login_hint' },
        { status: 400 }
      );
    }

    console.log('LTI Login Initiation:', { iss, client_id, lti_deployment_id });

    // Use service role key to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find the LTI platform by issuer
    const { data: platform, error } = await supabase
      .from('lti_platforms')
      .select('*')
      .eq('issuer', iss)
      .eq('is_active', true)
      .single();

    if (error || !platform) {
      console.error('Platform not found for issuer:', iss);
      console.error('Error:', error);

      // Also log all platforms to help debug
      const { data: allPlatforms } = await supabase
        .from('lti_platforms')
        .select('issuer, name, is_active');
      console.log('Available platforms:', allPlatforms);

      return NextResponse.json(
        {
          error: 'LTI platform not registered or inactive',
          details: `Received issuer: ${iss}. Please make sure this matches exactly with the Issuer URL configured in NOVA.`
        },
        { status: 404 }
      );
    }

    // Validate client_id if provided
    if (client_id && platform.client_id !== client_id) {
      return NextResponse.json(
        { error: 'Client ID mismatch' },
        { status: 400 }
      );
    }

    // Generate state and nonce for OIDC flow
    const state = generateState();
    const nonce = generateNonce();

    // Store state and nonce in a temporary session
    // In production, use Redis or encrypted cookies
    const sessionData = {
      state,
      nonce,
      platform_id: platform.id,
      iss,
      login_hint,
      target_link_uri,
      lti_message_hint,
      lti_deployment_id,
      created_at: new Date().toISOString(),
    };

    // For now, we'll use Supabase to store the session temporarily
    // You might want to use Redis or encrypted cookies in production
    const { error: sessionError } = await supabase
      .from('lti_launch_sessions')
      .insert({
        launch_id: state,
        platform_id: platform.id,
        message_type: 'login_initiation',
        launch_data: sessionData,
      });

    if (sessionError) {
      console.error('Failed to store session:', sessionError);
      return NextResponse.json(
        { error: 'Failed to initialize session' },
        { status: 500 }
      );
    }

    // Build the redirect URI (where LMS will send the user after auth)
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/lti/launch`;

    // Build OIDC authorization URL
    const authUrl = buildOIDCAuthUrl(
      platform,
      state,
      nonce,
      redirectUri,
      login_hint
    );

    console.log('Redirecting to LMS auth:', authUrl);

    // Redirect user to LMS for authentication
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('LTI login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Some LMS platforms use GET instead of POST
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Convert query params to FormData for reuse
  const formData = new FormData();
  searchParams.forEach((value, key) => {
    formData.append(key, value);
  });

  // Create a new request with FormData
  const newRequest = new NextRequest(request.url, {
    method: 'POST',
    body: formData,
  });

  return POST(newRequest);
}
