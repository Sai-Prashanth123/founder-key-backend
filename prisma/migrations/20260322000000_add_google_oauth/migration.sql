-- Migration: Add Google OAuth fields to users table
-- Adds googleId, authProvider fields and makes password optional

-- Make password nullable (OAuth users have no password)
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

-- Add Google OAuth fields
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "authProvider" TEXT NOT NULL DEFAULT 'email';

-- Add unique index on googleId
CREATE UNIQUE INDEX IF NOT EXISTS "users_googleId_key" ON "users"("googleId");

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS "users_googleId_idx" ON "users"("googleId");
