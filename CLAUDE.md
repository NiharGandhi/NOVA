# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NOVA (formerly Llama Tutor) is an AI-powered personal tutoring application that uses Llama 3.1 70B via Together AI to provide interactive, personalized learning experiences. The app searches the web for educational content, parses and processes it, then streams AI responses tailored to the user's age group.

**Tech Stack:**
- Next.js 14 (App Router) with TypeScript
- Supabase for authentication and database
- Together AI for LLM inference (Llama 3.1 8B Instruct Turbo)
- Helicone for LLM observability
- Serper API or Bing Search API for web search
- Upstash Redis for rate limiting (optional)
- Tailwind CSS for styling
- Plausible for analytics

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (starts on http://localhost:3000)
npm run dev

# Build for production
npm build

# Start production server
npm start

# Run linter
npm run lint
```

## Environment Variables

Create a `.env.local` file based on `.example.env`:

```
TOGETHER_API_KEY=          # Required: Together AI API key
SERPER_API_KEY=            # Required: Serper API for web search (or use BING_API_KEY)
BING_API_KEY=              # Alternative to SERPER_API_KEY
HELICONE_API_KEY=          # Required: For LLM observability
NEXT_PUBLIC_SUPABASE_URL=  # Required: Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Required: Supabase anon key
UPSTASH_REDIS_REST_URL=    # Optional: For rate limiting
UPSTASH_REDIS_REST_TOKEN=  # Optional: For rate limiting
```

## Architecture

### Authentication & Authorization

- **Supabase Auth**: Handles user authentication with JWT tokens
- **Middleware** (`middleware.ts`): Validates auth tokens on all API routes
  - Extracts Bearer token from Authorization header
  - Validates token with Supabase
  - Injects user info into request headers (`x-user-id`, `x-user-email`)
- **Role-based Access**: Users have roles (student/admin) stored in `users` table
- **Admin Panel**: `/admin` route for managing AI configuration and response templates

### Core Data Flow

1. **Initial Query** (`app/page.tsx`):
   - User enters topic and age group
   - Frontend calls `/api/getSources` to search the web
   - Calls `/api/getParsedSources` to extract and clean content from URLs
   - Constructs system prompt with teaching context
   - Streams response from `/api/getChat`

2. **Web Search** (`app/api/getSources/route.ts`):
   - Authenticates request via Bearer token
   - Uses Serper API (or Bing) to search for educational content
   - Returns array of `{name, url}` objects
   - Excludes YouTube by default

3. **Content Parsing** (`app/api/getParsedSources/route.ts`):
   - Fetches URLs with timeout (3 seconds per URL)
   - Uses Mozilla Readability to extract main content
   - Cleans and truncates text (`utils/utils.ts:cleanedText`)
   - Returns array of parsed content strings

4. **AI Chat** (`app/api/getChat/route.ts`):
   - Validates auth token
   - Fetches AI config from Supabase (including active response templates)
   - Applies rate limiting (10 requests per 24 hours if Upstash configured)
   - Injects template instructions into system prompt
   - Streams response using Together AI via Helicone proxy

### AI Configuration System

- **Admin Dashboard** (`components/AdminDashboard.tsx`):
  - Manage response templates (Step-by-Step, Socratic Method, Analogies)
  - Configure AI restrictions (max tokens, temperature, blocked topics)
  - Toggle templates on/off
  - Only accessible to admin users

- **Response Templates** (`utils/aiConfig.ts`):
  - Defines default AI behavior and restrictions
  - Templates modify how the tutor explains concepts
  - Active templates are injected into system prompts
  - Default: Step-by-Step template active

### Streaming Implementation

- **Custom Stream Handler** (`utils/TogetherAIStream.ts`):
  - Routes requests through Helicone proxy for observability
  - Uses Server-Sent Events (SSE) for streaming
  - Transforms Together AI response format to custom format
  - Strips prefix newlines from responses

### Database Schema (Supabase)

Key tables:
- **users**: User profiles with role (student/admin)
- **ai_config**: AI configuration including response templates, restrictions, max tokens
- Migrations in `supabase/migrations/`

### Component Structure

- **Hero** (`components/Hero.tsx`): Landing page with initial topic input
- **Chat** (`components/Chat.tsx`): Main chat interface with message history
- **Sources** (`components/Sources.tsx`): Displays web sources used for teaching
- **Header** (`components/Header.tsx`): Navigation with auth state
- **AdminDashboard** (`components/AdminDashboard.tsx`): Admin configuration panel

### Key Utilities

- **getSystemPrompt** (`utils/utils.ts`): Constructs system prompt with teaching context and age group
- **cleanedText** (`utils/utils.ts`): Normalizes whitespace and truncates content
- **fetchWithTimeout** (`utils/utils.ts`): Fetch with timeout support
- **validateAIRequest** (`utils/aiConfig.ts`): Validates requests against blocked topics

## Important Implementation Notes

- All API routes require Bearer token authentication via middleware
- Rate limiting is optional but recommended for production (requires Upstash)
- The system prompt instructs the tutor to be interactive and quiz students occasionally
- Age groups customize the explanation level (e.g., "Middle School", "High School")
- Web content is limited to first 100,000 characters per source
- Maximum 7 sources are included in teaching context
- Frontend refreshes Supabase session tokens before each API call to prevent expiration
- Search query is prefixed with "what is" to improve educational results

## Testing & Debugging

- Check Helicone dashboard for LLM request logs and costs
- Supabase dashboard shows auth sessions and database state
- API routes log extensively to console for debugging
- Middleware logs user email on successful authentication
- 401 responses indicate auth issues; check token validity and expiration