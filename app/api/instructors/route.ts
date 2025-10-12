import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET: Get all instructors or instructors for a specific course
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const userEmail = request.headers.get('x-user-email');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userError || userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get('chatbot_id');

    if (chatbotId) {
      // Get instructors for a specific course
      const { data, error } = await supabase
        .from('course_instructors')
        .select(`
          id,
          assigned_at,
          instructor:users!course_instructors_instructor_id_fkey(id, email, role),
          assigned_by_user:users!course_instructors_assigned_by_fkey(id, email)
        `)
        .eq('chatbot_id', chatbotId);

      if (error) {
        console.error('Error fetching course instructors:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data || []);
    } else {
      // Get all users with instructor role
      const { data, error } = await supabase
        .from('users')
        .select('id, email, role, created_at')
        .eq('role', 'instructor')
        .order('email', { ascending: true });

      if (error) {
        console.error('Error fetching instructors:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data || []);
    }
  } catch (error: any) {
    console.error('Error in GET /api/instructors:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Assign instructor to course or create new instructor
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userError || userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { chatbot_id, instructor_id, action } = body;

    if (action === 'assign') {
      // Assign instructor to course
      if (!chatbot_id || !instructor_id) {
        return NextResponse.json(
          { error: 'chatbot_id and instructor_id are required' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from('course_instructors')
        .insert({
          chatbot_id,
          instructor_id,
          assigned_by: userId,
        })
        .select()
        .single();

      if (error) {
        console.error('Error assigning instructor:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, assignment: data });
    } else if (action === 'create') {
      // This would require creating a new auth user and setting role to instructor
      // For now, return an error as this requires more setup
      return NextResponse.json(
        { error: 'Creating instructors not yet implemented. Please change user role manually in database.' },
        { status: 501 }
      );
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in POST /api/instructors:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove instructor from course
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userError || userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignment_id');

    if (!assignmentId) {
      return NextResponse.json(
        { error: 'assignment_id is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('course_instructors')
      .delete()
      .eq('id', assignmentId);

    if (error) {
      console.error('Error removing instructor:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/instructors:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
