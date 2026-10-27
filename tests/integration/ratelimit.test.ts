import type { NextFunction, Request, Response } from "express";

import { rateLimit } from "../../src/middleware/ratelimiter.middleware.js";
import { RateLimitError } from "../../src/lib/error.js";
import type { PolicyName } from "../../src/lib/ratelimit/policies.js";
import { __resetRedis, redis } from "../mocks/redis.js";

const request = ({ ip = "10.0.0.1", userId = "u_1" } = {}) =>
  ({ ip, user: { id: userId } }) as unknown as Request;

const hit = async (name: PolicyName, req = request()) => {
  const headers: Record<string, string> = {};
  const res = {
    setHeader: (key: string, value: string) => {
      headers[key] = value;
    },
  } as unknown as Response;

  let error: unknown;
  await rateLimit(name)(req, res, ((err?: unknown) => {
    error = err;
  }) as NextFunction);

  return { error, headers };
};

const drain = async (name: PolicyName, times: number, req = request()) => {
  for (let i = 0; i < times; i++) await hit(name, req);
};

beforeEach(() => __resetRedis());

describe("rateLimit", () => {
  it("rejects once the bucket is empty, and says when to come back", async () => {
    await drain("auth:email", 10);

    const { error, headers } = await hit("auth:email");

    expect(error).toBeInstanceOf(RateLimitError);
    expect(Number(headers["Retry-After"])).toBeGreaterThan(0);
  });

  it("names the policy and what is left of it in the headers", async () => {
    const { headers } = await hit("auth:email");

    expect(headers["RateLimit-Policy"]).toBe("auth:email");
    expect(headers["RateLimit-Limit"]).toBe("10");
    expect(headers["RateLimit-Remaining"]).toBe("9");
  });

  it("gives every policy its own budget", async () => {
    await drain("auth:email", 10);

    expect((await hit("auth:email")).error).toBeInstanceOf(RateLimitError);
    expect((await hit("api:default")).error).toBeUndefined();
  });

  it("scopes ip policies per address", async () => {
    await drain("auth:email", 10, request({ ip: "10.0.0.1" }));

    expect((await hit("auth:email", request({ ip: "10.0.0.2" }))).error).toBeUndefined();
  });

  /** Behind CGNAT many customers share an IP; a user policy must not ration them together. */
  it("scopes user policies per user, not per IP", async () => {
    await drain("api:default", 100, request({ userId: "u_1" }));

    expect((await hit("api:default", request({ userId: "u_1" }))).error).toBeInstanceOf(
      RateLimitError,
    );
    expect((await hit("api:default", request({ userId: "u_2" }))).error).toBeUndefined();
  });
});

describe("rateLimit — when Redis is down", () => {
  const withRedisDown = async (assertion: () => Promise<void>) => {
    const evaluate = redis.eval;
    redis.eval = async () => {
      throw new Error("ECONNREFUSED");
    };
    try {
      await assertion();
    } finally {
      redis.eval = evaluate;
    }
  };

  it("lets a capacity limit through", () =>
    withRedisDown(async () => {
      expect((await hit("api:default")).error).toBeUndefined();
    }));

  it("refuses auth:email, because every request through it sends an email", () =>
    withRedisDown(async () => {
      expect((await hit("auth:email")).error).toBeInstanceOf(RateLimitError);
    }));
});
