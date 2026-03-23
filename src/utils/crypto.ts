import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { env } from '@config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(env.BCRYPT_ROUNDS);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateToken = (bytes = 32): string => {
  return crypto.randomBytes(bytes).toString('hex');
};

export const generateOTP = (length = 6): string => {
  const digits = '0123456789';
  let otp = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    otp += digits[bytes[i] % digits.length];
  }
  return otp;
};

const deriveKey = (secret: string, salt: Buffer): Buffer => {
  return crypto.pbkdf2Sync(secret, salt, 100000, KEY_LENGTH, 'sha256');
};

export const encrypt = (text: string): string => {
  const secret = env.JWT_ACCESS_SECRET;
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(secret, salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
};

export const decrypt = (encryptedText: string): string => {
  const secret = env.JWT_ACCESS_SECRET;
  const buffer = Buffer.from(encryptedText, 'base64');

  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = deriveKey(secret, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encrypted) + decipher.final('utf8');
};

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const generateSecureId = (): string => {
  return crypto.randomUUID();
};

export const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return crypto.timingSafeEqual(aBuf, bBuf);
};
