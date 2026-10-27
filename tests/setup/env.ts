/**
 * `config/env.ts` calls process.exit(1) on a missing variable, so these have to
 * be in place before anything imports it. Registered as `setupFiles`, which runs
 * before the module under test is loaded.
 *
 * dotenv does not overwrite variables that are already set, so every variable the
 * schema knows about is listed here — one that is missing would be filled from the
 * developer's real .env instead, and the suite would pass on their machine only.
 */
const TEST_ENV: Record<string, string> = {
  NODE_ENV: "test",
  PORT: "0",
  DATABASE_URL: "postgresql://app:app@localhost:5432/app_test",
  REDIS_URL: "redis://localhost:6379/1",

  RESEND_FROM_EMAIL: "App <no-reply@app.test>",
  RESEND_API_KEY: "re_test_key",

  BETTER_AUTH_SECRET: "test-better-auth-secret",
  BETTER_AUTH_URL: "http://localhost:3000",
  CLIENT_URL: "http://localhost:8081",
  COOKIE_DOMAIN: "",

  R2_ACCOUNT_ID: "test-account",
  R2_ACCESS_KEY_ID: "test-access-key",
  R2_SECRET_ACCESS_KEY: "test-secret-key",
  R2_BUCKET_NAME: "app-test",
  R2_PUBLIC_URL: "https://cdn.app.test",
};

for (const [name, value] of Object.entries(TEST_ENV)) {
  process.env[name] = value;
}
