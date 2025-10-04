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

          // Add user-agent and other headers to mimic a browser
          const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          };

          // Fetch the source URL, or abort if it's been 3 seconds
          const response = await fetchWithTimeout(result.url, { headers });
          
          if (!response.ok) {
            console.error(`Failed to fetch ${result.url}: ${response.status}`);
            return {
              ...result,
              fullContent: `Could not access content. Here's a summary from the title: ${result.name}`,
            };
          }

          const html = await response.text();
          const virtualConsole = new jsdom.VirtualConsole();
          virtualConsole.on('error', () => { /* Suppress console errors */ });
          
          const dom = new JSDOM(html, { 
            virtualConsole,
            url: result.url // Add URL for proper relative URL resolution
          });

          const doc = dom.window.document;
          const parsed = new Readability(doc).parse();
          
          let parsedContent = parsed?.textContent || result.name;
          // Clean and truncate the content
          parsedContent = cleanedText(parsedContent);
          
          // If content is too short, include the title
          if (parsedContent.length < 100) {
            parsedContent = `${result.name}\n\n${parsedContent}`;
          }

          return {
            ...result,
            fullContent: parsedContent,
          };
        } catch (e) {
          console.error(`Error parsing ${result.name}:`, e);
          return {
            ...result,
            fullContent: `Could not parse content. Here's a summary from the title: ${result.name}`,
          };
        }
      }),
    );

    // Filter out failed results but ensure we have at least some content
    finalResults = finalResults.filter(result => 
      result.fullContent && result.fullContent.length > 10
    );

    if (finalResults.length === 0) {
      // If all results failed, create a generic response
      finalResults = [{
        name: "Generated Content",
        url: "",
        fullContent: "I'll help you understand this topic based on general knowledge."
      }];
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