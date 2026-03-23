import prisma from '@config/database';
import { NotFoundError, ConflictError, BadRequestError } from '@utils/errors';
import { generateQRCode } from '@utils/qrcode';
import { SCORE_VALUES } from '@config/constants';
import { sendEmail, founderCardApprovedEmail } from '@utils/email';
import { parsePaginationQuery, buildPaginationMeta } from '@utils/pagination';
import gamificationService from '@modules/gamification/gamification.service';
import notificationsService from '@modules/notifications/notifications.service';
import { ApplyCardDto } from './founder-cards.validation';

export class FounderCardsService {
  async applyForCard(userId: string, dto: ApplyCardDto) {
    const existingCard = await prisma.founderCard.findUnique({ where: { userId } });

    if (existingCard) {
      if (existingCard.status === 'PENDING') {
        throw new ConflictError('You already have a pending Founder Card application');
      }
      if (existingCard.status === 'ACTIVE') {
        throw new ConflictError('You already have an active Founder Card');
      }
      if (existingCard.status === 'DEACTIVATED') {
        // Allow re-application for deactivated cards
        return prisma.founderCard.update({
          where: { userId },
          data: {
            status: 'PENDING',
            message: dto.message ?? null,
            reason: null,
            reviewedAt: null,
            reviewedBy: null,
          },
        });
      }
      // Rejected - allow re-application
      return prisma.founderCard.update({
        where: { userId },
        data: {
          status: 'PENDING',
          message: dto.message ?? null,
          reason: null,
          reviewedAt: null,
          reviewedBy: null,
        },
      });
    }

    const card = await prisma.founderCard.create({
      data: {
        userId,
        status: 'PENDING',
        message: dto.message ?? null,
      },
    });

    // Notify admins
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true, deletedAt: null },
      select: { id: true },
    });

    const adminIds = admins.map((a) => a.id);
    if (adminIds.length > 0) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true },
      });
      const name = user?.profile
        ? `${user.profile.firstName} ${user.profile.lastName}`
        : user?.email ?? 'A user';

      await notificationsService
        .sendBulkNotification(
          adminIds,
          'SYSTEM',
          'New Founder Card Application',
          `${name} has applied for a Founder Card`,
          { cardId: card.id, userId }
        )
        .catch(() => {});
    }

    return card;
  }

  async getMyCard(userId: string) {
    const card = await prisma.founderCard.findUnique({ where: { userId } });
    if (!card) throw new NotFoundError('Founder Card');
    return card;
  }

  async generateQR(userId: string) {
    const card = await prisma.founderCard.findUnique({ where: { userId } });
    if (!card) throw new NotFoundError('Founder Card');
    if (card.status !== 'ACTIVE') {
      throw new BadRequestError('Only active Founder Cards can generate QR codes');
    }

    const qrPayload = Buffer.from(
      JSON.stringify({
        userId,
        type: 'founder_card',
        timestamp: Date.now(),
      })
    ).toString('base64');

    const qrCode = await generateQRCode(qrPayload);

    const updatedCard = await prisma.founderCard.update({
      where: { userId },
      data: {
        qrCode,
        qrCodeUrl: qrCode, // In production, this would be an S3 URL
      },
    });

    return updatedCard;
  }

  async approveCard(cardId: string, adminId: string) {
    const card = await prisma.founderCard.findUnique({
      where: { id: cardId },
      include: {
        user: {
          include: { profile: true },
        },
      },
    });

    if (!card) throw new NotFoundError('Founder Card');
    if (card.status !== 'PENDING') {
      throw new BadRequestError('Only pending cards can be approved');
    }

    const qrPayload = Buffer.from(
      JSON.stringify({
        userId: card.userId,
        type: 'founder_card',
        timestamp: Date.now(),
      })
    ).toString('base64');

    const qrCode = await generateQRCode(qrPayload);

    const updatedCard = await prisma.founderCard.update({
      where: { id: cardId },
      data: {
        status: 'ACTIVE',
        qrCode,
        qrCodeUrl: qrCode,
        reviewedAt: new Date(),
        reviewedBy: adminId,
      },
    });

    // Update user tier to FOUNDER
    await prisma.user.update({
      where: { id: card.userId },
      data: { tier: 'FOUNDER' },
    });

    // Add FK score
    await gamificationService
      .addScore(card.userId, 'FOUNDER_CARD_ACTIVE', SCORE_VALUES.FOUNDER_CARD_ACTIVE, { cardId })
      .catch(() => {});

    // Send notification
    await notificationsService
      .createNotification(
        card.userId,
        'FOUNDER_CARD_APPROVED',
        'Founder Card Approved!',
        'Congratulations! Your Founder Card application has been approved.',
        { cardId }
      )
      .catch(() => {});

    // Send email
    if (card.user) {
      const name = card.user.profile
        ? `${card.user.profile.firstName} ${card.user.profile.lastName}`
        : card.user.email;

      sendEmail(
        card.user.email,
        'Your Founder Card is Approved! - Founder Key',
        founderCardApprovedEmail(name)
      ).catch(() => {});
    }

    return updatedCard;
  }

  async rejectCard(cardId: string, adminId: string, reason?: string) {
    const card = await prisma.founderCard.findUnique({
      where: { id: cardId },
      include: { user: true },
    });

    if (!card) throw new NotFoundError('Founder Card');
    if (card.status !== 'PENDING') {
      throw new BadRequestError('Only pending cards can be rejected');
    }

    const updatedCard = await prisma.founderCard.update({
      where: { id: cardId },
      data: {
        status: 'REJECTED',
        reason: reason ?? null,
        reviewedAt: new Date(),
        reviewedBy: adminId,
      },
    });

    // Notify user
    await notificationsService
      .createNotification(
        card.userId,
        'FOUNDER_CARD_REJECTED',
        'Founder Card Application Update',
        reason
          ? `Your Founder Card application was not approved: ${reason}`
          : 'Your Founder Card application was not approved at this time.',
        { cardId }
      )
      .catch(() => {});

    return updatedCard;
  }

  async deactivateCard(cardId: string, adminId: string) {
    const card = await prisma.founderCard.findUnique({ where: { id: cardId } });
    if (!card) throw new NotFoundError('Founder Card');
    if (card.status !== 'ACTIVE') {
      throw new BadRequestError('Only active cards can be deactivated');
    }

    return prisma.founderCard.update({
      where: { id: cardId },
      data: {
        status: 'DEACTIVATED',
        reviewedAt: new Date(),
        reviewedBy: adminId,
      },
    });
  }

  async reactivateCard(cardId: string, adminId: string) {
    const card = await prisma.founderCard.findUnique({ where: { id: cardId } });
    if (!card) throw new NotFoundError('Founder Card');
    if (card.status !== 'DEACTIVATED') {
      throw new BadRequestError('Only deactivated cards can be reactivated');
    }

    return prisma.founderCard.update({
      where: { id: cardId },
      data: {
        status: 'ACTIVE',
        reviewedAt: new Date(),
        reviewedBy: adminId,
      },
    });
  }

  async listPendingCards(page?: number, limit?: number) {
    const pagination = parsePaginationQuery({ page, limit });

    const [cards, total] = await Promise.all([
      prisma.founderCard.findMany({
        where: { status: 'PENDING' },
        include: {
          user: {
            include: {
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true,
                  company: true,
                  position: true,
                },
              },
            },
          },
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { appliedAt: 'asc' },
      }),
      prisma.founderCard.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      cards,
      pagination: buildPaginationMeta(total, pagination.page, pagination.limit),
    };
  }

  async getCardByQR(qrData: string) {
    let parsedData: { userId: string; type: string };

    try {
      parsedData = JSON.parse(Buffer.from(qrData, 'base64').toString('utf-8')) as {
        userId: string;
        type: string;
      };
    } catch {
      throw new BadRequestError('Invalid QR code data');
    }

    const { userId } = parsedData;

    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null, isActive: true },
      include: {
        profile: true,
        founderCard: {
          select: { id: true, status: true, appliedAt: true },
        },
        gamification: { select: { fkScore: true, level: true } },
      },
    });

    if (!user) throw new NotFoundError('User');
    if (user.founderCard?.status !== 'ACTIVE') {
      throw new BadRequestError('This QR code does not belong to an active Founder Card');
    }

    const { password: _pw, ...safeUser } = user;
    void _pw;
    return safeUser;
  }

  async getAllCards(page?: number, limit?: number) {
    const pagination = parsePaginationQuery({ page, limit });

    const [cards, total] = await Promise.all([
      prisma.founderCard.findMany({
        include: {
          user: {
            include: {
              profile: {
                select: { firstName: true, lastName: true, avatar: true, company: true },
              },
            },
          },
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { appliedAt: 'desc' },
      }),
      prisma.founderCard.count(),
    ]);

    return {
      cards,
      pagination: buildPaginationMeta(total, pagination.page, pagination.limit),
    };
  }
}

export default new FounderCardsService();
