import { Worker } from "bullmq";

import { createQueueConnection } from "../config/queueRedis.js";
import { EMAIL_QUEUE, type EmailJob } from "../queues/email.queue.js";
import { sendEmail } from "../views/email/send.js";
import { logger } from "../lib/logger.js";

export const emailWorker = new Worker<EmailJob>(
  EMAIL_QUEUE,
  async (job) => sendEmail(job.data),
  { connection: createQueueConnection(), concurrency: 5 },
);

emailWorker.on("failed", (job, err) =>
  logger.error("Email job failed", {
    jobId: job?.id,
    attempt: job?.attemptsMade,
    message: err.message,
  }),
);
