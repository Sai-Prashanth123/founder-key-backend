import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@appTypes/index';
import { ForbiddenError, UnauthorizedError } from '@utils/errors';

export const authorize = (...roles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError(
        `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`
      );
    }

    next();
  };
};

export const authorizeOwnerOrAdmin = (getUserId: (req: Request) => string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const resourceUserId = getUserId(req);

    if (req.user.role !== 'ADMIN' && req.user.userId !== resourceUserId) {
      throw new ForbiddenError('You do not have permission to access this resource');
    }

    next();
  };
};
