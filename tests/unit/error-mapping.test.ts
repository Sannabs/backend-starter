import { jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";
import { APIError } from "better-auth/api";

import { errorHandler } from "../../src/middleware/error.middleware.js";
import { PrismaClientKnownRequestError } from "../../src/generated/prisma/internal/prismaNamespace.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
} from "../../src/lib/error.js";

interface CapturedResponse {
  status: number;
  body: { error: { message: string; code: string } };
}

const runHandler = (
  err: Error,
  handler: typeof errorHandler = errorHandler,
): CapturedResponse => {
  const captured = { status: 0, body: undefined as unknown };

  const res = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  } as unknown as Response;

  handler(
    err,
    { path: "/test", method: "GET" } as Request,
    res,
    (() => undefined) as NextFunction,
  );

  return captured as CapturedResponse;
};

// Every case here drives the handler's own logging. `restoreMocks` puts stderr back
// after each test, so nothing else in the run is muted.
beforeEach(() => {
  jest.spyOn(process.stderr, "write").mockReturnValue(true);
});

describe("errorHandler — typed errors", () => {
  it.each([
    [new NotFoundError("Order", "o_1"), 404, "NOT_FOUND"],
    [new UnauthorizedError(), 401, "UNAUTHORIZED"],
    [new ForbiddenError(), 403, "FORBIDDEN"],
    [new ConflictError("Already exists"), 409, "CONFLICT"],
    [new ValidationError("Bad input"), 400, "VALIDATION_ERROR"],
    [new RateLimitError(), 429, "RATE_LIMIT_ERROR"],
  ])("maps %p to its status and code", (err, status, code) => {
    const response = runHandler(err);

    expect(response.status).toBe(status);
    expect(response.body.error.code).toBe(code);
    expect(response.body.error.message).toBe((err as Error).message);
  });
});

describe("errorHandler — Better Auth errors", () => {
  it("keeps the status and message auth.api meant for the client", () => {
    const response = runHandler(
      new APIError("BAD_REQUEST", { message: "Password too short", code: "PASSWORD_TOO_SHORT" }),
    );

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual({
      message: "Password too short",
      code: "PASSWORD_TOO_SHORT",
    });
  });
});

describe("errorHandler — Prisma constraint violations", () => {
  const prismaError = (code: string, target?: string[]) =>
    new PrismaClientKnownRequestError("db said no", {
      code,
      clientVersion: "test",
      ...(target ? { meta: { target } } : {}),
    });

  it("turns a unique violation into a 409 naming the field", () => {
    const response = runHandler(prismaError("P2002", ["email"]));

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");
    expect(response.body.error.message).toBe("That email is already in use");
  });

  it("falls back to a generic message when no target is reported", () => {
    expect(runHandler(prismaError("P2002")).body.error.message).toBe(
      "That value is already in use",
    );
  });

  it("turns a foreign key violation into a 400", () => {
    const response = runHandler(prismaError("P2003"));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("leaves an unrecognised Prisma code as a 500", () => {
    expect(runHandler(prismaError("P2025")).status).toBe(500);
  });
});

describe("errorHandler — unexpected errors", () => {
  it("returns 500 and echoes the message outside production", () => {
    const response = runHandler(new Error("connection string is postgres://u:p@host"));

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(response.body.error.message).toContain("postgres://");
  });

  /**
   * `env` is parsed once at import, so flipping process.env after the fact does
   * nothing — the module has to be loaded again under the production value.
   */
  it("hides the message in production", async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    jest.resetModules();

    try {
      const { errorHandler: productionHandler } = await import(
        "../../src/middleware/error.middleware.js"
      );
      const response = runHandler(
        new Error("connection string is postgres://u:p@host"),
        productionHandler,
      );

      expect(response.status).toBe(500);
      expect(response.body.error.message).toBe("An unexpected error occurred");
    } finally {
      process.env.NODE_ENV = original;
      jest.resetModules();
    }
  });
});
