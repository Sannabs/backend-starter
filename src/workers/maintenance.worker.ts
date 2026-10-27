import { Worker } from "bullmq";

import { createQueueConnection } from "../config/queueRedis.js";
import { MAINTENANCE_QUEUE } from "../queues/maintenance.queue.js";
import { pruneIdempotencyRecords } from "../lib/idempotency/runOnce.js";
import { logger } from "../lib/logger.js";

export const maintenanceWorker = new Worker(
  MAINTENANCE_QUEUE,
  async () => {
    const pruned = await pruneIdempotencyRecords();

    if (pruned > 0) logger.info("Pruned idempotency records", { pruned });
  },
  { connection: createQueueConnection(), concurrency: 1 },
);

maintenanceWorker.on("failed", (_job, err) =>
  logger.error("Idempotency prune failed", { message: err.message }),
);
