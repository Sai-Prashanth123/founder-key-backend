import { Router } from 'express';
import notificationsController from './notifications.controller';
import { authenticate } from '@middlewares/authenticate';

const router = Router();

router.use(authenticate);

router.get('/', notificationsController.getNotifications.bind(notificationsController));
router.get('/unread-count', notificationsController.getUnreadCount.bind(notificationsController));
router.put('/read-all', notificationsController.markAllAsRead.bind(notificationsController));
router.put('/:id/read', notificationsController.markAsRead.bind(notificationsController));
router.delete('/:id', notificationsController.deleteNotification.bind(notificationsController));

export default router;
