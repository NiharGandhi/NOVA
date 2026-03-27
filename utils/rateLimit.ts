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

export async function checkChatRateLimit(userId: string): Promise<{ allowed: boolean; reset: number }> {
  if (!chatLimiter) return { allowed: true, reset: 0 };
  const { success, reset } = await chatLimiter.limit(userId);
  return { allowed: success, reset };
}

export async function checkUploadRateLimit(userId: string): Promise<{ allowed: boolean; reset: number }> {
  if (!uploadLimiter) return { allowed: true, reset: 0 };
  const { success, reset } = await uploadLimiter.limit(userId);
  return { allowed: success, reset };
}