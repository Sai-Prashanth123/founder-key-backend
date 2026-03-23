import { Router } from 'express';
import organizerController from './organizer.controller';
import { authenticate } from '@middlewares/authenticate';
import { authorize } from '@middlewares/authorize';

const router = Router();

// All routes require authentication and ORGANIZER role (ADMIN also allowed)
router.use(authenticate, authorize('ORGANIZER', 'ADMIN'));

router.get('/dashboard', organizerController.getDashboardStats.bind(organizerController));
router.get('/leads', organizerController.getLeads.bind(organizerController));
router.put('/leads/:id', organizerController.updateLeadStatus.bind(organizerController));
router.get('/leads/export', organizerController.exportLeads.bind(organizerController));
router.get('/attendees', organizerController.getAttendeeDirectory.bind(organizerController));
router.get('/events/:id/analytics', organizerController.getEventAnalytics.bind(organizerController));
router.post('/events/:id/blast', organizerController.sendEventBlast.bind(organizerController));
router.post('/events/:id/checkin', organizerController.checkInAttendee.bind(organizerController));
router.get('/events/:id/guests', organizerController.getEventGuests.bind(organizerController));

export default router;
