import { PrismaClient } from '@/prisma/generated/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

declare global {
  var __prisma__: PrismaClient | undefined;
}

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});
export const prisma = globalThis.__prisma__ ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma__ = prisma;
}
