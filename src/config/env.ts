import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

// Accepts a bare address or the display-name form Resend prefers,
// `Sender Name <address@domain>`, which z.email() alone rejects.
const senderAddress = z
  .string()
  .refine(
    (value) =>
      z.email().safeParse(value.match(/^.*<(.+)>$/)?.[1] ?? value).success,
    'must be an email address, optionally as "Name <address@domain>"',
  );

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),

  RESEND_FROM_EMAIL: senderAddress,
  RESEND_API_KEY: z.string().startsWith("re_"),
  REDIS_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.url(),
  CLIENT_URL: z.url(),

  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_PUBLIC_URL: z.url(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("[Env] Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
