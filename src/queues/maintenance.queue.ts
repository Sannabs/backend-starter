import { Queue } from "bullmq";

import { createQueueConnection } from "../config/queueRedis.js";

export const MAINTENANCE_QUEUE = "maintenance";

const PRUNE_EVERY_MS = 60 * 60_000;

export const maintenanceQueue = new Queue(MAINTENANCE_QUEUE, {
  connection: createQueueConnection(),
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 86_400, count: 24 },
    removeOnFail: { age: 604_800 },
  },
});

// The schedule lives in Redis, which is disposable — re-arm it on every boot.
export const scheduleIdempotencyPrune = () =>
  maintenanceQueue.upsertJobScheduler("prune-idempotency", { every: PRUNE_EVERY_MS });
