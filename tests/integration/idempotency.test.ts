import type { NextFunction, Request, Response } from "express";

import { idempotency } from "../../src/middleware/idempotency.middleware.js";
import {
  ConflictError,
  IdempotencyConflictError,
  ServiceUnavailableError,
  ValidationError,
} from "../../src/lib/error.js";
import { __resetRedis, __ttlSeconds, redis } from "../mocks/redis.js";

interface FakeResponse {
  statusCode: number;
  headers: Record<string, string>;
  listeners: Record<string, (() => void)[]>;
  status(code: number): FakeResponse;
  json(body: unknown): FakeResponse;
  send(body: unknown): FakeResponse;
  setHeader(name: string, value: string): void;
  on(event: string, listener: () => void): FakeResponse;
}

interface Captured {
  status: number;
  body: unknown;
  nextCalls: unknown[];
  res: Response;
  fake: FakeResponse;
}

const request = ({
  key,
  userId = "u_1",
  body = { amount: "5000", recipient: "+2207778888" },
  url = "/api/v1/orders",
}: { key?: string; userId?: string; body?: unknown; url?: string } = {}) =>
  ({
    method: "POST",
    originalUrl: url,
    body,
    user: { id: userId },
    header: (name: string) => (name.toLowerCase() === "idempotency-key" ? key : undefined),
  }) as unknown as Request;

