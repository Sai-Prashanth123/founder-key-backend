import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '@utils/jwt';
import { UnauthorizedError } from '@utils/errors';

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && typeof req.cookies === 'object' && 'accessToken' in req.cookies) {
    token = req.cookies.accessToken as string;
  }

  if (!token) {
    throw new UnauthorizedError('Authentication token is required');
  }

  const decoded = verifyAccessToken(token);
  req.user = decoded;
  next();
};

export const optionalAuthenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && typeof req.cookies === 'object' && 'accessToken' in req.cookies) {
    token = req.cookies.accessToken as string;
  }

  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      req.user = decoded;
    } catch {
      // Optional auth - silently ignore errors
    }
  }

  next();
};
