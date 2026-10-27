# Tests

Scope: the logic that is expensive to get wrong in production — money, credentials,
owner scoping, and duplicate execution. Not coverage for its own sake.

Layout:

```
tests/
  setup/env.ts      env the config validator demands; runs before any import
  mocks/            redis, prisma and queue stand-ins, wired in jest.config.mjs
  unit/             pure functions, no mocks
  integration/      services and middleware with prisma/redis/queues mocked
```

`src/config/env.ts` calls `process.exit(1)` on a missing variable, so anything that
transitively imports it dies without `tests/setup/env.ts`. That file is wired in as
`setupFiles`, which runs before the module under test is loaded. A new variable in
`env.ts` gets a line there too.

No suite talks to a real Postgres or Redis. `moduleNameMapper` swaps
`config/redis`, `config/prisma` and every `queues/*.queue` for the files in `mocks/`.
The prisma mock throws on any query a test has not assigned, so an unmocked call
fails loudly instead of returning `undefined`.

Transform is `@swc/jest`, which strips types without checking them. Run
`pnpm typecheck:test` for that.

```
pnpm test
pnpm test:watch
pnpm typecheck:test
```
