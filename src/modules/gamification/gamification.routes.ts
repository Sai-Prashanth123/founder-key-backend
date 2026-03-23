import { Router } from 'express';
import gamificationController from './gamification.controller';
import { authenticate } from '@middlewares/authenticate';

const router = Router();

router.use(authenticate);

router.get('/me', gamificationController.getMyScore.bind(gamificationController));
router.get('/leaderboard', gamificationController.getLeaderboard.bind(gamificationController));
router.get('/badges', gamificationController.getAllBadges.bind(gamificationController));
router.get('/badges/me', gamificationController.getMyBadges.bind(gamificationController));
router.get('/history', gamificationController.getMyHistory.bind(gamificationController));
router.get('/users/:id', gamificationController.getUserScore.bind(gamificationController));

export default router;
