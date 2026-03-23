import rateLimit from 'express-rate-limit';
import { StatusCodes } from 'http-status-codes';
import { env } from '@config/env';

export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  statusCode: StatusCodes.TOO_MANY_REQUESTS,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    return req.ip ?? req.socket.remoteAddress ?? 'unknown';
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again in 15 minutes.',
  },
  statusCode: StatusCodes.TOO_MANY_REQUESTS,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    return req.ip ?? req.socket.remoteAddress ?? 'unknown';
  },
});

export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests for this action, please try again in 15 minutes.',
  },
  statusCode: StatusCodes.TOO_MANY_REQUESTS,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    return req.ip ?? req.socket.remoteAddress ?? 'unknown';
  },
});
