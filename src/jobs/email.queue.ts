import logger from '@utils/logger';
import {
  sendEmail,
  welcomeEmail,
  verificationEmail,
  passwordResetEmail,
  connectionRequestEmail,
  founderCardApprovedEmail,
  eventReminderEmail,
} from '@utils/email';

export type EmailJobType =
  | 'welcome'
  | 'verification'
  | 'passwordReset'
  | 'connectionRequest'
  | 'founderCardApproved'
  | 'eventReminder';

export interface EmailJobData {
  type: EmailJobType;
  to: string;
  name: string;
  token?: string;
  url?: string;
  requesterName?: string;
  requesterCompany?: string;
  eventTitle?: string;
  eventDate?: string;
  eventLocation?: string;
  eventUrl?: string;
}

const REDIS_URL = process.env.BULL_REDIS_URL ?? process.env.REDIS_URL;
const hasRedis = !!REDIS_URL && REDIS_URL !== 'redis://localhost:6379';

// ─── No-op queue stub (used when Redis is not available) ──────────────────────
const noopQueue = {
  add: async (data: EmailJobData) => {
    // Process inline when no Redis queue available
    void processEmailJob(data);
    return { id: 'inline', data } as unknown as import('bull').Job<EmailJobData>;
  },
  close: async () => {},
  on: () => noopQueue,
};

// ─── Real Bull queue (used when Redis is available) ───────────────────────────
let emailQueueInstance = noopQueue as unknown as import('bull').Queue<EmailJobData>;

if (hasRedis) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Bull = require('bull') as any;
    const queue = new Bull('email', {
      redis: REDIS_URL,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    queue.process(async (job: import('bull').Job<EmailJobData>) => {
      await processEmailJob(job.data);
    });

    queue.on('failed', (job: import('bull').Job<EmailJobData>, err: Error) => {
      logger.error('Email job failed', { jobId: job.id, type: job.data.type, error: err.message });
    });

    emailQueueInstance = queue;
    logger.info('Email queue initialized with Redis');
  } catch (err) {
    logger.warn('Email queue: failed to init Bull, using inline processing', { error: err });
  }
} else {
  logger.info('Email queue: no Redis configured, emails will be sent inline');
}

export const emailQueue = emailQueueInstance;

// ─── Core email processing logic ──────────────────────────────────────────────
async function processEmailJob(data: EmailJobData): Promise<void> {
  let html = '';
  let subject = '';

  switch (data.type) {
    case 'welcome':
      html = welcomeEmail(data.name);
      subject = 'Welcome to Founder Key!';
      break;
    case 'verification':
      if (!data.token || !data.url) throw new Error('Token and URL required');
      html = verificationEmail(data.name, data.token, data.url);
      subject = 'Verify Your Email - Founder Key';
      break;
    case 'passwordReset':
      if (!data.token || !data.url) throw new Error('Token and URL required');
      html = passwordResetEmail(data.name, data.token, data.url);
      subject = 'Password Reset Request - Founder Key';
      break;
    case 'connectionRequest':
      html = connectionRequestEmail(data.name, data.requesterName ?? 'Someone', data.requesterCompany);
      subject = 'New Connection Request - Founder Key';
      break;
    case 'founderCardApproved':
      html = founderCardApprovedEmail(data.name);
      subject = 'Your Founder Card is Approved! - Founder Key';
      break;
    case 'eventReminder':
      if (!data.eventTitle || !data.eventDate || !data.eventLocation || !data.eventUrl) {
        throw new Error('Event details required');
      }
      html = eventReminderEmail(data.name, data.eventTitle, data.eventDate, data.eventLocation, data.eventUrl);
      subject = `Reminder: ${data.eventTitle} is tomorrow!`;
      break;
    default:
      throw new Error(`Unknown email type: ${String(data.type)}`);
  }

  await sendEmail(data.to, subject, html);
  logger.info('Email sent', { type: data.type, to: data.to });
}

export const addEmailJob = async (
  type: EmailJobType,
  data: Omit<EmailJobData, 'type'>
): Promise<void> => {
  await emailQueue.add({ type, ...data } as EmailJobData);
};

export default emailQueue;
