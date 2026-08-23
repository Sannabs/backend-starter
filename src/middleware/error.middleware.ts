import type { Request, Response, NextFunction } from "express";
import { PrismaClientKnownRequestError } from "../generated/prisma/internal/prismaNamespace.js";
import { AppError, ConflictError, ValidationError } from "../lib/error.js";
import { logger } from "../lib/logger.js";

// Constraint violations are expected outcomes of user input, not server faults.
function toAppError(err: Error): Error {
  if (!(err instanceof PrismaClientKnownRequestError)) return err;

  const fields = (err.meta?.target as string[] | undefined)?.join(", ");

  if (err.code === "P2002") {
    return new ConflictError(
      fields ? `That ${fields} is already in use` : "That value is already in use",
    );
  }
  if (err.code === "P2003") return new ValidationError("Referenced record does not exist");

  return err;
}

export function errorHandler(
  original: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const err = toAppError(original);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
      },
    });
  }

  // Always log the full error server-side regardless of environment
  logger.error("Unexpected error", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  const message =
    process.env.NODE_ENV === "production"
      ? "An unexpected error occurred"
      : err.message;

  return res.status(500).json({
    error: {
      message,
      code: "INTERNAL_ERROR",
    },
  });
}