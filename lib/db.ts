// Prisma client singleton + a soft-failure wrapper.
//
// The DB is a live, required dependency. `tryDb` returns null (instead of
// throwing) only when the database is unconfigured or momentarily unreachable,
// so a transient blip degrades to an honest EMPTY state — never to mock or
// fabricated data. Callers must treat null as "unavailable", not "substitute".

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export const dbConfigured = Boolean(process.env.DATABASE_URL);

/** Run a DB query; return null (not throw) when the DB is missing/unreachable. */
export async function tryDb<T>(fn: (db: PrismaClient) => Promise<T>): Promise<T | null> {
  if (!dbConfigured) return null;
  try {
    return await fn(prisma);
  } catch (error) {
    console.error("[db] query failed, falling back:", error instanceof Error ? error.message : error);
    return null;
  }
}
