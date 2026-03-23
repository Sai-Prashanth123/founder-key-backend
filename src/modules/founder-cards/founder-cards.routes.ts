import { Router } from 'express';
import founderCardsController from './founder-cards.controller';
import { authenticate } from '@middlewares/authenticate';
import { authorize } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { applyCardSchema } from './founder-cards.validation';

const router = Router();

// Authenticated user routes
router.post('/apply', authenticate, validate(applyCardSchema), founderCardsController.applyForCard.bind(founderCardsController));
router.get('/me', authenticate, founderCardsController.getMyCard.bind(founderCardsController));
router.post('/me/qr', authenticate, founderCardsController.generateQR.bind(founderCardsController));
router.get('/scan/:qrData', authenticate, founderCardsController.getCardByQR.bind(founderCardsController));

// Admin routes
router.get('/pending', authenticate, authorize('ADMIN'), founderCardsController.listPendingCards.bind(founderCardsController));
router.get('/', authenticate, authorize('ADMIN'), founderCardsController.getAllCards.bind(founderCardsController));
router.post('/:id/approve', authenticate, authorize('ADMIN'), founderCardsController.approveCard.bind(founderCardsController));
router.post('/:id/reject', authenticate, authorize('ADMIN'), founderCardsController.rejectCard.bind(founderCardsController));
router.put('/:id/deactivate', authenticate, authorize('ADMIN'), founderCardsController.deactivateCard.bind(founderCardsController));
router.put('/:id/reactivate', authenticate, authorize('ADMIN'), founderCardsController.reactivateCard.bind(founderCardsController));

export default router;
