import { Queue } from "bullmq";

import { createQueueConnection } from "../config/queueRedis.js";
import type { EmailContent } from "../views/email/layout.js";

export const EMAIL_QUEUE = "email";

export interface EmailJob {
  to: string;
  subject: string;
  content: EmailContent;
}

export const emailQueue = new Queue<EmailJob>(EMAIL_QUEUE, {
  connection: createQueueConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: { age: 3_600, count: 1_000 },
    removeOnFail: { age: 604_800 },
  },
});
