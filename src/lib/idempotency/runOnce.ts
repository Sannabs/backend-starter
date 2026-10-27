import type { Prisma } from "../../generated/prisma/client.js";
import { PrismaClientKnownRequestError } from "../../generated/prisma/internal/prismaNamespace.js";
import { prisma } from "../../config/prisma.js";

const isUniqueViolation = (err: unknown) =>
  err instanceof PrismaClientKnownRequestError && err.code === "P2002";

// The effect runs inside a transaction holding a pool connection, so it must be
// local work only. Provider calls key off their own row id, never this.
const TRANSACTION_TIMEOUT_MS = 5_000;
const CONNECTION_WAIT_MS = 2_000;

// Matches the 24h the Redis response cache holds a key; after it the key is reusable.
const RECORD_RETENTION_MS = 24 * 60 * 60 * 1000;

interface RunOnceOptions<T> {
  scope: string;
  tenantId: string;
  key: string;
  effect: (tx: Prisma.TransactionClient) => Promise<T>;
  reload: (id: string) => Promise<T>;
}

export async function runOnce<T extends { id: string }>({
  scope,
  tenantId,
  key,
  effect,
  reload,
}: RunOnceOptions<T>): Promise<{ result: T; replayed: boolean }> {
  const ident = { scope, tenantId, key };

  try {
    // Sharing the effect's transaction is the mechanism: a second caller blocks
    // on the unique index until this commits.
    const result = await prisma.$transaction(async (tx) => {
      const created = await effect(tx);

      await tx.idempotencyRecord.create({ data: { ...ident, resultRef: created.id } });

      return created;
    }, { timeout: TRANSACTION_TIMEOUT_MS, maxWait: CONNECTION_WAIT_MS });

    return { result, replayed: false };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;

    const prior = await prisma.idempotencyRecord.findUniqueOrThrow({
      where: { idempotencyLookup: ident },
      select: { resultRef: true },
    });

    return { result: await reload(prior.resultRef), replayed: true };
  }
}

export const pruneIdempotencyRecords = async (): Promise<number> => {
  const { count } = await prisma.idempotencyRecord.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - RECORD_RETENTION_MS) } },
  });

  return count;
};
