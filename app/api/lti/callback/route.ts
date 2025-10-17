import { NextRequest, NextResponse } from 'next/server';

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
      `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/home?lti_launch=true`
    );

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
