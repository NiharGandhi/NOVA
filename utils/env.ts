const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TOGETHER_API_KEY',
  'NEXT_PUBLIC_APP_URL',
] as const;

/**
 * Validates that all required environment variables are present.
 *
 * @throws Error if any required environment variables are missing; the error message lists the missing variable names.
 */
export function validateEnv(): void {
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Retrieve the Supabase service role key from the environment.
 *
 * @returns The value of `SUPABASE_SERVICE_ROLE_KEY`.
 * @throws If `SUPABASE_SERVICE_ROLE_KEY` is not set in the environment.
 */
export function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return key;
}

/**
 * Get the public Supabase URL from the NEXT_PUBLIC_SUPABASE_URL environment variable.
 *
 * @returns The configured `NEXT_PUBLIC_SUPABASE_URL`.
 * @throws Error if `NEXT_PUBLIC_SUPABASE_URL` is not set.
 */
export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  return url;
}