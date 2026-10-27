import { emailWorker } from "./workers/email.worker.js";
import { maintenanceWorker } from "./workers/maintenance.worker.js";
import { scheduleIdempotencyPrune } from "./queues/maintenance.queue.js";
import { prisma } from "./config/prisma.js";
import { awaitRedisReady } from "./config/redis.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";

const workers = [emailWorker, maintenanceWorker];

async function main() {
  await prisma.$connect();
  await awaitRedisReady();
  await scheduleIdempotencyPrune();
  logger.info("Workers started", {
    env: env.NODE_ENV,
    queues: workers.map((w) => w.name),
  });
}

// Let in-flight jobs finish before exit, otherwise they are retried as stalled.
const shutdown = async (signal: string) => {
  logger.info(`${signal} received, draining workers`);
  await Promise.all(workers.map((w) => w.close()));
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

main().catch((err: unknown) => {
  logger.error("Failed to start workers", { err });
  process.exit(1);
});
