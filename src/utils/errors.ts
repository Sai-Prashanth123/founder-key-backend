import { StatusCodes } from 'http-status-codes';
import { ValidationErrorDetail } from '@appTypes/index';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public readonly errors: ValidationErrorDetail[];

  constructor(errors: ValidationErrorDetail[], message = 'Validation failed') {
    super(message, StatusCodes.UNPROCESSABLE_ENTITY);
    this.errors = errors;
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, StatusCodes.NOT_FOUND);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, StatusCodes.UNAUTHORIZED);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, StatusCodes.FORBIDDEN);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, StatusCodes.CONFLICT);
    this.name = 'ConflictError';
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(message, StatusCodes.BAD_REQUEST);
    this.name = 'BadRequestError';
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, StatusCodes.TOO_MANY_REQUESTS);
    this.name = 'TooManyRequestsError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service unavailable') {
    super(message, StatusCodes.SERVICE_UNAVAILABLE);
    this.name = 'ServiceUnavailableError';
  }
}
