import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";

import { ValidationError } from "../lib/error.js";

export const validateBody =
  <T>(schema: ZodType<T>) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const issue = result.error.issues[0]!;
      const field = issue.path.join(".");
      return next(
        new ValidationError(field ? `${field}: ${issue.message}` : issue.message),
      );
    }

    req.body = result.data;
    next();
  };

export const validateQuery =
  <T>(schema: ZodType<T>) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const issue = result.error.issues[0]!;
      const field = issue.path.join(".");
      return next(
        new ValidationError(field ? `${field}: ${issue.message}` : issue.message),
      );
    }

    // Express 5 exposes req.query as a getter, so the parsed value is defined over it.
    Object.defineProperty(req, "query", { value: result.data, writable: true });
    next();
  };
