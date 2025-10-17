import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  try {
    // Create a response and pass it to the Supabase client
    let response = NextResponse.next()

    // Create a Supabase client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: any) {
            response.cookies.delete({
              name,
              ...options,
            })
          },
        },
      }
    )

    // Get auth token from header
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.split('Bearer ')[1]

    // For API routes, check the auth token (except OAuth callback and LTI endpoints)
    if (request.nextUrl.pathname.startsWith('/api/')) {
      // Skip auth check for OAuth callback route (called by Google)
      if (request.nextUrl.pathname === '/api/calendar/callback') {
        return response;
      }

      // Skip auth check for public LTI endpoints (called by LMS platforms)
      // These are the endpoints that LMS platforms call directly
      const publicLTIEndpoints = [
        '/api/lti/login',
        '/api/lti/launch',
        '/api/lti/jwks',
      ];

      if (publicLTIEndpoints.some(endpoint => request.nextUrl.pathname === endpoint)) {
        return response;
      }

      if (!token) {
        console.log('No auth token provided')
        return new NextResponse(
          JSON.stringify({ error: 'Unauthorized - No auth token' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      // Set the auth token in the client
      const { data: { user }, error } = await supabase.auth.getUser(token)

      if (error || !user) {
        console.error('Invalid auth token:', error)
        return new NextResponse(
          JSON.stringify({ error: 'Unauthorized - Invalid auth token' }),
          { 
            status: 401, 
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      console.log('Valid session found for:', user.email)

      // Create new headers with user info
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-user-id', user.id)
      requestHeaders.set('x-user-email', user.email || '')

      // Create a new response with the updated headers
      response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })
    }

    return response
  } catch (error) {
    console.error('Middleware error:', error)
    
    // If it's an API route, return JSON error
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({ error: 'Internal Server Error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // For other routes, continue
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}