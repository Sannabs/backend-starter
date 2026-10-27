import type { Request, RequestHandler } from "express";

import { POLICIES } from "../lib/ratelimit/policies.js";
import type { PolicyName, Scope } from "../lib/ratelimit/policies.js";
import { consume } from "../lib/ratelimit/limiter.js";
import { RateLimitError } from "../lib/error.js";

function subjectFor(req: Request, scope: Scope): string {
  const ip = req.ip ?? "unknown";

  switch (scope) {
    case "ip":
      return `ip:${ip}`;
    case "user":
      return `u:${req.user?.id ?? `anon:${ip}`}`;
  }
}

export const rateLimit = (
  name: PolicyName,
  opts: { key?: (req: Request) => string; cost?: (req: Request) => number } = {},
): RequestHandler => {
  const policy = POLICIES[name];

  return async (req, res, next) => {
    const subject = opts.key ? opts.key(req) : subjectFor(req, policy.scope);
    const cost = opts.cost ? opts.cost(req) : 1;

    const verdict = await consume(`rl:${name}:${subject}`, policy, cost);

    res.setHeader("RateLimit-Policy", name);
    res.setHeader("RateLimit-Limit", String(policy.capacity));
    res.setHeader("RateLimit-Remaining", String(verdict.remaining));

    if (!verdict.allowed) {
      res.setHeader("Retry-After", String(Math.ceil(verdict.retryAfterMs / 1000)));
      return next(new RateLimitError());
    }

    next();
  };
};
