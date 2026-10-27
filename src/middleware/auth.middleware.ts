import { fromNodeHeaders } from "better-auth/node";
import type { RequestHandler } from "express";

import { auth } from "../lib/auth.js";
import { UnauthorizedError } from "../lib/error.js";

export interface AuthUser {
  id: string;
}

declare global {
  namespace Express {
    interface Request {
      user: AuthUser;
    }
  }
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) throw new UnauthorizedError();

    req.user = { id: session.user.id };

    next();
  } catch (err) {
    next(err);
  }
};
