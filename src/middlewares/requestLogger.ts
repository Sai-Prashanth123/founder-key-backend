import morgan from 'morgan';
import { Request } from 'express';
import { env } from '@config/env';
import { stream } from '@utils/logger';

const format = env.NODE_ENV === 'production' ? 'combined' : 'dev';

export const requestLogger = morgan(format, { stream });

export const skipHealthCheck = morgan(
  env.NODE_ENV === 'production' ? 'combined' : 'dev',
  {
    stream,
    skip: (req: Request) => req.path === '/health' || req.path === '/api/health',
  }
);

export default requestLogger;
