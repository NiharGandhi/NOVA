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

if (!supabaseAdmin) {
  console.error('Error: Supabase admin client could not be initialized. Check environment variables.');
}

// GET - List all active chatbots (for all users) or all chatbots (for admins)
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
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.log(`User lookup error for ${user.email}:`, userError);
    }

    const isAdmin = userData?.role === 'admin';
    const isInstructor = userData?.role === 'instructor';
    console.log(`User ${user.email} (${user.id}) role: ${userData?.role || 'NOT FOUND'}, isAdmin: ${isAdmin}, isInstructor: ${isInstructor}`);

    let chatbots, error;

    // Use admin client to bypass RLS for all users
    // We manually filter by is_active for students
    if (!supabaseAdmin) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (isAdmin) {
      // Admins see all chatbots
      const result = await supabaseAdmin
        .from('chatbots')
        .select('*')
        .order('created_at', { ascending: false });
      chatbots = result.data;
      error = result.error;
      console.log(`Admin fetched ${chatbots?.length || 0} chatbots (all)`);
    } else if (isInstructor) {
      // Instructors see their assigned chatbots
      const result = await supabaseAdmin
        .from('chatbots')
        .select(`
          *,
          course_instructors!inner(instructor_id)
        `)
        .eq('course_instructors.instructor_id', user.id)
        .order('created_at', { ascending: false });
      chatbots = result.data;
      error = result.error;
      console.log(`Instructor fetched ${chatbots?.length || 0} assigned chatbots`);
    } else {
      // Students only see active chatbots (use admin client to bypass RLS issues)
      const result = await supabaseAdmin
        .from('chatbots')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      chatbots = result.data;
      error = result.error;
      console.log(`Student fetched ${chatbots?.length || 0} active chatbots via admin client`);
    }

    if (error) {
      console.error('Error fetching chatbots:', error);
      return new Response(JSON.stringify({ error: "Error fetching chatbots" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return NextResponse.json(chatbots);
  } catch (error) {
    console.error('Chatbots API error:', error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// POST - Create new chatbot (admin only)
export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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
    const { name, subject, description, system_prompt, use_web_search, use_course_materials, age_group, is_active } = body;

    if (!name || !subject || !system_prompt) {
      return new Response(JSON.stringify({ error: "Missing required fields: name, subject, system_prompt" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use supabaseAdmin for the insert operation to bypass RLS
    const { data: chatbot, error } = await supabaseAdmin
      .from('chatbots')
      .insert({
        name,
        subject,
        description,
        system_prompt,
        use_web_search: use_web_search ?? true,
        use_course_materials: use_course_materials ?? false,
        age_group: age_group ?? 'Middle School',
        is_active: is_active ?? true,
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating chatbot:', error);
      return new Response(JSON.stringify({ error: "Error creating chatbot: " + error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return NextResponse.json(chatbot);
  } catch (error) {
    console.error('Chatbots API error:', error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}