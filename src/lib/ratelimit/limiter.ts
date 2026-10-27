import { redis } from '../../config/redis.js'
import { logger } from '../logger.js';

const SCRIPT = `
local capacity = tonumber(ARGV[1])
local refill   = tonumber(ARGV[2])
local now      = tonumber(ARGV[3])
local cost     = tonumber(ARGV[4])
local ttl      = tonumber(ARGV[5])

local b = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(b[1])
local ts     = tonumber(b[2])
if tokens == nil then tokens = capacity; ts = now end

tokens = math.min(capacity, tokens + (math.max(0, now - ts) / 1000) * refill)

local allowed = 0
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
end

redis.call('HSET', KEYS[1], 'tokens', tokens, 'ts', now)
redis.call('PEXPIRE', KEYS[1], ttl)

local retryAfterMs = 0
if allowed == 0 then
  retryAfterMs = math.ceil(((cost - tokens) / refill) * 1000)
end

return { allowed, math.floor(tokens), retryAfterMs }
`;

export interface Verdict {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  degraded: boolean;
}

export async function consume(
  key: string,
  policy: { capacity: number; refillPerSec: number; failOpen: boolean },
  cost = 1,
): Promise<Verdict> {
  const ttl = Math.ceil((policy.capacity / policy.refillPerSec) * 1000) + 60_000;

  try {
    const raw = (await redis.eval(
      SCRIPT, 1, key,
      String(policy.capacity), String(policy.refillPerSec),
      String(Date.now()), String(cost), String(ttl),
    )) as unknown;

    if (!Array.isArray(raw) || raw.length !== 3) {
      throw new Error('unexpected limiter reply shape');
    }
    const [allowed, remaining, retryAfterMs] = raw as [number, number, number];
    return { allowed: allowed === 1, remaining, retryAfterMs, degraded: false };
  } catch (err) {
    logger.error('ratelimit degraded', {
      key,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return { allowed: policy.failOpen, remaining: 0, retryAfterMs: 1000, degraded: true };
  }
}