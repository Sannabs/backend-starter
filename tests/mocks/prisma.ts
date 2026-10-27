/**
 * Stands in for `config/prisma.ts` so no suite opens a pool. Every model method
 * throws until a test replaces it — a silent `undefined` from an unmocked query
 * is how a test ends up asserting nothing.
 *
 *   const { prisma } = await import("../mocks/prisma.js");
 *   prisma.broadcast.findFirst = async () => ({ id: "b_1" });
 */
const unmocked = (path: string) => () => {
  throw new Error(
    `prisma.${path} was called but not mocked. Assign it in the test that needs it.`,
  );
};

const model = (name: string) =>
  new Proxy(
    {},
    {
      get: (target: Record<string, unknown>, method: string) =>
        target[method] ?? unmocked(`${name}.${String(method)}`),
      set: (target: Record<string, unknown>, method: string, value: unknown) => {
        target[method] = value;
        return true;
      },
    },
  );

let rollback: (() => void) | null = null;

/** Runs when a callback transaction throws. Pass null to clear it. */
export const __onRollback = (restore: (() => void) | null) => {
  rollback = restore;
};

export const prisma = new Proxy(
  {} as Record<string, unknown>,
  {
    get: (target, name: string) => {
      if (name === "$transaction") {
        // The callback form runs against this same proxy. The mock owns no rows, so
        // a test that needs rollback restores its own state through `__onRollback`.
        return async (operations: unknown) => {
          if (Array.isArray(operations)) return Promise.all(operations);
          if (typeof operations !== "function") return operations;

          try {
            return await operations(prisma);
          } catch (err) {
            rollback?.();
            throw err;
          }
        };
      }
      if (name === "$connect" || name === "$disconnect") return async () => {};
      if (name.startsWith("$")) return target[name] ?? unmocked(name);

      target[name] ??= model(name);
      return target[name];
    },
  },
);
