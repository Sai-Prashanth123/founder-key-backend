import jwt from 'jsonwebtoken';
import { env } from '@config/env';
import { JwtPayload } from '@appTypes/index';
import { UnauthorizedError } from './errors';

export const signAccessToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    issuer: 'golden-tap-connect',
    audience: 'golden-tap-client',
  } as jwt.SignOptions);
};

export const signRefreshToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    issuer: 'golden-tap-connect',
    audience: 'golden-tap-client',
  } as jwt.SignOptions);
};

export const verifyAccessToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'golden-tap-connect',
      audience: 'golden-tap-client',
    }) as JwtPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Access token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Invalid access token');
    }
    throw new UnauthorizedError('Token verification failed');
  }
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
      issuer: 'golden-tap-connect',
      audience: 'golden-tap-client',
    }) as JwtPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Refresh token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Invalid refresh token');
    }
    throw new UnauthorizedError('Token verification failed');
  }
};

export const decodeToken = (token: string): JwtPayload | null => {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch {
    return null;
  }
};

export const getTokenExpiry = (expiresIn: string): Date => {
  const now = new Date();
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return now;

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's':
      now.setSeconds(now.getSeconds() + value);
      break;
    case 'm':
      now.setMinutes(now.getMinutes() + value);
      break;
    case 'h':
      now.setHours(now.getHours() + value);
      break;
    case 'd':
      now.setDate(now.getDate() + value);
      break;
  }
  return now;
};
