import { Request, Response } from 'express';
import eventsService from './events.service';
import { sendSuccess, sendCreated, sendPaginated } from '@utils/response';
import { CreateEventDto, UpdateEventDto, SearchEventsDto } from './events.validation';

export class EventsController {
  async createEvent(req: Request, res: Response): Promise<void> {
    const organizerId = req.user!.userId;
    const dto = req.body as CreateEventDto;
    const event = await eventsService.createEvent(organizerId, dto);
    sendCreated(res, event, 'Event created successfully');
  }

  async updateEvent(req: Request, res: Response): Promise<void> {
    const organizerId = req.user!.userId;
    const { id } = req.params as Record<string, string>;
    const dto = req.body as UpdateEventDto;
    const event = await eventsService.updateEvent(id, organizerId, dto);
    sendSuccess(res, event, 'Event updated successfully');
  }

  async deleteEvent(req: Request, res: Response): Promise<void> {
    const organizerId = req.user!.userId;
    const { id } = req.params as Record<string, string>;
    await eventsService.deleteEvent(id, organizerId);
    sendSuccess(res, null, 'Event deleted successfully');
  }

  async getEvent(req: Request, res: Response): Promise<void> {
    const { id } = req.params as Record<string, string>;
    const userId = req.user?.userId;
    const event = await eventsService.getEvent(id, userId);
    sendSuccess(res, event, 'Event retrieved successfully');
  }

  async listEvents(req: Request, res: Response): Promise<void> {
    const dto = req.query as SearchEventsDto;
    const result = await eventsService.listEvents(dto);
    sendPaginated(res, result.events, result.pagination, 'Events retrieved successfully');
  }

  async registerForEvent(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const { id } = req.params as Record<string, string>;
    const result = await eventsService.registerForEvent(id, userId);
    sendSuccess(res, result.registration, result.message);
  }

  async cancelRegistration(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const { id } = req.params as Record<string, string>;
    await eventsService.cancelRegistration(id, userId);
    sendSuccess(res, null, 'Registration cancelled successfully');
  }

  async getMyEvents(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const { page, limit } = req.query as { page?: string; limit?: string };
    const result = await eventsService.getMyEvents(
      userId,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined
    );
    sendPaginated(res, result.registrations, result.pagination, 'Events retrieved successfully');
  }

  async getOrganizerEvents(req: Request, res: Response): Promise<void> {
    const organizerId = req.user!.userId;
    const { page, limit } = req.query as { page?: string; limit?: string };
    const result = await eventsService.getOrganizerEvents(
      organizerId,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined
    );
    sendPaginated(res, result.events, result.pagination, 'Events retrieved successfully');
  }

  async getEventAttendees(req: Request, res: Response): Promise<void> {
    const organizerId = req.user!.userId;
    const { id } = req.params as Record<string, string>;
    const { page, limit } = req.query as { page?: string; limit?: string };
    const result = await eventsService.getEventAttendees(
      id,
      organizerId,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined
    );
    sendPaginated(res, result.attendees, result.pagination, 'Attendees retrieved successfully');
  }

  async publishEvent(req: Request, res: Response): Promise<void> {
    const organizerId = req.user!.userId;
    const { id } = req.params as Record<string, string>;
    const event = await eventsService.publishEvent(id, organizerId);
    sendSuccess(res, event, 'Event published successfully');
  }

  async cancelEvent(req: Request, res: Response): Promise<void> {
    const organizerId = req.user!.userId;
    const { id } = req.params as Record<string, string>;
    await eventsService.cancelEvent(id, organizerId);
    sendSuccess(res, null, 'Event cancelled successfully');
  }
}

export default new EventsController();
