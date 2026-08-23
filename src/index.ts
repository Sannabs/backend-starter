import app from "./app.js";
import { env } from "./config/env.js";
import {prisma} from './config/prisma.js'
import { logger } from './lib/logger.js'

async function main() {
  // prisma connection
  await prisma.$connect();
  logger.info("Database connected");

  app.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT}`, { env: env.NODE_ENV });
  });
}

main().catch((err: unknown) => {
  logger.error("Failed to start server", { err });
  process.exit(1);
});
