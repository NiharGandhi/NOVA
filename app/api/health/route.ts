import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * Create a JSON health report for service dependencies.
 *
 * Performs lightweight checks for Supabase connectivity and required environment variables,
 * then returns a JSON payload summarizing per-check results and an overall status.
 *
 * @returns A NextResponse with a JSON body { status, checks, ts } where `status` is "ok" when all checks are "ok" and "degraded" otherwise, `checks` maps dependency names to "ok" or "error", and `ts` is the current ISO timestamp; HTTP status is 200 when all checks pass, otherwise 503.
 */
export async function GET() {
  const checks: Record<string, 'ok' | 'error'> = {};

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error } = await supabase.from('users').select('id').limit(1);
    checks.supabase = error ? 'error' : 'ok';
  } catch {
    checks.supabase = 'error';
  }

  checks.together_ai = process.env.TOGETHER_API_KEY ? 'ok' : 'error';
  checks.app_url = process.env.NEXT_PUBLIC_APP_URL ? 'ok' : 'error';

  const allOk = Object.values(checks).every(v => v === 'ok');

  return NextResponse.json(
    { status: allOk ? 'ok' : 'degraded', checks, ts: new Date().toISOString() },
    { status: allOk ? 200 : 503 }
  );
}