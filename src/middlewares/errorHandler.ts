import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from '@utils/errors';
import logger from '@utils/logger';
import { env } from '@config/env';

interface ErrorResponse {
  success: false;
  message: string;
  errors?: Array<{ field: string; message: string }>;
  stack?: string;
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  let message = 'An unexpected error occurred';
  let errors: Array<{ field: string; message: string }> | undefined;

  // Log the error
  if (err instanceof AppError && err.isOperational) {
    logger.warn('Operational error', {
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.error('Unexpected error', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  // Handle custom AppError classes
  if (err instanceof ValidationError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  } else if (err instanceof NotFoundError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof UnauthorizedError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof ForbiddenError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof ConflictError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  }
  // Handle Prisma errors
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = StatusCodes.CONFLICT;
      const fields = (err.meta?.target as string[])?.join(', ') ?? 'field';
      message = `A record with this ${fields} already exists`;
    } else if (err.code === 'P2025') {
      statusCode = StatusCodes.NOT_FOUND;
      message = 'Record not found';
    } else if (err.code === 'P2003') {
      statusCode = StatusCodes.BAD_REQUEST;
      message = 'Related record not found';
    } else if (err.code === 'P2014') {
      statusCode = StatusCodes.BAD_REQUEST;
      message = 'Invalid relation data';
    } else {
      statusCode = StatusCodes.BAD_REQUEST;
      message = 'Database operation failed';
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'Invalid data provided';
  } else if (err instanceof Prisma.PrismaClientInitializationError) {
    statusCode = StatusCodes.SERVICE_UNAVAILABLE;
    message = 'Database connection failed';
  }
  // Handle JWT errors
  else if (err instanceof TokenExpiredError) {
    statusCode = StatusCodes.UNAUTHORIZED;
    message = 'Token has expired';
  } else if (err instanceof JsonWebTokenError) {
    statusCode = StatusCodes.UNAUTHORIZED;
    message = 'Invalid token';
  }
  // Handle Zod validation errors
  else if (err instanceof ZodError) {
    statusCode = StatusCodes.UNPROCESSABLE_ENTITY;
    message = 'Validation failed';
    errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  }
  // Handle Multer errors
  else if (err instanceof MulterError) {
    statusCode = StatusCodes.BAD_REQUEST;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File is too large';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files uploaded';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field';
    } else {
      message = `File upload error: ${err.message}`;
    }
  }
  // Handle SyntaxError (malformed JSON)
  else if (err instanceof SyntaxError && 'body' in err) {
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'Invalid JSON in request body';
  }

  const response: ErrorResponse = {
    success: false,
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  if (env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
};
