import { Request, Response } from 'express';
import gamificationService from './gamification.service';
import { sendSuccess, sendPaginated } from '@utils/response';

export class GamificationController {
  async getMyScore(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const score = await gamificationService.getUserScore(userId);
    sendSuccess(res, score, 'Score retrieved');
  }

  async getLeaderboard(req: Request, res: Response): Promise<void> {
    const { page, limit } = req.query as { page?: string; limit?: string };
    const result = await gamificationService.getLeaderboard(
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined
    );
    sendPaginated(res, result.leaderboard, result.pagination, 'Leaderboard retrieved');
  }

  async getMyBadges(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const badges = await gamificationService.getUserBadges(userId);
    sendSuccess(res, badges, 'Badges retrieved');
  }

  async getAllBadges(req: Request, res: Response): Promise<void> {
    const badges = await gamificationService.getAllBadges();
    sendSuccess(res, badges, 'Badges retrieved');
  }

  async getMyHistory(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const { page, limit } = req.query as { page?: string; limit?: string };
    const result = await gamificationService.getScoreHistory(
      userId,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined
    );
    sendPaginated(res, result.history, result.pagination, 'Score history retrieved');
  }

  async getUserScore(req: Request, res: Response): Promise<void> {
    const { id } = req.params as Record<string, string>;
    const score = await gamificationService.getUserScore(id);
    sendSuccess(res, score, 'Score retrieved');
  }
}

export default new GamificationController();
