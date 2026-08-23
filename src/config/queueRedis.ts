import { Redis } from "ioredis";

import { env } from "./env.js";
import { logger } from "../lib/logger.js";

// BullMQ needs blocking commands to wait indefinitely and to buffer while
// reconnecting — the opposite of config/redis.ts, so it gets its own client.
export const createQueueConnection = () => {
  const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
  });

  connection.on("error", (err: Error) =>
    logger.error("Queue Redis error", { message: err.message }),
  );

  return connection;
};
