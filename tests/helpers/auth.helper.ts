import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export interface TestUser {
  id: string;
  email: string;
  password: string;
  role: 'ATTENDEE' | 'ORGANIZER' | 'ADMIN';
  accessToken: string;
}

export const createTestUser = async (
  role: 'ATTENDEE' | 'ORGANIZER' | 'ADMIN' = 'ATTENDEE',
  overrides: Partial<{
    email: string;
    firstName: string;
    lastName: string;
    isEmailVerified: boolean;
    isActive: boolean;
    company: string;
  }> = {}
): Promise<TestUser> => {
  const email = overrides.email ?? `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const rawPassword = 'Test@1234!';
  const hashedPassword = await bcrypt.hash(rawPassword, 4);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role,
      isEmailVerified: overrides.isEmailVerified ?? true,
      isActive: overrides.isActive ?? true,
      profile: {
        create: {
          firstName: overrides.firstName ?? 'Test',
          lastName: overrides.lastName ?? 'User',
          company: overrides.company ?? 'Test Company',
        },
      },
      gamification: {
        create: {
          fkScore: 0,
          level: 1,
        },
      },
    },
  });

  const accessToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      tier: user.tier,
    },
    process.env.JWT_ACCESS_SECRET ?? 'test-secret',
    { expiresIn: '1h' }
  );

  return {
    id: user.id,
    email: user.email,
    password: rawPassword,
    role: user.role as 'ATTENDEE' | 'ORGANIZER' | 'ADMIN',
    accessToken,
  };
};

export const getAuthToken = async (email: string, password: string): Promise<string> => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`User ${email} not found`);

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error('Invalid password');

  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      tier: user.tier,
    },
    process.env.JWT_ACCESS_SECRET ?? 'test-secret',
    { expiresIn: '1h' }
  );
};

export const cleanupUsers = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return;

  try {
    await prisma.user.deleteMany({
      where: { id: { in: ids } },
    });
  } catch (error) {
    console.error('Failed to cleanup test users:', error);
  }
};

export const cleanupAllTestUsers = async (): Promise<void> => {
  try {
    await prisma.user.deleteMany({
      where: { email: { contains: '@test.com' } },
    });
  } catch (error) {
    console.error('Failed to cleanup test users:', error);
  }
};

export { prisma as testPrisma };
