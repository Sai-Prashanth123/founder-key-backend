import cron from 'node-cron';
import prisma from '@config/database';
import redis from '@config/redis';
import { REDIS_KEYS, TOKEN_TTL } from '@config/constants';
import { sendEmail, eventReminderEmail } from '@utils/email';
import logger from '@utils/logger';

export const initScheduler = (): void => {
  // Clean expired tokens from Redis - every day at midnight
  cron.schedule('0 0 * * *', async () => {
    logger.info('Scheduler: Cleaning expired tokens...');
    try {
      // Redis TTL handles expiration automatically, but we clean DB refresh tokens
      const expiredTokens = await prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      logger.info(`Scheduler: Cleaned ${expiredTokens.count} expired DB refresh tokens`);
    } catch (error) {
      logger.error('Scheduler: Error cleaning expired tokens', { error });
    }
  });

  // Send event reminders - every hour
  cron.schedule('0 * * * *', async () => {
    logger.info('Scheduler: Checking for event reminders...');
    try {
      const tomorrow = new Date();
      tomorrow.setHours(tomorrow.getHours() + 24);

      const inTwentyFiveHours = new Date();
      inTwentyFiveHours.setHours(inTwentyFiveHours.getHours() + 25);

      const upcomingEvents = await prisma.event.findMany({
        where: {
          status: 'PUBLISHED',
          deletedAt: null,
          startDate: {
            gte: tomorrow,
            lte: inTwentyFiveHours,
          },
        },
        include: {
          registrations: {
            where: { status: { in: ['REGISTERED', 'WAITLISTED'] } },
            include: {
              user: {
                include: { profile: true },
              },
            },
          },
        },
      });

      for (const event of upcomingEvents) {
        for (const registration of event.registrations) {
          const user = registration.user;
          const name = user.profile
            ? `${user.profile.firstName} ${user.profile.lastName}`
            : user.email;

          const location =
            event.locationType === 'VIRTUAL'
              ? event.meetingUrl ?? 'Online'
              : `${event.address ?? ''}, ${event.city ?? ''}, ${event.country ?? ''}`.trim();

          await sendEmail(
            user.email,
            `Reminder: ${event.title} is tomorrow!`,
            eventReminderEmail(
              name,
              event.title,
              event.startDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
              location,
              `${process.env.FRONTEND_URL}/events/${event.id}`
            )
          ).catch((err: Error) =>
            logger.error('Scheduler: Failed to send event reminder', { error: err.message })
          );
        }
      }

      if (upcomingEvents.length > 0) {
        logger.info(`Scheduler: Sent reminders for ${upcomingEvents.length} events`);
      }
    } catch (error) {
      logger.error('Scheduler: Error sending event reminders', { error });
    }
  });

  // Weekly leaderboard recalculation - every Sunday at 2am
  cron.schedule('0 2 * * 0', async () => {
    logger.info('Scheduler: Recalculating leaderboard rankings...');
    try {
      // Rankings are computed on-the-fly based on fkScore, so this job
      // can do cleanup / notifications for top movers
      const topUsers = await prisma.gamification.findMany({
        take: 10,
        orderBy: { fkScore: 'desc' },
        include: {
          user: {
            include: {
              profile: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });

      logger.info('Scheduler: Leaderboard top 10 recalculated', {
        count: topUsers.length,
      });
    } catch (error) {
      logger.error('Scheduler: Error recalculating leaderboard', { error });
    }
  });

  // Daily analytics snapshot - every day at 1am
  cron.schedule('0 1 * * *', async () => {
    logger.info('Scheduler: Generating daily analytics snapshot...');
    try {
      const [totalUsers, totalEvents, totalConnections, activeFounderCards] = await Promise.all([
        prisma.user.count({ where: { deletedAt: null } }),
        prisma.event.count({ where: { deletedAt: null } }),
        prisma.connection.count({ where: { status: 'ACCEPTED' } }),
        prisma.founderCard.count({ where: { status: 'ACTIVE' } }),
      ]);

      const snapshot = {
        date: new Date().toISOString().split('T')[0],
        totalUsers,
        totalEvents,
        totalConnections,
        activeFounderCards,
      };

      // Store in Redis as a daily snapshot
      await redis.setex(
        `analytics:daily:${snapshot.date}`,
        7 * 24 * 60 * 60, // 7 days TTL
        JSON.stringify(snapshot)
      );

      logger.info('Scheduler: Daily analytics snapshot saved', snapshot);
    } catch (error) {
      logger.error('Scheduler: Error generating analytics snapshot', { error });
    }
  });

  // Mark completed events - every hour
  cron.schedule('30 * * * *', async () => {
    try {
      const updated = await prisma.event.updateMany({
        where: {
          status: 'PUBLISHED',
          endDate: { lt: new Date() },
          deletedAt: null,
        },
        data: { status: 'COMPLETED' },
      });

      if (updated.count > 0) {
        logger.info(`Scheduler: Marked ${updated.count} events as completed`);
      }
    } catch (error) {
      logger.error('Scheduler: Error marking events as completed', { error });
    }
  });

  void TOKEN_TTL; // suppress unused warning
  logger.info('Scheduler: All cron jobs initialized');
};
