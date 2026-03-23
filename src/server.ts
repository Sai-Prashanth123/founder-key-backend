import 'dotenv/config';
import http from 'http';
import app from './app';
import { env } from '@config/env';
import { connectDatabase, disconnectDatabase } from '@config/database';
import { disconnectRedis } from '@config/redis';
import { initSocketServer } from '@sockets/index';
import { initScheduler } from '@jobs/scheduler';
import emailQueue from '@jobs/email.queue';
import notificationQueue from '@jobs/notification.queue';
import logger from '@utils/logger';

const PORT = env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = initSocketServer(server);

let isShuttingDown = false;

const startServer = async (): Promise<void> => {
  try {
    // Connect to database
    await connectDatabase();
    logger.info('Database connection established');

    // Start HTTP server
    server.listen(PORT, () => {
      logger.info(`Server running in ${env.NODE_ENV} mode`, {
        port: PORT,
        environment: env.NODE_ENV,
        apiBase: `/api/${env.API_VERSION}`,
        docs: `/api/docs`,
        pid: process.pid,
      });
    });

    // Initialize scheduled jobs
    if (env.NODE_ENV !== 'test') {
      initScheduler();
      logger.info('Scheduler initialized');
    }

    logger.info('Golden Tap Connect backend started successfully');
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
const gracefulShutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Disconnect Socket.io
      io.close(() => {
        logger.info('Socket.io server closed');
      });

      // Close Bull queues
      await Promise.allSettled([
        emailQueue.close(),
        notificationQueue.close(),
      ]);
      logger.info('Bull queues closed');

      // Disconnect from database
      await disconnectDatabase();
      logger.info('Database disconnected');

      // Disconnect from Redis
      await disconnectRedis();
      logger.info('Redis disconnected');

      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', { error });
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

// Handle unhandled rejections
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Promise Rejection', { reason });
  if (env.NODE_ENV === 'production') {
    void gracefulShutdown('unhandledRejection');
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  void gracefulShutdown('uncaughtException');
});

void startServer();

export { server, io };
