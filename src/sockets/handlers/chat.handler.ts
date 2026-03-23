import { Socket } from 'socket.io';
import prisma from '@config/database';
import logger from '@utils/logger';
import { io } from '../index';

export const chatHandler = (socket: Socket, userId: string) => {
  // Join an event chat room
  socket.on('chat:join', async ({ eventId }: { eventId: string }) => {
    try {
      // Verify user is registered for the event
      const registration = await prisma.eventRegistration.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });

      if (!registration || registration.status === 'CANCELLED') {
        socket.emit('chat:error', { message: 'You are not registered for this event' });
        return;
      }

      await socket.join(`event:${eventId}`);
      socket.emit('chat:joined', { eventId });

      // Send last 50 messages
      const messages = await prisma.eventMessage.findMany({
        where: { eventId },
        include: {
          user: {
            include: {
              profile: { select: { firstName: true, lastName: true, avatar: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });

      socket.emit('chat:history', { eventId, messages });
    } catch (error) {
      logger.error('chat:join error', { userId, error });
      socket.emit('chat:error', { message: 'Failed to join event chat' });
    }
  });

  // Send a message
  socket.on('chat:message', async ({ eventId, content }: { eventId: string; content: string }) => {
    try {
      if (!content || content.trim().length === 0) return;
      if (content.length > 1000) {
        socket.emit('chat:error', { message: 'Message too long (max 1000 chars)' });
        return;
      }

      const message = await prisma.eventMessage.create({
        data: { eventId, userId, content: content.trim() },
        include: {
          user: {
            include: {
              profile: { select: { firstName: true, lastName: true, avatar: true } },
            },
          },
        },
      });

      // Broadcast to everyone in the event room
      io.to(`event:${eventId}`).emit('chat:message', message);
    } catch (error) {
      logger.error('chat:message error', { userId, error });
      socket.emit('chat:error', { message: 'Failed to send message' });
    }
  });

  // Leave event chat
  socket.on('chat:leave', async ({ eventId }: { eventId: string }) => {
    await socket.leave(`event:${eventId}`);
    socket.emit('chat:left', { eventId });
  });
};
