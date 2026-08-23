import type { RequestHandler } from "express";

import { redis } from "../config/redis.js";
import { IdempotencyConflictError } from "../lib/error.js";

const DEFAULT_TTL_SECONDS = 86_400;

/**
 * Rejects a replayed `Idempotency-Key` on unsafe routes. Fails closed — a
 * duplicate payment costs more than an outage does.
 */
export const idempotency =
  (ttlSeconds = DEFAULT_TTL_SECONDS): RequestHandler =>
  async (req, res, next) => {
    const key = req.header("Idempotency-Key");
    if (!key) return next();

    const reserved = await redis.set(`idem:${key}`, "1", "EX", ttlSeconds, "NX");
    if (!reserved) return next(new IdempotencyConflictError());

    // Release on server error so the client can retry; 4xx stays reserved.
    res.on("finish", () => {
      if (res.statusCode >= 500) void redis.del(`idem:${key}`);
    });

    next();
  };
