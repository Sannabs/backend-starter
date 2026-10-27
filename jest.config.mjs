/**
 * ESM + TypeScript. The package is `"type": "module"` and source imports carry the
 * `.js` extension Node requires, so `tests/resolver.cjs` maps those onto the `.ts`
 * sources. Needs `NODE_OPTIONS=--experimental-vm-modules` — see the pnpm script.
 *
 * @swc/jest, not ts-jest: TypeScript 7 ships no JS compiler API for ts-jest to call.
 * Type checking is `pnpm typecheck:test`'s job.
 *
 * @type {import('jest').Config}
 */
export default {
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  roots: ["<rootDir>/tests"],
  moduleFileExtensions: ["ts", "js", "json"],

  // Redis, Postgres and BullMQ all connect at module scope, so importing any
  // service opens sockets that keep Jest alive after the run. No test talks to
  // a real one; these stubs are the only implementations tests ever see.
  moduleNameMapper: {
    "^.*/config/redis\\.js$": "<rootDir>/tests/mocks/redis.ts",
    "^.*/config/prisma\\.js$": "<rootDir>/tests/mocks/prisma.ts",
    "^.*/queues/[^/]*\\.queue\\.js$": "<rootDir>/tests/mocks/queues.ts",
  },

  resolver: "<rootDir>/tests/resolver.cjs",

  transform: {
    "^.+\\.ts$": [
      "@swc/jest",
      {
        jsc: { parser: { syntax: "typescript" }, target: "es2022" },
        module: { type: "es6" },
      },
    ],
  },

  setupFiles: ["<rootDir>/tests/setup/env.ts"],

  clearMocks: true,
  restoreMocks: true,

  collectCoverageFrom: [
    "src/lib/**/*.ts",
    "src/middleware/**/*.ts",
    "src/modules/**/*.service.ts",
    "!src/generated/**",
  ],
};
