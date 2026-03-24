import { Request, Response } from 'express';
import notificationsService from './notifications.service';
import { sendSuccess } from '@utils/response';

export class NotificationsController {
  async getNotifications(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const { page, limit } = req.query as { page?: string; limit?: string };
    const result = await notificationsService.getNotifications(
      userId,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined
    );
    const { notifications, unreadCount, pagination } = result;
    res.json({
      success: true,
      message: 'Notifications retrieved',
      data: notifications,
      unreadCount,
      pagination,
    });
  }

  async getUnreadCount(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const result = await notificationsService.getUnreadCount(userId);
    sendSuccess(res, result, 'Unread count retrieved');
  }

  async markAsRead(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const { id } = req.params as Record<string, string>;
    const notification = await notificationsService.markAsRead(id, userId);
    sendSuccess(res, notification, 'Notification marked as read');
  }

  async markAllAsRead(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    await notificationsService.markAllAsRead(userId);
    sendSuccess(res, null, 'All notifications marked as read');
  }

  async deleteNotification(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const { id } = req.params as Record<string, string>;
    await notificationsService.deleteNotification(id, userId);
    sendSuccess(res, null, 'Notification deleted');
  }
}

export default new NotificationsController();
