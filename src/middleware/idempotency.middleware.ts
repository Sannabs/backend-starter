import type { Request, RequestHandler } from "express";

import {
  claim,
  complete,
  idemKey,
  release,
  requestFingerprint,
} from "../lib/idempotency/store.js";
import {
  ConflictError,
  IdempotencyConflictError,
  ServiceUnavailableError,
  ValidationError,
} from "../lib/error.js";
import { logger } from "../lib/logger.js";

const HEADER = "Idempotency-Key";

// Keyed writes also land in a unique index, which a multi-kilobyte header would overflow.
const MAX_KEY_LENGTH = 255;

const subjectFor = (req: Request) => req.user?.id ?? `ip:${req.ip ?? "unknown"}`;

export const idempotency =
  (opts: { required?: boolean } = {}): RequestHandler =>
  async (req, res, next) => {
    const key = req.header(HEADER);
    if (!key) {
      return next(opts.required ? new ValidationError(`${HEADER} header is required`) : undefined);
    }
    if (key.length > MAX_KEY_LENGTH) {
      return next(new ValidationError(`${HEADER} must be at most ${MAX_KEY_LENGTH} characters`));
    }

    const redisKey = idemKey(subjectFor(req), key);
    const fp = requestFingerprint(req);

    let result;
    try {
      result = await claim(redisKey, fp);
    } catch (err) {
      // Fail closed: no store, no mutation.
      logger.error("Idempotency store unavailable", {
        redisKey,
        message: err instanceof Error ? err.message : String(err),
      });
      return next(new ServiceUnavailableError("Idempotency store unavailable"));
    }

    if (result.kind === "mismatch") {
      return next(new ConflictError(`${HEADER} reused with a different payload`));
    }
    if (result.kind === "in_flight") {
      res.setHeader("Retry-After", "2");
      return next(new IdempotencyConflictError());
    }
    if (result.kind === "replay") {
      res.setHeader("Idempotent-Replay", "true");
      return res.status(result.status).json(result.body);
    }

    let settled = false;
    const finish = (status: number, body: unknown) => {
      if (settled) return;
      settled = true;
      // Only 2xx is cached; a transient 500 must not become the answer for 24h.
      const write =
        status >= 200 && status < 300
          ? complete(redisKey, fp, status, body)
          : release(redisKey);
      write.catch((err: unknown) =>
        logger.error("Idempotency store write failed", {
          redisKey,
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    };

    // send is wrapped too, or a handler answering with it leaves the claim
    // stuck until expiry. bind: Express's implementations use `this`.
    // No release on socket close: the handler is still running, and freeing the
    // key then would let the client's retry run alongside it.
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      finish(res.statusCode, body);
      return originalJson(body);
    };

    const originalSend = res.send.bind(res);
    res.send = (body: unknown) => {
      finish(res.statusCode, body);
      return originalSend(body);
    };

    next();
  };
