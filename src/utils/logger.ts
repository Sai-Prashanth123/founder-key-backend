import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { env } from '@config/env';

const { combine, timestamp, errors, json, colorize, simple, printf } = winston.format;

const logDir = env.LOG_DIR || 'logs';

const consoleFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  const stackStr = stack ? `\n${stack}` : '';
  return `${String(ts)} [${level}]: ${String(message)}${metaStr}${stackStr}`;
});

const errorTransport = new DailyRotateFile({
  filename: path.join(logDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '30d',
  zippedArchive: true,
  format: combine(timestamp(), errors({ stack: true }), json()),
});

const combinedTransport = new DailyRotateFile({
  filename: path.join(logDir, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  zippedArchive: true,
  format: combine(timestamp(), errors({ stack: true }), json()),
});

const transports: winston.transport[] = [errorTransport, combinedTransport];

if (env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), simple(), consoleFormat),
    })
  );
} else {
  transports.push(
    new winston.transports.Console({
      format: combine(timestamp(), errors({ stack: true }), json()),
    })
  );
}

export const logger = winston.createLogger({
  level: env.LOG_LEVEL || 'info',
  format: combine(errors({ stack: true }), json()),
  defaultMeta: { service: 'golden-tap-backend' },
  transports,
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
    }),
  ],
  exitOnError: false,
});

export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

export default logger;
