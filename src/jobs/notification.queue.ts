import logger from '@utils/logger';
import { NotificationType } from '@appTypes/index';

export interface NotificationJobData {
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

const REDIS_URL = process.env.BULL_REDIS_URL ?? process.env.REDIS_URL;
const hasRedis = !!REDIS_URL && REDIS_URL !== 'redis://localhost:6379';

// ─── No-op queue stub ─────────────────────────────────────────────────────────
const noopQueue = {
  add: async (data: NotificationJobData) => {
    void processNotificationJob(data);
    return { id: 'inline', data } as unknown as import('bull').Job<NotificationJobData>;
  },
  close: async () => {},
  on: () => noopQueue,
};

let notificationQueueInstance = noopQueue as unknown as import('bull').Queue<NotificationJobData>;

if (hasRedis) {
  try {
    const Bull = require('bull');
    const queue = new Bull<NotificationJobData>('notifications', {
      redis: REDIS_URL,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    queue.process(async (job: import('bull').Job<NotificationJobData>) => {
      await processNotificationJob(job.data);
    });

    queue.on('failed', (job: import('bull').Job<NotificationJobData>, err: Error) => {
      logger.error('Notification job failed', { jobId: job.id, error: err.message });
    });

    notificationQueueInstance = queue;
    logger.info('Notification queue initialized with Redis');
  } catch (err) {
    logger.warn('Notification queue: failed to init Bull, using inline processing', { error: err });
  }
} else {
  logger.info('Notification queue: no Redis configured, notifications processed inline');
}

export const notificationQueue = notificationQueueInstance;

async function processNotificationJob(data: NotificationJobData): Promise<void> {
  const { default: notificationsService } = await import('@modules/notifications/notifications.service');
  await notificationsService.sendBulkNotification(
    data.userIds,
    data.type,
    data.title,
    data.message,
    data.data
  );
  logger.info('Bulk notification sent', { type: data.type, recipients: data.userIds.length });
}

export const addNotificationJob = async (data: NotificationJobData): Promise<void> => {
  await notificationQueue.add(data);
};

export default notificationQueue;
