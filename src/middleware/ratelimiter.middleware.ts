import type { RequestHandler } from "express";

import { redis } from "../config/redis.js";
import { RateLimitError } from "../lib/error.js";

interface RateLimitOptions {
  windowSeconds: number;
  max: number;
}

/** Fixed window per IP + route. Attach to auth and other abuse-prone endpoints. */
export const rateLimit =
  ({ windowSeconds, max }: RateLimitOptions): RequestHandler =>
  async (req, res, next) => {
    const key = `rl:${req.baseUrl}${req.path}:${req.ip}`;

    try {
      const hits = await redis.incr(key);
      if (hits === 1) await redis.expire(key, windowSeconds);

      res.setHeader("RateLimit-Limit", max);
      res.setHeader("RateLimit-Remaining", Math.max(max - hits, 0));

      if (hits > max) return next(new RateLimitError());
      next();
    } catch {
      // Fail open: Redis being down should throttle nothing, not reject everything.
      next();
    }
  };
