import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getLTIAccessToken, fetchCourseMembers, mapLTIRoleToNovaRole } from '@/utils/lti';

/**
 * Names and Role Provisioning Service (NRPS) Sync Endpoint
 * Syncs course enrollments and user roster from LMS
 */
export async function POST(request: NextRequest) {
  try {
    const { contextId, platformId } = await request.json();

    if (!contextId || !platformId) {
      return NextResponse.json(
        { error: 'Missing contextId or platformId' },
        { status: 400 }
      );
    }

    console.log('Starting NRPS sync for context:', contextId);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get platform configuration
    const { data: platform, error: platformError } = await supabase
      .from('lti_platforms')
      .select('*')
      .eq('id', platformId)
      .single();

    if (platformError || !platform) {
      return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
    }

    // Get context
    const { data: context, error: contextError } = await supabase
      .from('lti_contexts')
      .select('*')
      .eq('id', contextId)
      .single();

    if (contextError || !context) {
      return NextResponse.json({ error: 'Context not found' }, { status: 404 });
    }

    // Check if NRPS endpoint is available
    if (!platform.nrps_endpoint && !context.lms_course_data?.['https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice']) {
      return NextResponse.json(
        { error: 'NRPS not available for this platform/context' },
        { status: 400 }
      );
    }

    // Get NRPS URL from context data or platform config
    const nrpsUrl =
      context.lms_course_data?.['https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice']
        ?.context_memberships_url || platform.nrps_endpoint;

    if (!nrpsUrl) {
      return NextResponse.json(
        { error: 'NRPS URL not available' },
        { status: 400 }
      );
    }

    // Create sync log
    const { data: syncLog } = await supabase
      .from('lti_sync_logs')
      .insert({
        platform_id: platformId,
        sync_type: 'nrps_enrollments',
        status: 'started',
      })
      .select()
      .single();

    try {
      // Get LTI key for the platform
      const { data: key } = await supabase
        .from('lti_keys')
        .select('private_key')
        .eq('platform_id', platformId)
        .eq('is_active', true)
        .single();

      if (!key) {
        throw new Error('No active LTI key found for platform');
      }

      // Get access token for NRPS
      const accessToken = await getLTIAccessToken(
        platform,
        key.private_key,
        ['https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly']
      );

      // Fetch course members
      const members = await fetchCourseMembers(nrpsUrl, accessToken);

      console.log(`Fetched ${members.length} members from LMS`);

      let created = 0;
      let updated = 0;
      let failed = 0;

      // Process each member
      for (const member of members) {
        try {
          const ltiUserId = member.user_id;
          const roles = member.roles || [];
          const email = member.email || `${ltiUserId}@lti.${platform.platform_type}.edu`;

          // Check if user mapping exists
          const { data: existingMapping } = await supabase
            .from('lti_user_mappings')
            .select('*')
            .eq('platform_id', platformId)
            .eq('lti_user_id', ltiUserId)
            .single();

          let userMappingId;

          if (existingMapping) {
            // Update existing mapping
            await supabase
              .from('lti_user_mappings')
              .update({
                email: member.email,
                given_name: member.given_name,
                family_name: member.family_name,
                full_name: member.name,
                lms_roles: roles,
                lms_user_data: member,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingMapping.id);

            userMappingId = existingMapping.id;
            updated++;
          } else if (platform.auto_provision_users) {
            // Create new user
            const novaRole = mapLTIRoleToNovaRole(roles);

            const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
              email,
              email_confirm: true,
              user_metadata: {
                full_name: member.name,
                given_name: member.given_name,
                family_name: member.family_name,
                lti_user: true,
                platform_id: platformId,
              },
            });

            if (authError) {
              console.error('Failed to create user:', authError);
              failed++;
              continue;
            }

            // Update user role
            await supabase
              .from('users')
              .update({ role: novaRole })
              .eq('id', authUser.user!.id);

            // Create user mapping
            const { data: newMapping } = await supabase
              .from('lti_user_mappings')
              .insert({
                platform_id: platformId,
                lti_user_id: ltiUserId,
                nova_user_id: authUser.user!.id,
                email: member.email,
                given_name: member.given_name,
                family_name: member.family_name,
                full_name: member.name,
                lms_roles: roles,
                lms_user_data: member,
              })
              .select()
              .single();

            userMappingId = newMapping!.id;
            created++;
          } else {
            failed++;
            continue;
          }

          // Create or update enrollment
          const { data: existingEnrollment } = await supabase
            .from('lti_enrollments')
            .select('*')
            .eq('context_id', contextId)
            .eq('user_mapping_id', userMappingId)
            .single();

          const enrollmentRole = roles[0] || 'Learner';
          const status = member.status === 'Active' ? 'active' : 'inactive';

          if (existingEnrollment) {
            await supabase
              .from('lti_enrollments')
              .update({
                role: enrollmentRole,
                status,
                last_activity_at: new Date().toISOString(),
              })
              .eq('id', existingEnrollment.id);
          } else {
            await supabase.from('lti_enrollments').insert({
              context_id: contextId,
              user_mapping_id: userMappingId,
              role: enrollmentRole,
              status,
            });
          }
        } catch (memberError) {
          console.error('Error processing member:', memberError);
          failed++;
        }
      }

      // Update sync log
      const endTime = new Date();
      const startTime = new Date(syncLog!.started_at);
      const duration = endTime.getTime() - startTime.getTime();

      await supabase
        .from('lti_sync_logs')
        .update({
          status: 'completed',
          items_processed: members.length,
          items_created: created,
          items_updated: updated,
          items_failed: failed,
          completed_at: endTime.toISOString(),
          duration_ms: duration,
        })
        .eq('id', syncLog!.id);

      // Update context sync status
      await supabase
        .from('lti_contexts')
        .update({
          last_synced_at: new Date().toISOString(),
          sync_status: 'completed',
        })
        .eq('id', contextId);

      console.log('NRPS sync completed:', { created, updated, failed });

      return NextResponse.json({
        success: true,
        stats: {
          total: members.length,
          created,
          updated,
          failed,
        },
      });
    } catch (syncError) {
      console.error('NRPS sync error:', syncError);

      // Update sync log with error
      await supabase
        .from('lti_sync_logs')
        .update({
          status: 'failed',
          error_message: syncError instanceof Error ? syncError.message : 'Unknown error',
          error_details: { error: String(syncError) },
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog!.id);

      // Update context sync status
      await supabase
        .from('lti_contexts')
        .update({
          sync_status: 'error',
          sync_error: syncError instanceof Error ? syncError.message : 'Unknown error',
        })
        .eq('id', contextId);

      throw syncError;
    }
  } catch (error) {
    console.error('NRPS sync endpoint error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
