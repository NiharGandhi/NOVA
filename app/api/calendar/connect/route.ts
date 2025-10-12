import { NextRequest, NextResponse } from 'next/server';
import { getOAuthUrl } from '@/utils/googleCalendar';

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authUrl = getOAuthUrl(userId);
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error generating OAuth URL:', error);
    return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 });
  }
}
