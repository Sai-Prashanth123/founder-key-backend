import { Router } from 'express';
import adminController from './admin.controller';
import { authenticate } from '@middlewares/authenticate';
import { authorize } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { updateUserSchema, banUserSchema, updateSettingsSchema, updatePermissionSchema } from './admin.validation';

const router = Router();

// All routes require authentication and ADMIN role
router.use(authenticate, authorize('ADMIN'));

// Dashboard
router.get('/dashboard', adminController.getDashboard.bind(adminController));

// Users
router.get('/users', adminController.getUsers.bind(adminController));
router.get('/users/:id', adminController.getUserDetail.bind(adminController));
router.put('/users/:id', validate(updateUserSchema), adminController.updateUser.bind(adminController));
router.delete('/users/:id', adminController.deleteUser.bind(adminController));
router.post('/users/:id/ban', validate(banUserSchema), adminController.banUser.bind(adminController));

// Events
router.get('/events', adminController.getEvents.bind(adminController));
router.put('/events/:id', adminController.updateEvent.bind(adminController));
router.delete('/events/:id', adminController.deleteEvent.bind(adminController));

// Analytics
router.get('/analytics', adminController.getAnalytics.bind(adminController));

// Settings
router.get('/settings', adminController.getSettings.bind(adminController));
router.put('/settings/:key', validate(updateSettingsSchema), adminController.updateSetting.bind(adminController));

// Permissions
router.get('/permissions', adminController.getPermissions.bind(adminController));
router.put('/permissions', validate(updatePermissionSchema), adminController.updatePermission.bind(adminController));

// Audit Logs
router.get('/audit-logs', adminController.getAuditLogs.bind(adminController));

// Health
router.get('/health', adminController.getHealth.bind(adminController));

export default router;
