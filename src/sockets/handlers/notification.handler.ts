import { Socket } from 'socket.io';
import prisma from '@config/database';
import logger from '@utils/logger';

export const notificationHandler = (socket: Socket, userId: string): void => {
  // Mark a notification as read via socket
  socket.on('notification:read', async (data: { notificationId: string }) => {
    try {
      const notification = await prisma.notification.findFirst({
        where: { id: data.notificationId, userId },
      });

      if (!notification) {
        socket.emit('notification:error', { message: 'Notification not found' });
        return;
      }

      await prisma.notification.update({
        where: { id: data.notificationId },
        data: { isRead: true },
      });

      // Get updated unread count
      const unreadCount = await prisma.notification.count({
        where: { userId, isRead: false },
      });

      socket.emit('notification:readConfirmed', {
        notificationId: data.notificationId,
        unreadCount,
      });
    } catch (error) {
      logger.error('Socket notification:read error', { userId, error });
      socket.emit('notification:error', { message: 'Failed to mark notification as read' });
    }
  });

  // Mark all notifications as read via socket
  socket.on('notification:readAll', async () => {
    try {
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });

      socket.emit('notification:allReadConfirmed', { userId, unreadCount: 0 });
    } catch (error) {
      logger.error('Socket notification:readAll error', { userId, error });
      socket.emit('notification:error', { message: 'Failed to mark all notifications as read' });
    }
  });

  // Get unread count on connect
  socket.on('notification:getUnreadCount', async () => {
    try {
      const count = await prisma.notification.count({
        where: { userId, isRead: false },
      });

      socket.emit('notification:unreadCount', { count });
    } catch (error) {
      logger.error('Socket notification:getUnreadCount error', { userId, error });
    }
  });

  // Auto-send unread count on connection
  prisma.notification
    .count({ where: { userId, isRead: false } })
    .then((count) => {
      socket.emit('notification:unreadCount', { count });
    })
    .catch(() => {});
};
