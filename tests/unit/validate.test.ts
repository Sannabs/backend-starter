import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { validateBody, validateQuery } from "../../src/middleware/validate.middleware.js";
import { ValidationError } from "../../src/lib/error.js";

const run = (handler: ReturnType<typeof validateBody>, req: Request) => {
  let error: unknown = "next not called";
  handler(req, {} as Response, ((err?: unknown) => {
    error = err;
  }) as NextFunction);
  return error;
};

/** Express 5 defines req.query as a getter on the prototype; plain assignment throws. */
const expressRequest = (query: Record<string, string>) => {
  const req = Object.create({
    get query() {
      return query;
    },
  }) as Request;
  return req;
};

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  status: z.enum(["PENDING", "PAID"]).optional(),
});

describe("validateQuery", () => {
  it("replaces req.query with the parsed, coerced value", () => {
    const req = expressRequest({ page: "3", status: "PAID" });

    expect(run(validateQuery(listQuery), req)).toBeUndefined();
    expect(req.query).toEqual({ page: 3, status: "PAID" });
  });

  it("applies schema defaults", () => {
    const req = expressRequest({});

    run(validateQuery(listQuery), req);

    expect(req.query).toEqual({ page: 1 });
  });

  it("names the failing field", () => {
    const error = run(validateQuery(listQuery), expressRequest({ status: "LOST" }));

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).message).toMatch(/^status: /);
  });
});

describe("validateBody", () => {
  it("replaces req.body with the parsed value", () => {
    const req = { body: { page: "2" } } as Request;

    expect(run(validateBody(listQuery), req)).toBeUndefined();
    expect(req.body).toEqual({ page: 2 });
  });

  it("names the failing field", () => {
    const error = run(validateBody(listQuery), { body: { page: "0" } } as Request);

    expect((error as ValidationError).message).toMatch(/^page: /);
  });
});
