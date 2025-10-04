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

    console.log('Chat API request authenticated for user:', user.email);

    // Parse request body
    const body = await request.json();
    if (!body?.messages || !Array.isArray(body.messages)) {
      return new Response(JSON.stringify({ error: "Invalid request format" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let { messages } = body;

    // Rate limiting check
    if (ratelimit) {
      const identifier = user.id; // Use user ID for rate limiting
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

      return new Response(stream, {
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