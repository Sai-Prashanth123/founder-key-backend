import { Router } from 'express';
import eventsController from './events.controller';
import { authenticate } from '@middlewares/authenticate';
import { optionalAuthenticate } from '@middlewares/authenticate';
import { authorize } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { createEventSchema, updateEventSchema, searchEventsSchema } from './events.validation';

const router = Router();

// Public / optional auth
router.get('/', optionalAuthenticate, validate(searchEventsSchema, 'query'), eventsController.listEvents.bind(eventsController));
router.get('/my', authenticate, eventsController.getMyEvents.bind(eventsController));
router.get('/organizer', authenticate, authorize('ORGANIZER', 'ADMIN'), eventsController.getOrganizerEvents.bind(eventsController));
router.get('/:id', optionalAuthenticate, eventsController.getEvent.bind(eventsController));

// Organizer routes
router.post('/', authenticate, authorize('ORGANIZER', 'ADMIN'), validate(createEventSchema), eventsController.createEvent.bind(eventsController));
router.put('/:id', authenticate, authorize('ORGANIZER', 'ADMIN'), validate(updateEventSchema), eventsController.updateEvent.bind(eventsController));
router.delete('/:id', authenticate, authorize('ORGANIZER', 'ADMIN'), eventsController.deleteEvent.bind(eventsController));
router.post('/:id/publish', authenticate, authorize('ORGANIZER', 'ADMIN'), eventsController.publishEvent.bind(eventsController));
router.post('/:id/cancel', authenticate, authorize('ORGANIZER', 'ADMIN'), eventsController.cancelEvent.bind(eventsController));
router.get('/:id/attendees', authenticate, authorize('ORGANIZER', 'ADMIN'), eventsController.getEventAttendees.bind(eventsController));

// Attendee routes
router.post('/:id/register', authenticate, eventsController.registerForEvent.bind(eventsController));
router.delete('/:id/register', authenticate, eventsController.cancelRegistration.bind(eventsController));

export default router;
