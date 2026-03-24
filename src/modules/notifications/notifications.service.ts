import prisma from '@config/database';
import { NotFoundError, ForbiddenError } from '@utils/errors';
import { parsePaginationQuery, buildPaginationMeta } from '@utils/pagination';
import { NotificationType } from '@appTypes/index';
import { Prisma } from '@prisma/client';

// Lazy import to avoid circular dependency
let getSocketId: ((userId: string) => Promise<string | null>) | null = null;
let io: { to: (room: string) => { emit: (event: string, data: unknown) => void } } | null = null;

export const setSocketDependencies = (
  socketIo: typeof io,
  getSocketIdFn: typeof getSocketId
): void => {
  io = socketIo;
  getSocketId = getSocketIdFn;
};

export class NotificationsService {
  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, unknown>
  ) {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: data ? (data as Prisma.InputJsonValue) : undefined,
        isRead: false,
      },
    });

    // Emit via socket.io if user is online
    if (io) {
      const room = `user:${userId}`;
      io.to(room).emit('notification:new', {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      });
    }

    return notification;
  }

  async getNotifications(userId: string, page?: number, limit?: number) {
    const pagination = parsePaginationQuery({ page, limit });

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      notifications,
      unreadCount,
      pagination: buildPaginationMeta(total, pagination.page, pagination.limit),
    };
  }

  async getUnreadCount(userId: string): Promise<{ unreadCount: number }> {
    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { unreadCount };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) throw new NotFoundError('Notification');
    if (notification.userId !== userId) {
      throw new ForbiddenError('You do not have access to this notification');
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) throw new NotFoundError('Notification');
    if (notification.userId !== userId) {
      throw new ForbiddenError('You do not have access to this notification');
    }

    await prisma.notification.delete({ where: { id: notificationId } });
  }

  async sendBulkNotification(
    userIds: string[],
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    return this.createBulkNotifications(userIds, type, title, message, data);
  }

  async createBulkNotifications(
    userIds: string[],
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type,
        title,
        message,
        data: data ? (data as Prisma.InputJsonValue) : undefined,
        isRead: false,
      })),
    });

    // Emit to all online users
    if (io) {
      for (const userId of userIds) {
        io.to(`user:${userId}`).emit('notification:new', { type, title, message });
      }
    }
  }
}

export default new NotificationsService();

// Suppress unused import warning
void getSocketId;
