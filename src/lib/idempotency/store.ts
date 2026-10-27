import type { Request } from "express";

import { redis } from "../../config/redis.js";
import { fingerprint } from "../canonical.js";

// A request that dies mid-flight locks its key for a minute, not a day.
const CLAIM_TTL_SEC = 60;
const RESULT_TTL_SEC = 24 * 60 * 60;

interface Pending {
  state: "pending";
  fp: string;
}

interface Completed {
  state: "done";
  fp: string;
  status: number;
  body: unknown;
}

type Entry = Pending | Completed;

export type ClaimResult =
  | { kind: "acquired" }
  | { kind: "in_flight" }
  | { kind: "mismatch" }
  | { kind: "replay"; status: number; body: unknown };

export const idemKey = (tenant: string, key: string) => `idem:${tenant}:${key}`;

// originalUrl, not path: inside a mounted router path is relative, so one key
// reused across two routers would fingerprint identically.
export const requestFingerprint = (req: Request) =>
  fingerprint(req.method, req.originalUrl, req.body ?? {});

export async function claim(redisKey: string, fp: string): Promise<ClaimResult> {
  const pending = JSON.stringify({ state: "pending", fp } satisfies Pending);

  // A second pass only when the holder expired between our SET and GET: without
  // it we would report "acquired" for a key nobody holds.
  for (let attempt = 0; attempt < 2; attempt++) {
    // SET NX is the whole concurrency control: GET-then-SET lets two callers both win.
    const acquired = await redis.set(redisKey, pending, "EX", CLAIM_TTL_SEC, "NX");

    if (acquired) return { kind: "acquired" };

    const raw = await redis.get(redisKey);

    if (!raw) continue;

    const entry = JSON.parse(raw) as Entry;

    if (entry.fp !== fp) return { kind: "mismatch" };

    return entry.state === "pending"
      ? { kind: "in_flight" }
      : { kind: "replay", status: entry.status, body: entry.body };
  }

  return { kind: "in_flight" };
}

export const complete = (redisKey: string, fp: string, status: number, body: unknown) =>
  redis.set(
    redisKey,
    JSON.stringify({ state: "done", fp, status, body } satisfies Completed),
    "EX",
    RESULT_TTL_SEC,
  );

export const release = (redisKey: string) => redis.del(redisKey);
