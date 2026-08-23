import { inspect, styleText } from "node:util";

import { env } from "../config/env.js";

type Level = "debug" | "info" | "warn" | "error";

/** `InspectColor` is not exported from node:util, so pull it off the signature. */
export type TextStyle = Parameters<typeof styleText>[0];

const STYLE: Record<Level, TextStyle> = {
  debug: ["dim"],
  info: ["cyan"],
  warn: ["yellow"],
  error: ["red", "bold"],
};

const RANK: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const minRank = env.NODE_ENV === "production" ? RANK.info : RANK.debug;

function write(level: Level, message: string, meta?: Record<string, unknown>) {
  if (RANK[level] < minRank) return;

  const stream = RANK[level] >= RANK.warn ? process.stderr : process.stdout;
  const time = styleText("dim", new Date().toISOString(), { stream });
  const label = styleText(STYLE[level], level.toUpperCase().padEnd(5), {
    stream,
  });
  const detail =
    meta && Object.keys(meta).length > 0
      ? ` ${inspect(meta, { colors: Boolean(stream.isTTY), depth: 4, breakLength: Infinity })}`
      : "";

  stream.write(`${time} ${label} ${message}${detail}\n`);
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) =>
    write("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) =>
    write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) =>
    write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) =>
    write("error", message, meta),
};
