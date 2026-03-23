import { Socket } from 'socket.io';
import prisma from '@config/database';
import logger from '@utils/logger';
import { io } from '../index';

export const connectionHandler = (socket: Socket, userId: string): void => {
  // User is typing a connection request message (future feature)
  socket.on('connection:typing', (data: { targetUserId: string }) => {
    const targetRoom = `user:${data.targetUserId}`;
    socket.to(targetRoom).emit('connection:typing', { fromUserId: userId });
  });

  // Real-time notification when a connection request is sent
  socket.on('connection:requestSent', async (data: { receiverId: string }) => {
    try {
      const connection = await prisma.connection.findFirst({
        where: {
          requesterId: userId,
          receiverId: data.receiverId,
          status: 'PENDING',
        },
        include: {
          requester: {
            include: {
              profile: {
                select: { firstName: true, lastName: true, avatar: true },
              },
            },
          },
        },
      });

      if (!connection) return;

      // Notify receiver in real-time
      io.to(`user:${data.receiverId}`).emit('connection:newRequest', {
        connectionId: connection.id,
        requester: {
          id: userId,
          profile: connection.requester.profile,
        },
      });
    } catch (error) {
      logger.error('Socket connection:requestSent error', { userId, error });
    }
  });

  // Real-time notification when a connection is accepted
  socket.on('connection:accepted', async (data: { connectionId: string; requesterId: string }) => {
    try {
      const connection = await prisma.connection.findFirst({
        where: { id: data.connectionId, receiverId: userId, status: 'ACCEPTED' },
        include: {
          receiver: {
            include: {
              profile: {
                select: { firstName: true, lastName: true, avatar: true },
              },
            },
          },
        },
      });

      if (!connection) return;

      // Notify requester that their request was accepted
      io.to(`user:${data.requesterId}`).emit('connection:acceptedNotification', {
        connectionId: data.connectionId,
        acceptedBy: {
          id: userId,
          profile: connection.receiver.profile,
        },
      });
    } catch (error) {
      logger.error('Socket connection:accepted error', { userId, error });
    }
  });

  // Get online status of users
  socket.on('connection:checkOnline', async (data: { userIds: string[] }) => {
    try {
      if (!data.userIds || data.userIds.length === 0) return;

      const onlineStatuses: Record<string, boolean> = {};

      for (const targetUserId of data.userIds.slice(0, 50)) {
        // Limit to 50
        const socketId = await import('@config/redis').then((mod) =>
          mod.redis.get(`socket:user:${targetUserId}`)
        );
        onlineStatuses[targetUserId] = Boolean(socketId);
      }

      socket.emit('connection:onlineStatuses', onlineStatuses);
    } catch (error) {
      logger.error('Socket connection:checkOnline error', { userId, error });
    }
  });
};
