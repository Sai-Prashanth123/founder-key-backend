import { Request, Response } from 'express';
import organizerService from './organizer.service';
import { sendSuccess, sendPaginated } from '@utils/response';

export class OrganizerController {
  async getDashboardStats(req: Request, res: Response): Promise<void> {
    const organizerId = req.user!.userId;
    const stats = await organizerService.getDashboardStats(organizerId);
    sendSuccess(res, stats, 'Dashboard stats retrieved');
  }

  async getLeads(req: Request, res: Response): Promise<void> {
    const organizerId = req.user!.userId;
    const { status, eventId, search, page, limit } = req.query as {
      status?: string;
      eventId?: string;
      search?: string;
      page?: string;
      limit?: string;
    };

    const result = await organizerService.getLeads(
      organizerId,
      { status, eventId, search },
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined
    );
    sendPaginated(res, result.leads, result.pagination, 'Leads retrieved');
  }

  async updateLeadStatus(req: Request, res: Response): Promise<void> {
    const organizerId = req.user!.userId;
    const { id } = req.params as Record<string, string>;
    const { status, notes } = req.body as { status: string; notes?: string };
    const lead = await organizerService.updateLeadStatus(id, organizerId, status, notes);
    sendSuccess(res, lead, 'Lead updated');
  }

  async exportLeads(req: Request, res: Response): Promise<void> {
    const organizerId = req.user!.userId;
    const { eventId } = req.query as { eventId?: string };
    const leads = await organizerService.exportLeads(organizerId, eventId);

    // Return as CSV-ready JSON
    sendSuccess(res, leads, 'Leads exported');
  }

  async getAttendeeDirectory(req: Request, res: Response): Promise<void> {
    const organizerId = req.user!.userId;
    const { eventId, page, limit, search } = req.query as {
      eventId?: string;
      page?: string;
      limit?: string;
      search?: string;
    };

    const result = await organizerService.getAttendeeDirectory(
      organizerId,
      eventId,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
      search
    );
    sendPaginated(res, result.attendees, result.pagination, 'Attendees retrieved');
  }

  async getEventAnalytics(req: Request, res: Response): Promise<void> {
    const organizerId = req.user!.userId;
    const { id } = req.params as Record<string, string>;
    const analytics = await organizerService.getEventAnalytics(id, organizerId);
    sendSuccess(res, analytics, 'Event analytics retrieved');
  }

  async sendEventBlast(req: Request, res: Response): Promise<void> {
    const organizerId = req.user!.userId;
    const { id } = req.params as Record<string, string>;
    const { subject, body, audience = 'all' } = req.body as {
      subject: string;
      body: string;
      audience?: 'all' | 'registered' | 'waitlist';
    };
    const result = await organizerService.sendEventBlast(id, organizerId, subject, body, audience);
    sendSuccess(res, result, `Blast sent to ${result.sent} recipients`);
  }

  async checkInAttendee(req: Request, res: Response): Promise<void> {
    const organizerId = req.user!.userId;
    const { id } = req.params as Record<string, string>;
    const { userId } = req.body as { userId: string };
    const registration = await organizerService.checkInAttendee(id, organizerId, userId);
    sendSuccess(res, registration, 'Attendee checked in');
  }

  async getEventGuests(req: Request, res: Response): Promise<void> {
    const organizerId = req.user!.userId;
    const { id } = req.params as Record<string, string>;
    const { page, limit, search, status } = req.query as {
      page?: string;
      limit?: string;
      search?: string;
      status?: string;
    };
    const result = await organizerService.getEventGuests(
      id,
      organizerId,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
      search,
      status
    );
    sendPaginated(res, result.guests, result.pagination, 'Guests retrieved');
  }
}

export default new OrganizerController();
