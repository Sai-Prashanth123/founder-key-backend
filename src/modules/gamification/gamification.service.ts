import prisma from '@config/database';
import { NotFoundError } from '@utils/errors';
import { LEVEL_THRESHOLDS, SCORE_VALUES, BADGE_NAMES } from '@config/constants';
import { parsePaginationQuery, buildPaginationMeta } from '@utils/pagination';
import notificationsService from '@modules/notifications/notifications.service';

export class GamificationService {
  async getUserScore(userId: string) {
    const gamification = await prisma.gamification.findUnique({ where: { userId } });
    if (!gamification) {
      return { fkScore: 0, level: 1, levelLabel: 'Newcomer' };
    }

    const levelInfo = this.getLevelInfo(gamification.fkScore);
    return { ...gamification, levelLabel: levelInfo.label };
  }

  async addScore(
    userId: string,
    action: string,
    points: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const currentGamification = await prisma.gamification.findUnique({ where: { userId } });
    const currentScore = currentGamification?.fkScore ?? 0;
    const currentLevel = currentGamification?.level ?? 1;

    const newScore = currentScore + points;
    const newLevel = this.calculateLevel(newScore);

    await prisma.gamification.upsert({
      where: { userId },
      update: { fkScore: newScore, level: newLevel },
      create: { userId, fkScore: newScore, level: newLevel },
    });

    await prisma.scoreHistory.create({
      data: {
        userId,
        action,
        points,
        metadata: metadata ?? null,
      },
    });

    // Check for level up
    if (newLevel > currentLevel) {
      const levelInfo = this.getLevelInfo(newScore);
      await notificationsService
        .createNotification(
          userId,
          'LEVEL_UP',
          'Level Up!',
          `Congratulations! You've reached Level ${newLevel}: ${levelInfo.label}`,
          { newLevel, oldLevel: currentLevel }
        )
        .catch(() => {});
    }

    // Check badge conditions
    await this.checkAndAwardBadges(userId).catch(() => {});
  }

  async getLeaderboard(page?: number, limit?: number) {
    const pagination = parsePaginationQuery({ page, limit });

    const [users, total] = await Promise.all([
      prisma.gamification.findMany({
        include: {
          user: {
            include: {
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true,
                  company: true,
                },
              },
            },
          },
        },
        orderBy: { fkScore: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.gamification.count(),
    ]);

    const leaderboard = users.map((g, index) => ({
      rank: pagination.skip + index + 1,
      userId: g.userId,
      fkScore: g.fkScore,
      level: g.level,
      levelLabel: this.getLevelInfo(g.fkScore).label,
      user: g.user,
    }));

    return {
      leaderboard,
      pagination: buildPaginationMeta(total, pagination.page, pagination.limit),
    };
  }

  async getUserBadges(userId: string) {
    return prisma.userBadge.findMany({
      where: { userId },
      include: {
        badge: true,
      },
      orderBy: { earnedAt: 'desc' },
    });
  }

  async checkAndAwardBadges(userId: string): Promise<void> {
    const [connectionCount, eventCount, gamification, badgeCount, hasFounderCard] =
      await Promise.all([
        prisma.connection.count({
          where: {
            status: 'ACCEPTED',
            OR: [{ requesterId: userId }, { receiverId: userId }],
          },
        }),
        prisma.eventRegistration.count({
          where: { userId, status: { in: ['REGISTERED', 'ATTENDED'] } },
        }),
        prisma.gamification.findUnique({ where: { userId } }),
        prisma.userBadge.count({ where: { userId } }),
        prisma.founderCard.findUnique({ where: { userId, status: 'ACTIVE' } } as { where: { userId: string; status: 'ACTIVE' } }),
      ]);

    const earnedBadgeNames = await prisma.userBadge
      .findMany({
        where: { userId },
        include: { badge: { select: { name: true } } },
      })
      .then((badges) => new Set(badges.map((b) => b.badge.name)));

    const badgesToAward: string[] = [];

    if (connectionCount >= 1 && !earnedBadgeNames.has(BADGE_NAMES.FIRST_CONNECTION)) {
      badgesToAward.push(BADGE_NAMES.FIRST_CONNECTION);
    }
    if (connectionCount >= 10 && !earnedBadgeNames.has(BADGE_NAMES.NETWORK_STARTER)) {
      badgesToAward.push(BADGE_NAMES.NETWORK_STARTER);
    }
    if (connectionCount >= 50 && !earnedBadgeNames.has(BADGE_NAMES.SUPER_CONNECTOR)) {
      badgesToAward.push(BADGE_NAMES.SUPER_CONNECTOR);
    }
    if (eventCount >= 1 && !earnedBadgeNames.has(BADGE_NAMES.EVENT_GOER)) {
      badgesToAward.push(BADGE_NAMES.EVENT_GOER);
    }
    if (eventCount >= 5 && !earnedBadgeNames.has(BADGE_NAMES.EVENT_ENTHUSIAST)) {
      badgesToAward.push(BADGE_NAMES.EVENT_ENTHUSIAST);
    }
    if (hasFounderCard && !earnedBadgeNames.has(BADGE_NAMES.FOUNDER_BADGE)) {
      badgesToAward.push(BADGE_NAMES.FOUNDER_BADGE);
    }
    if (
      gamification &&
      gamification.fkScore >= 500 &&
      !earnedBadgeNames.has(BADGE_NAMES.COMMUNITY_PILLAR)
    ) {
      badgesToAward.push(BADGE_NAMES.COMMUNITY_PILLAR);
    }

    // Award new badges
    for (const badgeName of badgesToAward) {
      const badge = await prisma.badge.findUnique({ where: { name: badgeName } });
      if (!badge) continue;

      await prisma.userBadge.create({
        data: { userId, badgeId: badge.id },
      });

      await notificationsService
        .createNotification(
          userId,
          'BADGE_EARNED',
          'Badge Earned!',
          `You've earned the "${badge.name}" badge!`,
          { badgeId: badge.id, badgeName: badge.name }
        )
        .catch(() => {});

      // Add score for earning badge
      await this.addScore(userId, 'BADGE_EARNED', SCORE_VALUES.BADGE_EARNED, {
        badgeId: badge.id,
      }).catch(() => {});
    }

    void badgeCount; // suppress unused warning
  }

  calculateLevel(score: number): number {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (score >= LEVEL_THRESHOLDS[i].minScore) {
        return LEVEL_THRESHOLDS[i].level;
      }
    }
    return 1;
  }

  getLevelInfo(score: number): { level: number; label: string; minScore: number } {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (score >= LEVEL_THRESHOLDS[i].minScore) {
        return LEVEL_THRESHOLDS[i];
      }
    }
    return LEVEL_THRESHOLDS[0];
  }

  async getScoreHistory(userId: string, page?: number, limit?: number) {
    const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundError('User');

    const pagination = parsePaginationQuery({ page, limit });

    const [history, total] = await Promise.all([
      prisma.scoreHistory.findMany({
        where: { userId },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.scoreHistory.count({ where: { userId } }),
    ]);

    return {
      history,
      pagination: buildPaginationMeta(total, pagination.page, pagination.limit),
    };
  }

  async getAllBadges() {
    return prisma.badge.findMany({ orderBy: { name: 'asc' } });
  }
}

export default new GamificationService();
