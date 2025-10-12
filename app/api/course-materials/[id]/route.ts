import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create a Supabase client with the service role key for admin operations
const supabaseAdmin = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ?
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  ) : null;

// PATCH - Update course material (admin or assigned instructor)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.split('Bearer ')[1]

    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.delete({ name, ...options });
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is admin or instructor
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userData?.role === 'admin';
    const isInstructor = userData?.role === 'instructor';

    if (!isAdmin && !isInstructor) {
      return new Response(JSON.stringify({ error: "Forbidden - Admin or Instructor access required" }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // RLS policies will automatically check instructor assignment

    const body = await request.json();
    const updates: any = {};

    if (body.title !== undefined) updates.title = body.title;
    if (body.content !== undefined) updates.content = body.content;
    if (body.file_name !== undefined) updates.file_name = body.file_name;
    if (body.file_type !== undefined) updates.file_type = body.file_type;
    if (body.order_index !== undefined) updates.order_index = body.order_index;

    if (!supabaseAdmin) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data: material, error } = await supabaseAdmin
      .from('course_materials')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating course material:', error);
      return new Response(JSON.stringify({ error: "Error updating course material" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return NextResponse.json(material);
  } catch (error) {
    console.error('Course material API error:', error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// DELETE - Delete course material (admin only)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.split('Bearer ')[1]

    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.delete({ name, ...options });
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'admin') {
      return new Response(JSON.stringify({ error: "Forbidden - Admin access required" }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!supabaseAdmin) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { error } = await supabaseAdmin
      .from('course_materials')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('Error deleting course material:', error);
      return new Response(JSON.stringify({ error: "Error deleting course material" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Course material API error:', error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
