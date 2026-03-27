import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let redis: Redis | null = null;
let chatLimiter: Ratelimit | null = null;
let uploadLimiter: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  chatLimiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 m'), prefix: 'rl:chat' });
  uploadLimiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 h'), prefix: 'rl:upload' });
}

/**
 * Check whether a user is permitted to make a chat request under the configured rate limiter.
 *
 * @param userId - Identifier used as the rate-limiting key for the user
 * @returns An object with `allowed` set to `true` if the request is permitted and `false` otherwise, and `reset` as the time in seconds since the UNIX epoch when the rate limit will reset (returns `0` if no limiter is configured)
 */
export async function checkChatRateLimit(userId: string): Promise<{ allowed: boolean; reset: number }> {
  if (!chatLimiter) return { allowed: true, reset: 0 };
  const { success, reset } = await chatLimiter.limit(userId);
  return { allowed: success, reset };
}

/**
 * Determine whether a user is allowed to perform an upload under the configured upload rate limiter.
 *
 * @param userId - The user identifier to check
 * @returns `allowed` is `true` if the upload is permitted, `false` otherwise. `reset` is the Unix timestamp in seconds when the rate-limit window resets; `0` if no limiter is configured.
 */
export async function checkUploadRateLimit(userId: string): Promise<{ allowed: boolean; reset: number }> {
  if (!uploadLimiter) return { allowed: true, reset: 0 };
  const { success, reset } = await uploadLimiter.limit(userId);
  return { allowed: success, reset };
}