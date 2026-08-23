import { Redis } from "ioredis";

import { env } from "./env.js";
import { logger } from "../lib/logger.js";

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    // Commands fail fast instead of queueing: the rate limiter fails open, and a
    // queued command would stall the request rather than skip the check.
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

redis.on("error", (err: Error) => logger.error("Redis error", { message: err.message }));

if (env.NODE_ENV !== "production") globalForRedis.redis = redis;
