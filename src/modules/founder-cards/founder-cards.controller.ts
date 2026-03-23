import { Request, Response } from 'express';
import founderCardsService from './founder-cards.service';
import { sendSuccess, sendCreated, sendPaginated } from '@utils/response';
import { ApplyCardDto } from './founder-cards.validation';

export class FounderCardsController {
  async applyForCard(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const dto = req.body as ApplyCardDto;
    const card = await founderCardsService.applyForCard(userId, dto);
    sendCreated(res, card, 'Founder Card application submitted successfully');
  }

  async getMyCard(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const card = await founderCardsService.getMyCard(userId);
    sendSuccess(res, card, 'Founder Card retrieved');
  }

  async generateQR(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const card = await founderCardsService.generateQR(userId);
    sendSuccess(res, card, 'QR code generated');
  }

  async approveCard(req: Request, res: Response): Promise<void> {
    const adminId = req.user!.userId;
    const { id } = req.params;
    const card = await founderCardsService.approveCard(id, adminId);
    sendSuccess(res, card, 'Founder Card approved');
  }

  async rejectCard(req: Request, res: Response): Promise<void> {
    const adminId = req.user!.userId;
    const { id } = req.params;
    const { reason } = req.body as { reason?: string };
    const card = await founderCardsService.rejectCard(id, adminId, reason);
    sendSuccess(res, card, 'Founder Card application rejected');
  }

  async deactivateCard(req: Request, res: Response): Promise<void> {
    const adminId = req.user!.userId;
    const { id } = req.params;
    const card = await founderCardsService.deactivateCard(id, adminId);
    sendSuccess(res, card, 'Founder Card deactivated');
  }

  async reactivateCard(req: Request, res: Response): Promise<void> {
    const adminId = req.user!.userId;
    const { id } = req.params;
    const card = await founderCardsService.reactivateCard(id, adminId);
    sendSuccess(res, card, 'Founder Card reactivated');
  }

  async listPendingCards(req: Request, res: Response): Promise<void> {
    const { page, limit } = req.query as { page?: string; limit?: string };
    const result = await founderCardsService.listPendingCards(
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined
    );
    sendPaginated(res, result.cards, result.pagination, 'Pending cards retrieved');
  }

  async getAllCards(req: Request, res: Response): Promise<void> {
    const { page, limit } = req.query as { page?: string; limit?: string };
    const result = await founderCardsService.getAllCards(
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined
    );
    sendPaginated(res, result.cards, result.pagination, 'Founder cards retrieved');
  }

  async getCardByQR(req: Request, res: Response): Promise<void> {
    const { qrData } = req.params;
    const user = await founderCardsService.getCardByQR(qrData);
    sendSuccess(res, user, 'Profile retrieved via QR');
  }
}

export default new FounderCardsController();
