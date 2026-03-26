import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/golden_tap_test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-for-testing-min-32-chars';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-min-32-chars';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
// Must satisfy env schema (min 8). Keep it reasonably fast.
process.env.BCRYPT_ROUNDS = '8';
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_PORT = '1025';
process.env.SMTP_USER = 'test@test.com';
process.env.SMTP_PASS = 'test';
process.env.SMTP_FROM = 'test@goldentap.com';
process.env.SMTP_FROM_NAME = 'Test';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
process.env.LOG_LEVEL = 'error';
process.env.PORT = '3001';

// Mock email service to prevent actual emails in tests
jest.mock('../src/utils/email', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
  welcomeEmail: jest.fn().mockReturnValue('<p>Welcome</p>'),
  verificationEmail: jest.fn().mockReturnValue('<p>Verify</p>'),
  passwordResetEmail: jest.fn().mockReturnValue('<p>Reset</p>'),
  connectionRequestEmail: jest.fn().mockReturnValue('<p>Connection</p>'),
  founderCardApprovedEmail: jest.fn().mockReturnValue('<p>Approved</p>'),
  eventReminderEmail: jest.fn().mockReturnValue('<p>Reminder</p>'),
  default: {
    sendEmail: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock Redis
jest.mock('../src/config/redis', () => {
  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    keys: jest.fn().mockResolvedValue([]),
    quit: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    on: jest.fn(),
  };

  return {
    redis: mockRedis,
    subscriber: mockRedis,
    default: mockRedis,
    disconnectRedis: jest.fn().mockResolvedValue(undefined),
  };
});

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

export { prisma };

// Global cleanup
afterAll(async () => {
  await prisma.$disconnect();
});