/** Mirrors express: `status()` mutates `statusCode`, which the guard reads at json time. */
const responder = (): Captured => {
  const captured = { status: 200, body: undefined, nextCalls: [] } as unknown as Captured;

  const fake: FakeResponse = {
    statusCode: 200,
    headers: {},
    listeners: {},
    status(code) {
      this.statusCode = code;
      captured.status = code;
      return this;
    },
    json(body) {
      captured.body = body;
      return this;
    },
    send(body) {
      captured.body = body;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    on(event, listener) {
      (this.listeners[event] ??= []).push(listener);
      return this;
    },
  };

  captured.fake = fake;
  captured.res = fake as unknown as Response;
  return captured;
};

const run = async (req: Request, captured = responder()) => {
  const next = ((err?: unknown) => {
    captured.nextCalls.push(err);
  }) as NextFunction;

  await idempotency()(req, captured.res, next);
  return captured;
};

/** What a handler downstream of the guard does once `next()` lets it through. */
const respond = (captured: Captured, status: number, body: unknown) =>
  captured.res.status(status).json(body);

const stored = async (userId: string, key: string) => {
  const raw = await redis.get(`idem:${userId}:${key}`);
  return raw ? (JSON.parse(raw) as { state: string }) : null;
};

beforeEach(() => __resetRedis());

describe("idempotency", () => {
  it("passes straight through when no key is supplied", async () => {
    const captured = await run(request());

    expect(captured.nextCalls).toEqual([undefined]);
  });

  it("rejects a key too long for the unique index", async () => {
    const captured = await run(request({ key: "k".repeat(256) }));

    expect(captured.nextCalls[0]).toBeInstanceOf(ValidationError);
  });

  it("marks the key in-flight for a minute, not a day", async () => {
    await run(request({ key: "k_1" }));

    expect((await stored("u_1", "k_1"))?.state).toBe("pending");
    expect(__ttlSeconds("idem:u_1:k_1")).toBeLessThanOrEqual(60);
  });

  it("keeps a completed response for the full day", async () => {
    const first = await run(request({ key: "k_1" }));
    respond(first, 202, { data: { id: "t_1" } });

    expect(__ttlSeconds("idem:u_1:k_1")).toBeGreaterThan(60);
  });

  it("rejects a second request while the first is still in flight", async () => {
    await run(request({ key: "k_1" }));
    const second = await run(request({ key: "k_1" }));

    expect(second.nextCalls[0]).toBeInstanceOf(IdempotencyConflictError);
    expect(second.fake.headers["Retry-After"]).toBe("2");
  });

  it("replays the cached status and body once the first has answered", async () => {
    const first = await run(request({ key: "k_1" }));
    respond(first, 202, { data: { id: "t_1" } });

    const replay = await run(request({ key: "k_1" }));

    expect(replay.status).toBe(202);
    expect(replay.body).toEqual({ data: { id: "t_1" } });
    expect(replay.fake.headers["Idempotent-Replay"]).toBe("true");
    expect(replay.nextCalls).toEqual([]);
  });

  it("caches a response the handler answered with send, not json", async () => {
    const first = await run(request({ key: "k_1" }));
    first.res.status(202).send("queued");

    expect((await stored("u_1", "k_1"))?.state).toBe("done");
  });

  it("namespaces keys per user — the same key from two users does not collide", async () => {
    const first = await run(request({ key: "k_1", userId: "u_1" }));
    respond(first, 202, { data: { id: "belongs-to-u1" } });

    const other = await run(request({ key: "k_1", userId: "u_2" }));

    expect(other.nextCalls).toEqual([undefined]);
    expect(other.body).toBeUndefined();
  });
});

describe("idempotency — the double-send cases", () => {
  /** Replaying the first answer would silently drop the second request's data. */
  it("refuses a reused key carrying a different body", async () => {
    const first = await run(request({ key: "k_1" }));
    respond(first, 202, { data: { id: "t_1" } });

    const reused = await run(request({ key: "k_1", body: { amount: "9000" } }));

    expect(reused.nextCalls[0]).toBeInstanceOf(ConflictError);
    expect(reused.body).toBeUndefined();
  });

  it("treats the same body under a different route as a different request", async () => {
    const first = await run(request({ key: "k_1", url: "/api/v1/orders" }));
    respond(first, 202, { data: { id: "t_1" } });

    const elsewhere = await run(request({ key: "k_1", url: "/api/v1/invoices" }));

    expect(elsewhere.nextCalls[0]).toBeInstanceOf(ConflictError);
  });

  it("fingerprints bodies by content, not key order", async () => {
    const first = await run(request({ key: "k_1", body: { a: 1, b: 2 } }));
    respond(first, 202, { data: { id: "t_1" } });

    const reordered = await run(request({ key: "k_1", body: { b: 2, a: 1 } }));

    expect(reordered.body).toEqual({ data: { id: "t_1" } });
  });

  /** The claim is one SET NX; a `get` then `set` would let both through. */
  it("stops the second of two concurrent requests with the same key", async () => {
    const [a, b] = await Promise.all([
      run(request({ key: "k_1" })),
      run(request({ key: "k_1" })),
    ]);

    const outcomes = [a, b].map((captured) => captured.nextCalls[0]);
    expect(outcomes).toContainEqual(undefined);
    expect(outcomes.some((err) => err instanceof IdempotencyConflictError)).toBe(true);
  });

  it.each([
    ["a transient 500", 500, { error: { message: "upstream timeout" } }],
    ["a 400", 400, { error: { message: "bad input" } }],
  ])("releases the key after %s", async (_label, status, body) => {
    const first = await run(request({ key: "k_1" }));
    respond(first, status, body);

    expect(await stored("u_1", "k_1")).toBeNull();

    const retry = await run(request({ key: "k_1" }));
    expect(retry.nextCalls).toEqual([undefined]);
  });

  /** The handler is still running; freeing the key would let the retry run beside it. */
  it("keeps the claim when the client disconnects before the handler answers", async () => {
    const first = await run(request({ key: "k_1" }));
    first.fake.listeners.close?.forEach((listener) => listener());

    const retry = await run(request({ key: "k_1" }));

    expect(retry.nextCalls[0]).toBeInstanceOf(IdempotencyConflictError);
  });

  /** The claim expired between the SET NX and the GET: take it, don't wave the request through unclaimed. */
  it("re-claims a key whose holder expired mid-check", async () => {
    await run(request({ key: "k_1" }));
    await redis.del("idem:u_1:k_1");

    const retry = await run(request({ key: "k_1" }));

    expect(retry.nextCalls).toEqual([undefined]);
    expect((await stored("u_1", "k_1"))?.state).toBe("pending");
  });

  it("fails closed with a 503 when the store is unreachable", async () => {
    const set = redis.set;
    redis.set = async () => {
      throw new Error("ECONNREFUSED");
    };

    try {
      const captured = await run(request({ key: "k_1" }));
      expect(captured.nextCalls[0]).toBeInstanceOf(ServiceUnavailableError);
    } finally {
      redis.set = set;
    }
  });
});
