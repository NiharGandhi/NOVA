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

// GET - List course materials for a chatbot
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.split('Bearer ')[1]

    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get('chatbot_id');

    if (!chatbotId) {
      return new Response(JSON.stringify({ error: "chatbot_id is required" }), {
        status: 400,
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

    // Check user role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userData?.role === 'admin';
    const isInstructor = userData?.role === 'instructor';

    // Use admin client to bypass RLS for admins and instructors
    // since RLS policies might not be working correctly
    if (!supabaseAdmin) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let materials;
    let error;

    if (isAdmin) {
      // Admins see all materials for this chatbot
      const result = await supabaseAdmin
        .from('course_materials')
        .select('*')
        .eq('chatbot_id', chatbotId)
        .order('order_index', { ascending: true });

      materials = result.data;
      error = result.error;
    } else if (isInstructor) {
      // Verify instructor is assigned to this course
      const { data: assignment } = await supabaseAdmin
        .from('course_instructors')
        .select('id')
        .eq('chatbot_id', chatbotId)
        .eq('instructor_id', user.id)
        .single();

      if (!assignment) {
        return new Response(JSON.stringify({ error: "Not assigned to this course" }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Fetch materials using admin client
      const result = await supabaseAdmin
        .from('course_materials')
        .select('*')
        .eq('chatbot_id', chatbotId)
        .order('order_index', { ascending: true });

      materials = result.data;
      error = result.error;
    } else {
      // Students use RLS policies
      const result = await supabase
        .from('course_materials')
        .select('*')
        .eq('chatbot_id', chatbotId)
        .order('order_index', { ascending: true });

      materials = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Error fetching course materials:', error);
      return new Response(JSON.stringify({ error: "Error fetching course materials" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Fetched ${materials?.length || 0} course materials for chatbot ${chatbotId}`);
    return NextResponse.json(materials || []);
  } catch (error) {
    console.error('Course materials API error:', error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// POST - Upload/create course material (admin only)
export async function POST(request: Request) {
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

    const body = await request.json();
    let { chatbot_id, title, content, file_name, file_type, order_index } = body;

    if (!chatbot_id || !title || !content) {
      return new Response(JSON.stringify({ error: "Missing required fields: chatbot_id, title, content" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Sanitize content to remove null bytes and invalid characters
    content = content.replace(/\0/g, '').replace(/\uFFFD/g, '').trim();

    if (!content) {
      return new Response(JSON.stringify({ error: "Content is empty after sanitization" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!supabaseAdmin) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data: material, error } = await supabaseAdmin
      .from('course_materials')
      .insert({
        chatbot_id,
        title,
        content,
        file_name,
        file_type,
        order_index: order_index ?? 0,
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating course material:', error);
      return new Response(JSON.stringify({ error: "Error creating course material" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return NextResponse.json(material);
  } catch (error) {
    console.error('Course materials API error:', error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
