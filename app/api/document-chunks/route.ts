import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

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

// GET - Fetch document chunks for a material or chatbot
export async function GET(request: Request) {
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

    // Check user role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userData?.role === 'admin';
    const isInstructor = userData?.role === 'instructor';

    if (!isAdmin && !isInstructor) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get('chatbot_id');
    const materialId = searchParams.get('material_id');

    // Build query
    let query = supabaseAdmin
      .from('document_chunks')
      .select(`
        *,
        material:course_materials(
          id,
          title,
          file_name,
          file_type,
          storage_path,
          file_size,
          mime_type,
          chatbot_id,
          order_index,
          created_at
        )
      `)
      .order('chunk_index', { ascending: true });

    if (materialId) {
      query = query.eq('material_id', materialId);
    } else if (chatbotId) {
      // If instructor, verify assignment
      if (isInstructor) {
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
      }

      // Get all materials for this chatbot, then filter chunks
      const { data: materials } = await supabaseAdmin
        .from('course_materials')
        .select('id')
        .eq('chatbot_id', chatbotId);

      if (materials && materials.length > 0) {
        const materialIds = materials.map(m => m.id);
        query = query.in('material_id', materialIds);
      } else {
        // No materials for this chatbot
        return NextResponse.json([]);
      }
    } else {
      return new Response(JSON.stringify({ error: "chatbot_id or material_id is required" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data: chunks, error } = await query;

    if (error) {
      console.error('Error fetching document chunks:', error);
      return new Response(JSON.stringify({ error: "Error fetching document chunks" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return NextResponse.json(chunks || []);
  } catch (error: any) {
    console.error('Document chunks API error:', error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// DELETE - Delete a document chunk
export async function DELETE(request: Request) {
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

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userData?.role === 'admin';
    const isInstructor = userData?.role === 'instructor';

    if (!isAdmin && !isInstructor) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { searchParams } = new URL(request.url);
    const chunkId = searchParams.get('chunk_id');
    const materialId = searchParams.get('material_id');

    if (chunkId) {
      // Delete single chunk
      const { error } = await supabaseAdmin
        .from('document_chunks')
        .delete()
        .eq('id', chunkId);

      if (error) {
        console.error('Error deleting chunk:', error);
        return new Response(JSON.stringify({ error: "Error deleting chunk" }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else if (materialId) {
      // Delete all chunks for a material
      const { error } = await supabaseAdmin
        .from('document_chunks')
        .delete()
        .eq('material_id', materialId);

      if (error) {
        console.error('Error deleting chunks:', error);
        return new Response(JSON.stringify({ error: "Error deleting chunks" }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "chunk_id or material_id is required" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Document chunks DELETE error:', error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
