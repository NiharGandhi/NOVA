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

// GET - Download or view file from storage
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
    const storagePath = searchParams.get('path');
    const materialId = searchParams.get('material_id');

    let pathToFetch = storagePath;

    // If material_id provided, fetch from database
    if (materialId && !storagePath) {
      const { data: material, error: materialError } = await supabaseAdmin
        .from('course_materials')
        .select('storage_path, chatbot_id, mime_type, file_name')
        .eq('id', materialId)
        .single();

      if (materialError || !material) {
        return new Response(JSON.stringify({ error: "Material not found" }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // If instructor, verify assignment
      if (isInstructor) {
        const { data: assignment } = await supabaseAdmin
          .from('course_instructors')
          .select('id')
          .eq('chatbot_id', material.chatbot_id)
          .eq('instructor_id', user.id)
          .single();

        if (!assignment) {
          return new Response(JSON.stringify({ error: "Not assigned to this course" }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      pathToFetch = material.storage_path;
    }

    if (!pathToFetch) {
      return new Response(JSON.stringify({ error: "Storage path is required" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabaseAdmin
      .storage
      .from('course-materials')
      .download(pathToFetch);

    if (downloadError || !fileData) {
      console.error('Storage download error:', downloadError);
      return new Response(JSON.stringify({ error: "File not found in storage" }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get file info for proper content type
    const { data: fileInfo } = await supabaseAdmin
      .storage
      .from('course-materials')
      .list(pathToFetch.split('/').slice(0, -1).join('/'), {
        search: pathToFetch.split('/').pop()
      });

    const contentType = fileInfo?.[0]?.metadata?.mimetype || 'application/octet-stream';
    const fileName = pathToFetch.split('/').pop() || 'download';

    // Return file with appropriate headers
    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'private, max-age=3600'
    });

    return new Response(fileData, { headers });
  } catch (error: any) {
    console.error('Storage download API error:', error);
    return new Response(JSON.stringify({ error: "Internal server error: " + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
