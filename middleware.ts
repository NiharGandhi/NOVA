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

    // For API routes, check the auth token
    if (request.nextUrl.pathname.startsWith('/api/')) {
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
      
      // Add user info to request headers
      request.headers.set('x-user-id', user.id)
      request.headers.set('x-user-email', user.email || '')
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