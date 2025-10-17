import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  verifyLTIToken,
  validateDeploymentId,
  extractContextInfo,
  extractUserInfo,
  extractNRPSInfo,
  extractAGSInfo,
  mapLTIRoleToNovaRole,
  LTILaunchPayload,
} from '@/utils/lti';

/**
 * LTI Launch Endpoint
 * Handles the LTI 1.3 resource link launch
 * After OIDC authentication, the LMS redirects here with the id_token
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const id_token = formData.get('id_token') as string;
    const state = formData.get('state') as string;

    if (!id_token || !state) {
      return NextResponse.json(
        { error: 'Missing id_token or state' },
        { status: 400 }
      );
    }

    console.log('LTI Launch received');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Retrieve the session we created during login initiation
    const { data: session, error: sessionError } = await supabase
      .from('lti_launch_sessions')
      .select('*')
      .eq('launch_id', state)
      .single();

    if (sessionError || !session) {
      console.error('Session not found:', sessionError);
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 400 }
      );
    }

    // Get the platform configuration
    const { data: platform, error: platformError } = await supabase
      .from('lti_platforms')
      .select('*')
      .eq('id', session.platform_id)
      .single();

    if (platformError || !platform) {
      console.error('Platform not found:', platformError);
      return NextResponse.json(
        { error: 'LTI platform not found' },
        { status: 404 }
      );
    }

    // Verify and decode the JWT token
    let payload: LTILaunchPayload;
    try {
      payload = await verifyLTIToken(id_token, platform);
    } catch (error) {
      console.error('Token verification failed:', error);
      return NextResponse.json(
        { error: 'Invalid LTI token' },
        { status: 401 }
      );
    }

    // Validate nonce matches
    const sessionNonce = session.launch_data.nonce;
    if (payload.nonce !== sessionNonce) {
      return NextResponse.json(
        { error: 'Nonce mismatch' },
        { status: 400 }
      );
    }

    // Validate deployment ID
    if (!validateDeploymentId(payload, platform)) {
      return NextResponse.json(
        { error: 'Invalid deployment ID' },
        { status: 400 }
      );
    }

    console.log('LTI token verified successfully');

    // Extract information from payload
    const contextInfo = extractContextInfo(payload);
    const userInfo = extractUserInfo(payload);
    const nrpsInfo = extractNRPSInfo(payload);
    const agsInfo = extractAGSInfo(payload);

    // Process user - create or update user mapping
    const novaRole = mapLTIRoleToNovaRole(userInfo.roles);
    let novaUser;

    // Check if user mapping already exists
    const { data: existingMapping } = await supabase
      .from('lti_user_mappings')
      .select('*, users:nova_user_id(*)')
      .eq('platform_id', platform.id)
      .eq('lti_user_id', userInfo.userId)
      .single();

    if (existingMapping) {
      // Update existing mapping
      await supabase
        .from('lti_user_mappings')
        .update({
          email: userInfo.email,
          given_name: userInfo.givenName,
          family_name: userInfo.familyName,
          full_name: userInfo.fullName,
          lms_roles: userInfo.roles,
          lms_user_data: payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingMapping.id);

      novaUser = existingMapping.users;
    } else if (platform.auto_provision_users) {
      // Auto-provision new user
      // Create auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: userInfo.email || `${userInfo.userId}@lti.${platform.platform_type}.edu`,
        email_confirm: true,
        user_metadata: {
          full_name: userInfo.fullName,
          given_name: userInfo.givenName,
          family_name: userInfo.familyName,
          lti_user: true,
          platform_id: platform.id,
        },
      });

      if (authError) {
        console.error('Failed to create auth user:', authError);
        return NextResponse.json(
          { error: 'Failed to provision user' },
          { status: 500 }
        );
      }

      novaUser = authUser.user;

      // Update user role in users table
      await supabase
        .from('users')
        .update({ role: novaRole })
        .eq('id', novaUser!.id);

      // Create user mapping
      await supabase.from('lti_user_mappings').insert({
        platform_id: platform.id,
        lti_user_id: userInfo.userId,
        nova_user_id: novaUser!.id,
        email: userInfo.email,
        given_name: userInfo.givenName,
        family_name: userInfo.familyName,
        full_name: userInfo.fullName,
        lms_roles: userInfo.roles,
        lms_user_data: payload,
      });

      console.log('Provisioned new user:', novaUser!.email);
    } else {
      return NextResponse.json(
        { error: 'User not found and auto-provisioning is disabled' },
        { status: 403 }
      );
    }

    // Process context (course)
    if (contextInfo.contextId) {
      let context;

      const { data: existingContext } = await supabase
        .from('lti_contexts')
        .select('*')
        .eq('platform_id', platform.id)
        .eq('context_id', contextInfo.contextId)
        .single();

      if (existingContext) {
        // Update existing context
        await supabase
          .from('lti_contexts')
          .update({
            context_label: contextInfo.contextLabel,
            context_title: contextInfo.contextTitle,
            lms_course_data: payload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingContext.id);

        context = existingContext;
      } else {
        // Create new context
        const { data: newContext } = await supabase
          .from('lti_contexts')
          .insert({
            platform_id: platform.id,
            context_id: contextInfo.contextId,
            context_label: contextInfo.contextLabel,
            context_title: contextInfo.contextTitle,
            lms_course_data: payload,
          })
          .select()
          .single();

        context = newContext;

        console.log('Created new LTI context:', contextInfo.contextTitle);
      }

      // Create or update enrollment
      const { data: userMapping } = await supabase
        .from('lti_user_mappings')
        .select('id')
        .eq('platform_id', platform.id)
        .eq('lti_user_id', userInfo.userId)
        .single();

      if (userMapping && context) {
        const { data: existingEnrollment } = await supabase
          .from('lti_enrollments')
          .select('*')
          .eq('context_id', context.id)
          .eq('user_mapping_id', userMapping.id)
          .single();

        if (existingEnrollment) {
          // Update enrollment
          await supabase
            .from('lti_enrollments')
            .update({
              role: userInfo.roles[0] || 'Learner',
              last_activity_at: new Date().toISOString(),
            })
            .eq('id', existingEnrollment.id);
        } else {
          // Create enrollment
          await supabase.from('lti_enrollments').insert({
            context_id: context.id,
            user_mapping_id: userMapping.id,
            role: userInfo.roles[0] || 'Learner',
          });
        }
      }
    }

    // Update launch session with full data
    await supabase
      .from('lti_launch_sessions')
      .update({
        user_mapping_id: existingMapping?.id,
        launch_data: {
          ...session.launch_data,
          payload,
          context: contextInfo,
          user: userInfo,
          nrps: nrpsInfo,
          ags: agsInfo,
        },
      })
      .eq('id', session.id);

    // Create a NOVA session for the user using admin generateLink
    if (novaUser) {
      // Generate a magic link for the user (this creates a token we can use)
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: novaUser.email!,
      });

      if (linkError || !linkData) {
        console.error('Failed to generate auth link:', linkError);
        return NextResponse.json(
          { error: 'Failed to create user session' },
          { status: 500 }
        );
      }

      // Extract the hashed token from the generated URL
      const url = new URL(linkData.properties.action_link);
      const token = url.searchParams.get('token');
      const tokenHash = url.searchParams.get('token_hash');

      if (!token || !tokenHash) {
        console.error('Failed to extract token from magic link');
        return NextResponse.json(
          { error: 'Failed to create user session' },
          { status: 500 }
        );
      }

      // Verify the token to get a session
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        type: 'magiclink',
        token_hash: tokenHash,
        email: novaUser.email!,
      });

      if (verifyError || !verifyData.session) {
        console.error('Failed to verify token:', verifyError);
        return NextResponse.json(
          { error: 'Failed to create user session' },
          { status: 500 }
        );
      }

      // Redirect to NOVA app with session
      const response = NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/home?lti_launch=true`
      );

      // Set session cookies using Supabase's cookie handling
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
      };

      // Set access token
      response.cookies.set({
        name: 'sb-access-token',
        value: verifyData.session.access_token,
        ...cookieOptions,
        maxAge: verifyData.session.expires_in || 3600,
      });

      // Set refresh token
      response.cookies.set({
        name: 'sb-refresh-token',
        value: verifyData.session.refresh_token,
        ...cookieOptions,
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      return response;
    }

    return NextResponse.json({ error: 'Failed to process launch' }, { status: 500 });
  } catch (error) {
    console.error('LTI launch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
