import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Neon's free tier suspends the database after inactivity; the first query while
 * it wakes can fail with a connection error. Retry those transient failures so a
 * sleeping DB transparently wakes instead of surfacing an error to the user.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  tries = 4,
  baseDelayMs = 700
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const transient =
        /can't reach database|P1001|P1002|ECONNREFUSED|ETIMEDOUT|Connection terminated|server has closed/i.test(
          msg
        );
      if (!transient) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
    }
  }
  throw lastErr;
}
