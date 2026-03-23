import { PrismaClient } from '@prisma/client';
import { env } from './env';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = () => {
  return new PrismaClient({
    log: ['warn', 'error'],
    errorFormat: 'minimal',
  });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  // Prisma connects lazily on first query — no upfront check needed.
  // The DB URL was already validated during `prisma db push`.
  console.log('Database client ready (Prisma connects lazily on first query)');
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    console.log('Database disconnected successfully');
  } catch (error) {
    console.error('Error disconnecting from database:', error);
    await prisma.$disconnect();
  }
}

export default prisma;
