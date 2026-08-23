# Backend Starter

Express 5 · Prisma 7 · better-auth · Postgres · BullMQ — ESM TypeScript, no build-time magic.

A working backend skeleton: auth, transactional email, R2 uploads, background jobs, and a layered module pattern already wired together. Clone it, fill in `.env`, start writing domain modules.

---

## Quickstart

```bash
pnpm install
cp .env.example .env            # fill in the blanks
pnpm exec prisma migrate dev    # applies migrations, generates the client
pnpm dev
```

Postgres and Redis need to be running. `pnpm exec prisma dev` starts a local Postgres if you don't have one; `brew services start redis` for Redis.

Workers run as a **separate process**: `pnpm dev:worker` in a second terminal.

---

## Scripts

| Command | Does |
|---|---|
| `pnpm dev` | API with hot reload (`tsx watch`) |
| `pnpm dev:worker` | Job workers with hot reload |
| `pnpm build` | `tsc` → `dist/` |
| `pnpm start` | Run the built API |
| `pnpm start:worker` | Run the built workers |
| `pnpm typecheck` | `tsc --noEmit` |

---

## Layout

```
src/
  config/       env · prisma · redis · queueRedis · storage · resend
  lib/          auth · error · logger · pagination
  middleware/   error · requestLogger · validate · upload
  modules/      <domain>/ route · controller · service · schema
  queues/       BullMQ queue definitions and job payload types
  workers/      job processors
  views/email/  transactional templates
  index.ts      API entrypoint
  worker.ts     worker entrypoint
```

### Layer rules

- **Routes** wire method, path, middleware, controller. No logic.
- **Controllers** parse `req`, call exactly one service, return JSON, `next(err)` on throw. No Prisma.
- **Services** own business logic and Prisma. Take plain objects, never `req`/`res`. Always `select`.
- **Workers** are transport, exactly like controllers — parse job data, call one service. No Prisma.

`src/modules/auth/` is an empty four-file skeleton showing the shape. Copy the folder per domain.

### Import direction

```
services → queues ← workers
```

Services import queues to enqueue. Workers import services to process. **A service must never import from `workers/`** — those files call `new Worker(...)` at module scope, so importing one from the API spawns a live worker inside your web process.

---

## What's included

**Auth** — better-auth mounted at `/api/auth/*` in `app.ts`, with the Prisma adapter. `pnpm dlx @better-auth/cli@latest generate` regenerates the schema models.

**Errors** — `AppError` plus `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `ValidationError` in `lib/error.ts`. `error.middleware.ts` maps them to `{ success, code, message }` and translates Prisma's known error codes.

**Validation** — `validateBody(schema)` from `middleware/validate.middleware.ts`, zod v4.

**Uploads** — `upload.middleware.ts` exports `uploadSingleImage`, `uploadDocumentsMany`, `uploadSingleCsv`. Memory storage, MIME allowlists, multer errors mapped to `ValidationError` rather than 500s. `config/storage.ts` handles R2 (S3 API) with presigned downloads.

**Email** — `views/email/` renders HTML + text from a shared layout. `sendEmail` throws on Resend's `{ error }` result rather than silently dropping mail.

**Pagination** — `getPagination(query)` caps limit at 100, `paginated(data, total, p)` shapes the response.

**Jobs** — `queues/email.queue.ts` and `workers/email.worker.ts`, 3 attempts with exponential backoff. `worker.ts` drains in-flight jobs on SIGTERM.

---

## Notes

**pnpm settings live in `pnpm-workspace.yaml`**, not `package.json` — pnpm 11 stopped reading the `pnpm` field. Two things are set there:

- `allowBuilds` — pnpm 10+ blocks postinstall scripts by default; prisma and esbuild need theirs to run or you get a client-less install.
- `networkConcurrency: 3` and a raised `fetchTimeout` — the defaults time out on large tarballs over slow connections.

**Prisma generates into `src/generated/`**, which is gitignored. Run `prisma generate` after cloning or nothing typechecks.

**`prisma.config.ts` reads `DATABASE_URL` directly**, not through `config/env.ts` — that validator exits on any missing variable, which would block `prisma generate` before the app is configured.

**Redis has two clients.** `config/redis.ts` fails fast (`maxRetriesPerRequest: 1`, no offline queue) so app-level cache reads never stall a request. BullMQ requires the opposite and gets its own factory in `config/queueRedis.ts`.

**`config/env.ts` validates everything with zod and exits on boot** if a variable is missing or malformed. Add new variables there, not just to `.env`.

---

## Environment

| Variable | Notes |
|---|---|
| `PORT` | Defaults to 3000 |
| `NODE_ENV` | `development` · `test` · `production` |
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Used by both the cache and BullMQ clients |
| `BETTER_AUTH_SECRET` | Signs session cookies — 32+ chars |
| `BETTER_AUTH_URL` | This server's public URL |
| `CLIENT_URL` | CORS origin |
| `RESEND_API_KEY` | Must start with `re_` |
| `RESEND_FROM_EMAIL` | Bare address or `Name <address@domain>` |
| `R2_*` | Cloudflare R2 account, keys, bucket, public URL |
