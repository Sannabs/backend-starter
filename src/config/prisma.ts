import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import {env} from './env.js'

const globalForPrisma = globalThis as unknown as {prisma: PrismaClient}

// withTenant holds a connection for a whole transaction, so in-flight
// transactions — not users — set the ceiling. pg defaults max to 10.
const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
})

export const prisma = globalForPrisma.prisma || new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
})

if(env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma
}