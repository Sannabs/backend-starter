import { styleText } from "node:util";

import type { NextFunction, Request, Response } from "express";

import { logger, type TextStyle } from "../lib/logger.js";

const SLOW_MS = 500;
const VERY_SLOW_MS = 1000;

function statusColor(status: number): TextStyle {
  if (status >= 500) return ["red", "bold"];
  if (status >= 400) return ["yellow"];
  if (status >= 300) return ["cyan"];
  return ["green"];
}

function durationColor(ms: number): TextStyle {
  if (ms >= VERY_SLOW_MS) return ["red"];
  if (ms >= SLOW_MS) return ["yellow"];
  return ["dim"];
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const stream = res.statusCode >= 400 ? process.stderr : process.stdout;

    const method = styleText("bold", req.method.padEnd(6), { stream });
    const status = styleText(statusColor(res.statusCode), String(res.statusCode), { stream });
    const duration = styleText(durationColor(ms), `${ms.toFixed(1)}ms`, { stream });

    const line = `${method} ${req.originalUrl} ${status} ${duration}`;

    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else logger.info(line);
  });

  next();
}
