import { defineConfig } from "prisma/config";
import "dotenv/config";

// Reads DATABASE_URL directly, not via src/config/env — that validator exits on any
// missing var, which would block `prisma generate` before the app is configured.
const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL is not set");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: { url },
});
