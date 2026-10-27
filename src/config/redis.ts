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

const READY_TIMEOUT_MS = 10_000;

// Without this the first request after a boot is rejected outright: offline
// queueing is off, so a command sent before the socket is up never runs.
export const awaitRedisReady = () =>
  new Promise<void>((resolve, reject) => {
    if (redis.status === "ready") return resolve();

    const timer = setTimeout(
      () => reject(new Error(`Redis not ready within ${READY_TIMEOUT_MS}ms`)),
      READY_TIMEOUT_MS,
    );

    redis.once("ready", () => {
      clearTimeout(timer);
      resolve();
    });
  });

if (env.NODE_ENV !== "production") globalForRedis.redis = redis;
