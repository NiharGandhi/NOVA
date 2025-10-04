import { Readability } from "@mozilla/readability";
import jsdom, { JSDOM } from "jsdom";
import { cleanedText, fetchWithTimeout } from "@/utils/utils";
import { NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const maxDuration = 30;

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
    if (!body?.sources || !Array.isArray(body.sources)) {
      return new Response(JSON.stringify({ error: "Invalid request format" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let { sources } = body;

    console.log("[getAnswer] Fetching text from source URLS");
    let finalResults = await Promise.all(
      sources.map(async (result: any) => {
        try {
          if (!result.url) {
            throw new Error("URL is required");
          }

          // Fetch the source URL, or abort if it's been 3 seconds
          const response = await fetchWithTimeout(result.url);
          if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.status}`);
          }

          const html = await response.text();
          const virtualConsole = new jsdom.VirtualConsole();
          const dom = new JSDOM(html, { virtualConsole });

          const doc = dom.window.document;
          const parsed = new Readability(doc).parse();
          let parsedContent = parsed
            ? cleanedText(parsed.textContent)
            : "Nothing found";

          return {
            ...result,
            fullContent: parsedContent,
          };
        } catch (e) {
          console.error(`Error parsing ${result.name}:`, e);
          return {
            ...result,
            fullContent: "Content not available",
            error: e instanceof Error ? e.message : "Unknown error",
          };
        }
      }),
    );

    // Filter out failed results and ensure we have valid content
    finalResults = finalResults.filter(result => 
      result.fullContent && result.fullContent !== "Content not available"
    );

    if (finalResults.length === 0) {
      return new Response(JSON.stringify({ error: "No valid content could be parsed from the sources" }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return NextResponse.json(finalResults);
  } catch (error) {
    console.error("ParsedSources API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}