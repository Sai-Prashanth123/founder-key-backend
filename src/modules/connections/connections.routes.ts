import { Router } from 'express';
import connectionsController from './connections.controller';
import { authenticate } from '@middlewares/authenticate';
import { validate } from '@middlewares/validate';
import { sendConnectionSchema, respondConnectionSchema, scanQRSchema } from './connections.validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/', connectionsController.getConnections.bind(connectionsController));
router.get('/pending', connectionsController.getPendingRequests.bind(connectionsController));
router.get('/sent', connectionsController.getSentRequests.bind(connectionsController));
router.get('/suggestions', connectionsController.getSuggestions.bind(connectionsController));
router.get('/status/:targetId', connectionsController.checkStatus.bind(connectionsController));

router.post('/request', validate(sendConnectionSchema), connectionsController.sendRequest.bind(connectionsController));
router.post('/qr-scan', validate(scanQRSchema), connectionsController.connectViaQR.bind(connectionsController));

router.put('/:id/respond', validate(respondConnectionSchema), connectionsController.respondToRequest.bind(connectionsController));
router.delete('/:id', connectionsController.removeConnection.bind(connectionsController));

export default router;
