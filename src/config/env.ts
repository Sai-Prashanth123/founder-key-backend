import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test', 'staging']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_VERSION: z.string().default('v1'),
  API_PREFIX: z.string().default('/api'),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Bcrypt
  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(20).default(12),

  // SMTP
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().email().default('noreply@goldentap.com'),
  SMTP_FROM_NAME: z.string().default('Golden Tap Connect'),

  // AWS S3
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_S3_BASE_URL: z.string().optional(),

  // CORS / Frontend
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
  LOG_DIR: z.string().default('logs'),

  // File Uploads
  UPLOAD_MAX_SIZE_MB: z.coerce.number().int().positive().default(5),
  UPLOAD_ALLOWED_TYPES: z
    .string()
    .default('image/jpeg,image/jpg,image/png,image/webp,image/gif'),

  // Bull Queues
  BULL_REDIS_URL: z.string().default('redis://localhost:6379'),

  // Supabase (for Google OAuth)
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  const errors = parseResult.error.errors
    .map((err) => `  ${err.path.join('.')}: ${err.message}`)
    .join('\n');
  throw new Error(`Environment validation failed:\n${errors}`);
}

export const env = parseResult.data;

export type Env = typeof env;
