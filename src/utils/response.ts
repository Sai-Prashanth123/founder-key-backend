import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { PaginationMeta, ValidationErrorDetail } from '@appTypes/index';

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode: number = StatusCodes.OK
): Response => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const sendCreated = <T>(res: Response, data: T, message = 'Created successfully'): Response => {
  return sendSuccess(res, data, message, StatusCodes.CREATED);
};

export const sendPaginated = <T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
  message = 'Success',
  statusCode: number = StatusCodes.OK
): Response => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    pagination,
  });
};

export const sendError = (
  res: Response,
  message: string,
  statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
  errors?: ValidationErrorDetail[]
): Response => {
  const body: Record<string, unknown> = {
    success: false,
    message,
  };

  if (errors && errors.length > 0) {
    body.errors = errors;
  }

  return res.status(statusCode).json(body);
};

export const sendNoContent = (res: Response): Response => {
  return res.status(StatusCodes.NO_CONTENT).send();
};

export const sendUnauthorized = (res: Response, message = 'Unauthorized'): Response => {
  return sendError(res, message, StatusCodes.UNAUTHORIZED);
};

export const sendForbidden = (res: Response, message = 'Forbidden'): Response => {
  return sendError(res, message, StatusCodes.FORBIDDEN);
};

export const sendNotFound = (res: Response, message = 'Not found'): Response => {
  return sendError(res, message, StatusCodes.NOT_FOUND);
};

export const sendBadRequest = (
  res: Response,
  message: string,
  errors?: ValidationErrorDetail[]
): Response => {
  return sendError(res, message, StatusCodes.BAD_REQUEST, errors);
};
