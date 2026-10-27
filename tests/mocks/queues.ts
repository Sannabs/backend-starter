/**
 * Stands in for every `queues/*.queue.ts`. Those construct a BullMQ Queue at
 * module scope, which opens a Redis socket the moment anything imports them —
 * that is what stops Jest exiting. Jobs land in an array a test can read.
 */
export interface RecordedJob {
  queue: string;
  name: string;
  data: unknown;
  options?: unknown;
}

const jobs: RecordedJob[] = [];

export const recordedJobs = (): RecordedJob[] => jobs;
export const __resetQueues = () => {
  jobs.length = 0;
};

const stub = (queue: string) => ({
  name: queue,
  async add(name: string, data: unknown, options?: unknown) {
    jobs.push({ queue, name, data, options });
    return { id: String(jobs.length) };
  },
  async upsertJobScheduler() {},
  async close() {},
});

export const EMAIL_QUEUE = "email";
export const MAINTENANCE_QUEUE = "maintenance";

export const emailQueue = stub(EMAIL_QUEUE);
export const maintenanceQueue = stub(MAINTENANCE_QUEUE);

export const scheduleIdempotencyPrune = async () => {};
