import { NextRequest, NextResponse } from 'next/server';

// Disable static optimization for this route
export const dynamic = 'force-dynamic';

/**
 * LTI Callback Endpoint
 * Sets session cookies and redirects to home page
 * This is called after successful LTI authentication
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const expiresIn = searchParams.get('expires_in');

    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        { error: 'Missing authentication tokens' },
        { status: 400 }
      );
    }

    // Create response that redirects to home
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/home?lti_launch=true`,
      { status: 302 } // Use 302 temporary redirect to prevent caching
    );

    // Add cache control headers to prevent 304 responses
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };

    // Set access token cookie
    response.cookies.set({
      name: 'sb-access-token',
      value: accessToken,
      ...cookieOptions,
      maxAge: expiresIn ? parseInt(expiresIn) : 3600,
    });

    // Set refresh token cookie
    response.cookies.set({
      name: 'sb-refresh-token',
      value: refreshToken,
      ...cookieOptions,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error('LTI callback error:', error);
    return NextResponse.json(
      { error: 'Failed to set session' },
      { status: 500 }
    );
  }
}

// Handle POST requests (in case middleware or proxy converts GET to POST)
export async function POST(request: NextRequest) {
  // Redirect POST to GET handler by extracting body params
  try {
    const body = await request.json();
    const url = new URL(request.url);

    // Add body params to URL if they exist
    if (body.access_token) url.searchParams.set('access_token', body.access_token);
    if (body.refresh_token) url.searchParams.set('refresh_token', body.refresh_token);
    if (body.expires_in) url.searchParams.set('expires_in', body.expires_in);

    // Create new request with GET method
    const getRequest = new NextRequest(url, {
      method: 'GET',
    });

    return GET(getRequest);
  } catch (error) {
    // If body parsing fails, try form data
    try {
      const formData = await request.formData();
      const url = new URL(request.url);

      const accessToken = formData.get('access_token');
      const refreshToken = formData.get('refresh_token');
      const expiresIn = formData.get('expires_in');

      if (accessToken) url.searchParams.set('access_token', accessToken.toString());
      if (refreshToken) url.searchParams.set('refresh_token', refreshToken.toString());
      if (expiresIn) url.searchParams.set('expires_in', expiresIn.toString());

      const getRequest = new NextRequest(url, {
        method: 'GET',
      });

      return GET(getRequest);
    } catch (formError) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }
  }
}
