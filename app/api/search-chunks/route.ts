import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { generateQueryEmbedding } from '@/utils/embeddings'

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

    const body = await request.json();
    const { query, chatbot_id, match_threshold = 0.78, match_count = 5 } = body;

    if (!query || !chatbot_id) {
      return new Response(JSON.stringify({ error: "Missing query or chatbot_id" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate embedding for the query
    console.log(`Searching for: ${query}`);
    const queryEmbedding = await generateQueryEmbedding(query);

    // Search for similar chunks using the match_document_chunks function
    const { data: matches, error: searchError } = await supabaseAdmin.rpc(
      'match_document_chunks',
      {
        query_embedding: JSON.stringify(queryEmbedding),
        match_threshold,
        match_count,
        chatbot_id_filter: chatbot_id
      }
    );

    if (searchError) {
      console.error('Error searching chunks:', searchError);
      return new Response(JSON.stringify({ error: "Error searching: " + searchError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${matches?.length || 0} matching chunks`);

    return NextResponse.json({
      success: true,
      matches: matches || [],
      count: matches?.length || 0
    });

  } catch (error: any) {
    console.error('Search error:', error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
