import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { processDocument } from '@/utils/documentProcessor'
import { generateEmbeddings } from '@/utils/embeddings'

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

    const chatbot_id_parsed = await request.clone().formData().then(fd => fd.get('chatbot_id') as string);

    // If instructor, verify they're assigned to this course
    if (isInstructor && !isAdmin) {
      const { data: assignment, error: assignmentError } = await supabaseAdmin
        .from('course_instructors')
        .select('id')
        .eq('chatbot_id', chatbot_id_parsed)
        .eq('instructor_id', user.id)
        .single();

      if (assignmentError || !assignment) {
        return new Response(JSON.stringify({ error: "Forbidden - Not assigned to this course" }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const chatbot_id = formData.get('chatbot_id') as string;
    const title = formData.get('title') as string;
    const order_index = formData.get('order_index') as string;

    if (!file || !chatbot_id) {
      return new Response(JSON.stringify({ error: "Missing file or chatbot_id" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "File size must be less than 10MB" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Processing document: ${file.name}`);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${chatbot_id}/${timestamp}_${sanitizedFileName}`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('course-materials')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading to storage:', uploadError);
      return new Response(JSON.stringify({ error: "Error uploading file: " + uploadError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Process the document to extract text and create chunks
    const processed = await processDocument(buffer, file.name);
    console.log(`Processed ${processed.chunks.length} chunks from ${file.name}`);

    // Create course material record
    const { data: material, error: materialError } = await supabaseAdmin
      .from('course_materials')
      .insert({
        chatbot_id,
        title: title || file.name.replace(/\.[^/.]+$/, ''),
        content: `[File: ${file.name}] Content stored in ${processed.chunks.length} document chunks with embeddings.`, // Placeholder since actual content is in chunks
        file_name: file.name,
        file_type: processed.metadata.fileType,
        storage_path: storagePath,
        file_size: file.size,
        mime_type: file.type,
        order_index: order_index ? parseInt(order_index) : 0,
        created_by: user.id
      })
      .select()
      .single();

    if (materialError) {
      // Clean up uploaded file if material creation fails
      await supabaseAdmin.storage.from('course-materials').remove([storagePath]);
      console.error('Error creating material record:', materialError);
      return new Response(JSON.stringify({ error: "Error storing material: " + materialError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate embeddings for all chunks
    console.log('Generating embeddings...');
    const chunkTexts = processed.chunks.map(chunk => chunk.text);
    const embeddings = await generateEmbeddings(chunkTexts);

    // Store chunks with embeddings in database
    const chunksToInsert = processed.chunks.map((chunk, idx) => ({
      material_id: material.id,
      chunk_index: chunk.index,
      chunk_text: chunk.text,
      page_number: chunk.pageNumber || null,
      embedding: embeddings[idx].embedding,  // Pass array directly, not stringified
      metadata: chunk.metadata || {}
    }));

    const { error: chunksError } = await supabaseAdmin
      .from('document_chunks')
      .insert(chunksToInsert);

    if (chunksError) {
      console.error('Error storing chunks:', chunksError);
      // Don't fail the entire upload if chunks fail, but log it
      // You might want to implement a retry mechanism here
    }

    console.log(`Successfully uploaded ${file.name} with ${processed.chunks.length} chunks`);

    return NextResponse.json({
      success: true,
      material: {
        id: material.id,
        title: material.title,
        file_name: material.file_name,
        storage_path: storagePath
      },
      chunks: processed.chunks.length,
      pages: processed.metadata.totalPages
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
