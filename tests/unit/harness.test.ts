import { getPagination } from "../../src/lib/pagination.js";
import { requireAuth } from "../../src/middleware/auth.middleware.js";

/**
 * Proves the harness itself: `.js` specifiers resolve to `.ts` sources, and
 * `tests/setup/env.ts` ran early enough that importing a module which reads
 * `config/env.ts` did not exit the process.
 */
describe("test harness", () => {
  it("resolves .js specifiers to the TypeScript sources", () => {
    expect(getPagination({})).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it("loads modules that depend on the env validator", () => {
    expect(typeof requireAuth).toBe("function");
  });
});
