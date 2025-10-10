import {
  TogetherAIStream,
  TogetherAIStreamPayload,
} from "@/utils/TogetherAIStream";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

let ratelimit: Ratelimit | undefined;

// Add rate limiting if Upstash API keys are set, otherwise skip
if (process.env.UPSTASH_REDIS_REST_URL) {
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    // Allow 10 requests per day
    limiter: Ratelimit.fixedWindow(10, "1440 m"),
    analytics: true,
    prefix: "llamatutor",
  });
}

export async function POST(request: Request) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.split('Bearer ')[1]

    if (!token) {
      console.error('No auth token provided');
      return new Response(JSON.stringify({ error: "Unauthorized - No auth token" }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create a Supabase client
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

    // Verify the token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Invalid auth token:', authError);
      return new Response(JSON.stringify({ error: "Unauthorized - Invalid auth token" }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get AI config including response templates
    const { data: aiConfig, error: configError } = await supabase
      .from('ai_config')
      .select('*')
      .eq('id', 1)
      .single();

    if (configError) {
      console.error('Error fetching AI config:', configError);
      return new Response(JSON.stringify({ error: "Error fetching AI configuration" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const body = await request.json();
    if (!body?.messages || !Array.isArray(body.messages)) {
      return new Response(JSON.stringify({ error: "Invalid request format" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let { messages, chatbot_id } = body;
    let sourceChunks: any[] = [];

    // If chatbot_id is provided, check if it uses course materials
    if (chatbot_id) {
      console.log(`Fetching chatbot configuration for: ${chatbot_id}`);

      // Use admin client to bypass RLS for reading chatbot config
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: chatbot, error: chatbotError } = await supabaseAdmin
        .from('chatbots')
        .select('use_course_materials, use_web_search, is_active')
        .eq('id', chatbot_id)
        .single();

      if (chatbotError) {
        console.error('Error fetching chatbot:', chatbotError);
      }

      console.log('Chatbot data:', JSON.stringify(chatbot, null, 2));

      if (chatbot?.use_course_materials) {
        console.log(`Chatbot ${chatbot_id} is configured to use course materials`);

        // Get the user's last message as the query
        const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();
        if (lastUserMessage?.content) {
          console.log(`User query: "${lastUserMessage.content}"`);

          // Search for relevant chunks using semantic search
          const { generateQueryEmbedding } = await import('@/utils/embeddings');

          try {
            // First check if there are any chunks for this chatbot
            const { data: chunkCount } = await supabaseAdmin
              .from('document_chunks')
              .select('id', { count: 'exact', head: true })
              .eq('material_id', chatbot_id);

            const { data: materials } = await supabaseAdmin
              .from('course_materials')
              .select('id, title, file_name')
              .eq('chatbot_id', chatbot_id);

            console.log(`Found ${materials?.length || 0} course materials for this chatbot:`, materials);

            if (materials && materials.length > 0) {
              const materialIds = materials.map(m => m.id);
              const { count } = await supabaseAdmin
                .from('document_chunks')
                .select('id', { count: 'exact', head: true })
                .in('material_id', materialIds);

              console.log(`Total document chunks available: ${count || 0}`);
            }

            console.log('Generating query embedding...');
            const queryEmbedding = await generateQueryEmbedding(lastUserMessage.content);
            console.log(`Query embedding generated (length: ${queryEmbedding.length}), calling match_document_chunks for chatbot ${chatbot_id}...`);
            console.log('First 5 values of embedding:', queryEmbedding.slice(0, 5));

            // Check what type the embedding is
            console.log('Embedding is array:', Array.isArray(queryEmbedding));
            console.log('Embedding type:', typeof queryEmbedding);

            // Test: First try to get any chunk to see embedding format
            const { data: sampleChunk } = await supabaseAdmin
              .from('document_chunks')
              .select('id, chunk_text, embedding')
              .limit(1)
              .single();

            console.log('Sample chunk embedding type:', typeof sampleChunk?.embedding);
            console.log('Sample chunk embedding is array:', Array.isArray(sampleChunk?.embedding));
            if (sampleChunk?.embedding) {
              console.log('Sample embedding first 5 values:',
                Array.isArray(sampleChunk.embedding)
                  ? sampleChunk.embedding.slice(0, 5)
                  : 'Not an array: ' + String(sampleChunk.embedding).substring(0, 100)
              );
            }

            // Try with lower threshold first to see if we get any results
            const { data: matches, error: searchError } = await supabaseAdmin.rpc(
              'match_document_chunks',
              {
                query_embedding: queryEmbedding,  // Don't stringify - pass the array directly
                match_threshold: 0.1,  // Very low threshold to see if we get any matches
                match_count: 5,
                chatbot_id_filter: chatbot_id
              }
            );

            if (searchError) {
              console.error('Search error:', searchError);
              console.error('Search error details:', JSON.stringify(searchError, null, 2));
            }

            console.log(`Search returned ${matches?.length || 0} matches`);

            if (matches && matches.length > 0) {
              sourceChunks = matches;
              console.log(`Found ${matches.length} relevant chunks for query`);
              console.log('First match:', JSON.stringify(matches[0], null, 2));

              // Inject the relevant context into the system message
              const systemMessage = messages[0];
              if (systemMessage?.role === 'system') {
                const contextText = matches
                  .map((chunk: any, idx: number) =>
                    `[Source ${idx + 1}] ${chunk.chunk_text}\n(From: ${chunk.title}, Page: ${chunk.page_number || 'N/A'}, Similarity: ${chunk.similarity.toFixed(2)})`
                  )
                  .join('\n\n');

                systemMessage.content = `${systemMessage.content}\n\n===RELEVANT COURSE MATERIALS===\nUse the following course materials to answer the student's question. Always cite your sources using [Source N] format when referencing specific information.\n\n${contextText}\n\nWhen answering:\n1. Think through the problem step by step (you can show your reasoning)\n2. Use the provided sources to support your answer\n3. Cite sources as [Source 1], [Source 2], etc.\n4. If the sources don't contain enough information, acknowledge this\n===END COURSE MATERIALS===`;
              }
            } else {
              console.log('No matching chunks found - check if documents have been uploaded and processed');
            }
          } catch (error) {
            console.error('Error performing semantic search:', error);
          }
        } else {
          console.log('No user message found for semantic search');
        }
      } else {
        console.log(`Chatbot ${chatbot_id} is NOT configured to use course materials`);
      }
    }

    // Get active response templates
    const activeTemplates = (aiConfig.response_templates || [])
      .filter((template: any) => template.isActive)
      .map((template: any) => template.template);

    // Add template instructions to system message
    if (activeTemplates.length > 0 && messages.length > 0) {
      const systemMessage = messages[0];
      if (systemMessage.role === 'system') {
        systemMessage.content = `${systemMessage.content}\n\nPlease format your response according to these templates:\n${activeTemplates.join('\n\n')}`;
      }
    }

    // Rate limiting check
    if (ratelimit) {
      const identifier = user.id;
      const { success } = await ratelimit.limit(identifier);
      if (!success) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in 24h." }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    try {
      const payload: TogetherAIStreamPayload = {
        model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
        messages,
        stream: true,
      };
      const stream = await TogetherAIStream(payload);

      // Create a new stream that includes source metadata
      const encoder = new TextEncoder();

      const transformedStream = new ReadableStream({
        async start(controller) {
          // Send sources metadata first if we have any
          if (sourceChunks.length > 0) {
            const sourcesData = sourceChunks.map((chunk: any, idx: number) => ({
              id: idx + 1,
              title: chunk.title,
              page: chunk.page_number,
              similarity: chunk.similarity,
              text: chunk.chunk_text.substring(0, 200) + '...'
            }));
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'sources', sources: sourcesData })}\n\n`)
            );
          }

          // Now stream the AI response
          const reader = stream.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          } finally {
            reader.releaseLock();
            controller.close();
          }
        },
      });

      return new Response(transformedStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    } catch (e) {
      console.error('Stream error:', e);
      return new Response(JSON.stringify({ error: "Error generating response" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export const runtime = "edge";