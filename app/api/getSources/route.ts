import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

let excludedSites = ["youtube.com"];
let searchEngine: "bing" | "serper" = "serper";

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

    console.log('API request authenticated for user:', user.email);

    // Parse request body
    const body = await request.json();
    if (!body?.question) {
      return new Response(JSON.stringify({ error: "Question is required" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { question } = body;
    const finalQuestion = `what is ${question}`;

    // Use Serper API
    const SERPER_API_KEY = process.env.SERPER_API_KEY;
    console.log('SERPER_API_KEY status:', SERPER_API_KEY ? 'Present' : 'Missing');

    if (!SERPER_API_KEY) {
      console.error("SERPER_API_KEY is missing");
      return new Response(JSON.stringify({ error: "Search configuration error" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Making Serper API request for:', finalQuestion);
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: finalQuestion,
        num: 9,
      }),
    });

    console.log('Serper API response status:', response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Serper API error:', errorText);
      return new Response(JSON.stringify({ error: `Search API error: ${errorText}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const rawJSON = await response.json();
    console.log('Serper API response received');

    try {
      const SerperJSONSchema = z.object({
        organic: z.array(z.object({ title: z.string(), link: z.string() })),
      });

      const data = SerperJSONSchema.parse(rawJSON);
      const results = data.organic.map((result) => ({
        name: result.title,
        url: result.link,
      }));

      return NextResponse.json(results);
    } catch (error) {
      console.error("Invalid response format from Serper:", error);
      return new Response(JSON.stringify({ error: "Invalid search results format" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error("Search API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}