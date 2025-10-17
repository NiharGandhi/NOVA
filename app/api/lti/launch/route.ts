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
      // Generate email if not provided by LMS
      const userEmail = userInfo.email || `${userInfo.userId}@lti.${platform.platform_type}.edu`;

      console.log('Provisioning new user:', {
        ltiUserId: userInfo.userId,
        email: userEmail,
        fullName: userInfo.fullName,
      });

      // Try to create auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: userEmail,
        email_confirm: true,
        user_metadata: {
          full_name: userInfo.fullName,
          given_name: userInfo.givenName,
          family_name: userInfo.familyName,
          lti_user: true,
          platform_id: platform.id,
          lti_user_id: userInfo.userId,
        },
      });

      // If user already exists, look them up
      if (authError && authError.message.includes('already been registered')) {
        console.log('User already exists, looking up by email:', userEmail);

        const { data: existingUsers, error: lookupError } = await supabase.auth.admin.listUsers();

        if (lookupError) {
          console.error('Failed to lookup existing user:', lookupError);
          return NextResponse.json(
            {
              error: 'Failed to provision user - user exists but lookup failed',
              details: lookupError.message,
            },
            { status: 500 }
          );
        }

        // Find the user by email
        const foundUser = existingUsers.users.find(u => u.email === userEmail);

        if (!foundUser) {
          console.error('User exists but could not find by email');
          return NextResponse.json(
            {
              error: 'Failed to provision user - user exists but not found',
              email: userEmail,
            },
            { status: 500 }
          );
        }

        novaUser = foundUser;
        console.log('Found existing user:', novaUser.id, novaUser.email);
      } else if (authError) {
        console.error('Failed to create auth user:', authError);
        console.error('User info:', userInfo);
        return NextResponse.json(
          {
            error: 'Failed to provision user',
            details: authError.message,
            user_id: userInfo.userId,
            email: userEmail,
          },
          { status: 500 }
        );
      } else if (!authUser.user) {
        console.error('No user returned from createUser');
        return NextResponse.json(
          { error: 'Failed to provision user - no user returned' },
          { status: 500 }
        );
      } else {
        novaUser = authUser.user;
        console.log('Created auth user:', novaUser.id, novaUser.email);
      }

      // Check if user record exists (should be auto-created by trigger)
      const { data: existingUserRecord } = await supabase
        .from('users')
        .select('*')
        .eq('id', novaUser.id)
        .single();

      if (!existingUserRecord) {
        // Trigger didn't work, create manually
        console.log('User record not found, creating manually');
        await supabase
          .from('users')
          .insert({
            id: novaUser.id,
            email: novaUser.email!,
            role: novaRole,
          });
      } else {
        // Update role if needed
        if (existingUserRecord.role !== novaRole) {
          await supabase
            .from('users')
            .update({ role: novaRole })
            .eq('id', novaUser.id);
        }
      }

      // Create user mapping
      const { error: mappingError } = await supabase.from('lti_user_mappings').insert({
        platform_id: platform.id,
        lti_user_id: userInfo.userId,
        nova_user_id: novaUser.id,
        email: userInfo.email,
        given_name: userInfo.givenName,
        family_name: userInfo.familyName,
        full_name: userInfo.fullName,
        lms_roles: userInfo.roles,
        lms_user_data: payload,
      });

      if (mappingError) {
        console.error('Failed to create user mapping:', mappingError);
      }

      console.log('Provisioned new user:', novaUser.email);
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

    // Create a NOVA session for the user
    if (novaUser) {
      try {
        console.log('Creating session for user:', novaUser.email);

        // Use a simpler approach: set a temporary password and sign in
        const tempPassword = `lti_${Math.random().toString(36).slice(2)}_${Date.now()}`;

        // Update user with temporary password
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          novaUser.id,
          { password: tempPassword }
        );

        if (updateError) {
          console.error('Failed to set temporary password:', updateError);
          throw updateError;
        }

        console.log('Set temporary password for user');

        // Sign in with the temporary password to create a session
        const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
          email: novaUser.email!,
          password: tempPassword,
        });

        if (signInError || !sessionData?.session) {
          console.error('Sign in error:', signInError);
          throw signInError || new Error('No session created');
        }

        console.log('Session created successfully');

        // Create redirect URL with authentication tokens as query params
        const callbackUrl = new URL(`${process.env.NEXT_PUBLIC_APP_URL}/api/lti/callback`);
        callbackUrl.searchParams.set('access_token', sessionData.session.access_token);
        callbackUrl.searchParams.set('refresh_token', sessionData.session.refresh_token);
        callbackUrl.searchParams.set('expires_in', String(sessionData.session.expires_in));

        return NextResponse.redirect(callbackUrl.toString());
      } catch (authError) {
        console.error('Authentication error:', authError);
        console.error('User email:', novaUser.email);
        console.error('Stack:', authError instanceof Error ? authError.stack : 'N/A');

        return NextResponse.json(
          {
            error: 'Failed to create user session',
            details: authError instanceof Error ? authError.message : 'Unknown error',
            user_email: novaUser.email,
          },
          { status: 500 }
        );
      }
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
