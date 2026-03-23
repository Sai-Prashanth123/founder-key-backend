import prisma from '@config/database';
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from '@utils/errors';
import { parsePaginationQuery, buildPaginationMeta } from '@utils/pagination';
import { SCORE_VALUES } from '@config/constants';
import gamificationService from '@modules/gamification/gamification.service';
import notificationsService from '@modules/notifications/notifications.service';

export class ConnectionsService {
  async sendRequest(requesterId: string, receiverId: string) {
    if (requesterId === receiverId) {
      throw new BadRequestError('You cannot connect with yourself');
    }

    const receiver = await prisma.user.findFirst({
      where: { id: receiverId, deletedAt: null, isActive: true },
      include: { profile: true },
    });

    if (!receiver) throw new NotFoundError('User');

    const existing = await prisma.connection.findFirst({
      where: {
        OR: [
          { requesterId, receiverId },
          { requesterId: receiverId, receiverId: requesterId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        throw new ConflictError('You are already connected with this user');
      }
      if (existing.status === 'PENDING') {
        throw new ConflictError('A connection request already exists');
      }
      if (existing.status === 'REJECTED') {
        // Allow re-sending after rejection
        return prisma.connection.update({
          where: { id: existing.id },
          data: { status: 'PENDING', requesterId, receiverId },
        });
      }
    }

    const connection = await prisma.connection.create({
      data: { requesterId, receiverId, status: 'PENDING' },
    });

    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      include: { profile: true },
    });

    const requesterName = requester?.profile
      ? `${requester.profile.firstName} ${requester.profile.lastName}`
      : 'Someone';

    // Notify receiver
    await notificationsService
      .createNotification(
        receiverId,
        'CONNECTION_REQUEST',
        'New Connection Request',
        `${requesterName} wants to connect with you`,
        { connectionId: connection.id, requesterId }
      )
      .catch(() => {});

    return connection;
  }

  async respondToRequest(connectionId: string, userId: string, action: 'ACCEPT' | 'REJECT') {
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) throw new NotFoundError('Connection request');
    if (connection.receiverId !== userId) {
      throw new ForbiddenError('You can only respond to requests sent to you');
    }
    if (connection.status !== 'PENDING') {
      throw new BadRequestError('This connection request has already been responded to');
    }

    const newStatus = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';

    const updated = await prisma.connection.update({
      where: { id: connectionId },
      data: { status: newStatus },
    });

    if (action === 'ACCEPT') {
      // Add FK score to both users
      await Promise.all([
        gamificationService
          .addScore(userId, 'CONNECTION_MADE', SCORE_VALUES.CONNECTION_MADE, { connectionId })
          .catch(() => {}),
        gamificationService
          .addScore(
            connection.requesterId,
            'CONNECTION_MADE',
            SCORE_VALUES.CONNECTION_MADE,
            { connectionId }
          )
          .catch(() => {}),
      ]);

      // Notify requester
      const receiver = await prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true },
      });

      const receiverName = receiver?.profile
        ? `${receiver.profile.firstName} ${receiver.profile.lastName}`
        : 'Someone';

      await notificationsService
        .createNotification(
          connection.requesterId,
          'CONNECTION_ACCEPTED',
          'Connection Accepted',
          `${receiverName} accepted your connection request`,
          { connectionId, userId }
        )
        .catch(() => {});
    }

    return updated;
  }

  async removeConnection(connectionId: string, userId: string): Promise<void> {
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) throw new NotFoundError('Connection');
    if (connection.requesterId !== userId && connection.receiverId !== userId) {
      throw new ForbiddenError('You do not have permission to remove this connection');
    }

    await prisma.connection.delete({ where: { id: connectionId } });
  }

  async getConnections(userId: string, page?: number, limit?: number) {
    const pagination = parsePaginationQuery({ page, limit });

    const where = {
      status: 'ACCEPTED' as const,
      OR: [{ requesterId: userId }, { receiverId: userId }],
    };

    const [connections, total] = await Promise.all([
      prisma.connection.findMany({
        where,
        include: {
          requester: {
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
              gamification: { select: { fkScore: true, level: true } },
            },
          },
          receiver: {
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
              gamification: { select: { fkScore: true, level: true } },
            },
          },
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.connection.count({ where }),
    ]);

    // Return the "other" user from the perspective of the current user
    const connectionsList = connections.map((c) => {
      const otherUser = c.requesterId === userId ? c.receiver : c.requester;
      return {
        id: c.id,
        status: c.status,
        createdAt: c.createdAt,
        user: otherUser,
      };
    });

    return {
      connections: connectionsList,
      pagination: buildPaginationMeta(total, pagination.page, pagination.limit),
    };
  }

  async getPendingRequests(userId: string, page?: number, limit?: number) {
    const pagination = parsePaginationQuery({ page, limit });

    const [requests, total] = await Promise.all([
      prisma.connection.findMany({
        where: { receiverId: userId, status: 'PENDING' },
        include: {
          requester: {
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
        orderBy: { createdAt: 'desc' },
      }),
      prisma.connection.count({ where: { receiverId: userId, status: 'PENDING' } }),
    ]);

    return {
      requests,
      pagination: buildPaginationMeta(total, pagination.page, pagination.limit),
    };
  }

  async getSentRequests(userId: string, page?: number, limit?: number) {
    const pagination = parsePaginationQuery({ page, limit });

    const [requests, total] = await Promise.all([
      prisma.connection.findMany({
        where: { requesterId: userId, status: 'PENDING' },
        include: {
          receiver: {
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
        orderBy: { createdAt: 'desc' },
      }),
      prisma.connection.count({ where: { requesterId: userId, status: 'PENDING' } }),
    ]);

    return {
      requests,
      pagination: buildPaginationMeta(total, pagination.page, pagination.limit),
    };
  }

  async checkConnectionStatus(userId: string, targetId: string) {
    const connection = await prisma.connection.findFirst({
      where: {
        OR: [
          { requesterId: userId, receiverId: targetId },
          { requesterId: targetId, receiverId: userId },
        ],
      },
    });

    return {
      status: connection?.status ?? null,
      connectionId: connection?.id ?? null,
      isRequester: connection?.requesterId === userId,
    };
  }

  async connectViaQR(scannerId: string, qrData: string) {
    let parsedData: { userId: string; type: string };

    try {
      parsedData = JSON.parse(Buffer.from(qrData, 'base64').toString('utf-8')) as {
        userId: string;
        type: string;
      };
    } catch {
      throw new BadRequestError('Invalid QR code data');
    }

    const cardOwnerId = parsedData.userId;

    if (!cardOwnerId) {
      throw new BadRequestError('Invalid QR code: missing user ID');
    }

    if (scannerId === cardOwnerId) {
      throw new BadRequestError('You cannot connect with yourself via QR');
    }

    // Add FK score for QR scan
    await gamificationService
      .addScore(scannerId, 'QR_SCAN', SCORE_VALUES.QR_SCAN, { targetUserId: cardOwnerId })
      .catch(() => {});

    // Check if connection already exists
    const existing = await prisma.connection.findFirst({
      where: {
        OR: [
          { requesterId: scannerId, receiverId: cardOwnerId },
          { requesterId: cardOwnerId, receiverId: scannerId },
        ],
      },
    });

    if (existing?.status === 'ACCEPTED') {
      return { connection: existing, message: 'Already connected', isNew: false };
    }

    // Create or update to accepted
    let connection;
    if (existing) {
      connection = await prisma.connection.update({
        where: { id: existing.id },
        data: { status: 'ACCEPTED' },
      });
    } else {
      connection = await prisma.connection.create({
        data: { requesterId: scannerId, receiverId: cardOwnerId, status: 'ACCEPTED' },
      });
    }

    // Add scores to both
    await Promise.all([
      gamificationService
        .addScore(scannerId, 'CONNECTION_MADE', SCORE_VALUES.CONNECTION_MADE)
        .catch(() => {}),
      gamificationService
        .addScore(cardOwnerId, 'CONNECTION_MADE', SCORE_VALUES.CONNECTION_MADE)
        .catch(() => {}),
    ]);

    return { connection, message: 'Connected successfully via QR', isNew: true };
  }

  async suggestConnections(userId: string, limit = 10) {
    const userProfile = await prisma.profile.findUnique({ where: { userId } });
    const userConnections = await prisma.connection.findMany({
      where: {
        OR: [{ requesterId: userId }, { receiverId: userId }],
      },
      select: { requesterId: true, receiverId: true },
    });

    const connectedIds = new Set<string>([userId]);
    for (const c of userConnections) {
      connectedIds.add(c.requesterId);
      connectedIds.add(c.receiverId);
    }

    const suggestions = await prisma.user.findMany({
      where: {
        id: { notIn: Array.from(connectedIds) },
        deletedAt: null,
        isActive: true,
        ...(userProfile?.skills?.length
          ? { profile: { skills: { hasSome: userProfile.skills } } }
          : {}),
      },
      include: {
        profile: {
          select: {
            firstName: true,
            lastName: true,
            avatar: true,
            company: true,
            position: true,
            skills: true,
          },
        },
        gamification: { select: { fkScore: true, level: true } },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return suggestions;
  }
}

export default new ConnectionsService();
