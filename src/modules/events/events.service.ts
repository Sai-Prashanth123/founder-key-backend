import { Prisma } from '@prisma/client';
import prisma from '@config/database';
import { NotFoundError, ForbiddenError, ConflictError, BadRequestError } from '@utils/errors';
import { parsePaginationQuery, buildPaginationMeta } from '@utils/pagination';
import { SCORE_VALUES } from '@config/constants';
import { CreateEventDto, UpdateEventDto, SearchEventsDto } from './events.validation';
import gamificationService from '@modules/gamification/gamification.service';
import notificationsService from '@modules/notifications/notifications.service';

export class EventsService {
  async createEvent(organizerId: string, dto: CreateEventDto) {
    // Auto-generate slug if not provided
    let slug = dto.slug;
    if (!slug) {
      slug = dto.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 80);
      // Append short unique suffix to avoid collisions
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const event = await prisma.event.create({
      data: {
        organizerId,
        title: dto.title,
        description: dto.description,
        startDate: dto.startDate,
        endDate: dto.endDate,
        locationType: dto.type,
        address: dto.location?.address ?? null,
        city: dto.location?.city ?? null,
        country: dto.location?.country ?? null,
        meetingUrl: dto.location?.meetingUrl ?? null,
        capacity: dto.capacity,
        ticketPrice: dto.ticketPrice !== undefined ? new Prisma.Decimal(dto.ticketPrice) : null,
        coverImage: dto.coverImage ?? null,
        tags: dto.tags ?? [],
        category: dto.category ?? null,
        theme: dto.theme ?? 'default',
        slug,
        requiresApproval: dto.requiresApproval ?? false,
        waitlistEnabled: dto.waitlistEnabled ?? true,
        visibility: dto.visibility ?? 'PUBLIC',
        timezone: dto.timezone ?? 'UTC',
        ticketTypes: dto.ticketTypes ? JSON.parse(JSON.stringify(dto.ticketTypes)) : undefined,
        status: 'DRAFT',
      },
      include: { organizer: { include: { profile: true } } },
    });

    return event;
  }

  async updateEvent(eventId: string, organizerId: string, dto: UpdateEventDto) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
    });

    if (!event) throw new NotFoundError('Event');
    if (event.organizerId !== organizerId) {
      throw new ForbiddenError('You do not have permission to update this event');
    }
    if (event.status === 'CANCELLED') {
      throw new BadRequestError('Cannot update a cancelled event');
    }

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.startDate !== undefined && { startDate: dto.startDate }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate }),
        ...(dto.type !== undefined && { locationType: dto.type }),
        ...(dto.location?.address !== undefined && { address: dto.location.address }),
        ...(dto.location?.city !== undefined && { city: dto.location.city }),
        ...(dto.location?.country !== undefined && { country: dto.location.country }),
        ...(dto.location?.meetingUrl !== undefined && { meetingUrl: dto.location.meetingUrl }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity }),
        ...(dto.ticketPrice !== undefined && {
          ticketPrice: new Prisma.Decimal(dto.ticketPrice),
        }),
        ...(dto.coverImage !== undefined && { coverImage: dto.coverImage }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.theme !== undefined && { theme: dto.theme }),
        ...(dto.requiresApproval !== undefined && { requiresApproval: dto.requiresApproval }),
        ...(dto.waitlistEnabled !== undefined && { waitlistEnabled: dto.waitlistEnabled }),
        ...(dto.visibility !== undefined && { visibility: dto.visibility }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.ticketTypes !== undefined && { ticketTypes: JSON.parse(JSON.stringify(dto.ticketTypes)) }),
      },
      include: { organizer: { include: { profile: true } } },
    });

    return updated;
  }

  async deleteEvent(eventId: string, organizerId: string): Promise<void> {
    const event = await prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
    });

    if (!event) throw new NotFoundError('Event');
    if (event.organizerId !== organizerId) {
      throw new ForbiddenError('You do not have permission to delete this event');
    }

    await prisma.event.update({
      where: { id: eventId },
      data: { deletedAt: new Date() },
    });
  }

  async getEvent(eventId: string, userId?: string) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      include: {
        organizer: {
          include: {
            profile: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
                company: true,
              },
            },
          },
        },
        _count: { select: { registrations: { where: { status: { not: 'CANCELLED' } } } } },
      },
    });

    if (!event) throw new NotFoundError('Event');

    let registrationStatus = null;
    if (userId) {
      const registration = await prisma.eventRegistration.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });
      registrationStatus = registration?.status ?? null;
    }

    return {
      ...event,
      registeredCount: event._count.registrations,
      registrationStatus,
    };
  }

  async listEvents(dto: SearchEventsDto) {
    const pagination = parsePaginationQuery({
      page: dto.page,
      limit: dto.limit,
      orderBy: dto.orderBy ?? 'startDate',
      orderDir: dto.orderDir,
    });

    const where: Prisma.EventWhereInput = {
      deletedAt: null,
    };

    if (dto.status) where.status = dto.status;
    if (dto.type) where.locationType = dto.type;
    if (dto.category) where.category = { contains: dto.category, mode: 'insensitive' };
    if (dto.city) where.city = { contains: dto.city, mode: 'insensitive' };
    if (dto.country) where.country = { contains: dto.country, mode: 'insensitive' };

    if (dto.startDate || dto.endDate) {
      where.startDate = {};
      if (dto.startDate) where.startDate.gte = dto.startDate;
      if (dto.endDate) where.startDate.lte = dto.endDate;
    }

    if (dto.tags) {
      const tagList = dto.tags.split(',').map((t) => t.trim());
      where.tags = { hasSome: tagList };
    }

    if (dto.q) {
      where.OR = [
        { title: { contains: dto.q, mode: 'insensitive' } },
        { description: { contains: dto.q, mode: 'insensitive' } },
      ];
    }

    const orderByField = dto.orderBy ?? 'startDate';
    const orderByDir = dto.orderDir ?? 'asc';

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: {
          organizer: {
            include: {
              profile: {
                select: { firstName: true, lastName: true, avatar: true, company: true },
              },
            },
          },
          _count: { select: { registrations: { where: { status: { not: 'CANCELLED' } } } } },
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { [orderByField]: orderByDir },
      }),
      prisma.event.count({ where }),
    ]);

    return {
      events: events.map((e) => ({ ...e, registeredCount: e._count.registrations })),
      pagination: buildPaginationMeta(total, pagination.page, pagination.limit),
    };
  }

  async registerForEvent(eventId: string, userId: string) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, deletedAt: null, status: 'PUBLISHED' },
      include: {
        _count: { select: { registrations: { where: { status: { not: 'CANCELLED' } } } } },
      },
    });

    if (!event) throw new NotFoundError('Event');

    if (event._count.registrations >= event.capacity) {
      // Add to waitlist instead
      const registration = await prisma.eventRegistration.create({
        data: { eventId, userId, status: 'WAITLISTED' },
      });
      return { registration, message: 'You have been added to the waitlist' };
    }

    const existing = await prisma.eventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    if (existing) {
      if (existing.status === 'CANCELLED') {
        const updated = await prisma.eventRegistration.update({
          where: { id: existing.id },
          data: { status: 'REGISTERED' },
        });
        return { registration: updated, message: 'Registration re-activated' };
      }
      throw new ConflictError('You are already registered for this event');
    }

    const registration = await prisma.eventRegistration.create({
      data: { eventId, userId, status: 'REGISTERED' },
    });

    // Add FK score
    await gamificationService
      .addScore(userId, 'EVENT_REGISTERED', SCORE_VALUES.EVENT_REGISTERED, { eventId })
      .catch(() => {});

    // Create lead for organizer
    await prisma.lead.upsert({
      where: { eventId_attendeeId: { eventId, attendeeId: userId } },
      update: {},
      create: {
        eventId,
        attendeeId: userId,
        organizerId: event.organizerId,
        status: 'NEW',
      },
    });

    return { registration, message: 'Successfully registered for event' };
  }

  async cancelRegistration(eventId: string, userId: string): Promise<void> {
    const registration = await prisma.eventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    if (!registration) throw new NotFoundError('Registration');
    if (registration.status === 'CANCELLED') {
      throw new BadRequestError('Registration is already cancelled');
    }

    await prisma.eventRegistration.update({
      where: { id: registration.id },
      data: { status: 'CANCELLED' },
    });
  }

  async getMyEvents(userId: string, page?: number, limit?: number) {
    const pagination = parsePaginationQuery({ page, limit });

    const [registrations, total] = await Promise.all([
      prisma.eventRegistration.findMany({
        where: { userId },
        include: {
          event: {
            include: {
              organizer: {
                include: {
                  profile: {
                    select: { firstName: true, lastName: true, avatar: true, company: true },
                  },
                },
              },
            },
          },
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { registeredAt: 'desc' },
      }),
      prisma.eventRegistration.count({ where: { userId } }),
    ]);

    return {
      registrations,
      pagination: buildPaginationMeta(total, pagination.page, pagination.limit),
    };
  }

  async getOrganizerEvents(organizerId: string, page?: number, limit?: number) {
    const pagination = parsePaginationQuery({ page, limit });

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where: { organizerId, deletedAt: null },
        include: {
          _count: { select: { registrations: { where: { status: { not: 'CANCELLED' } } } } },
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.event.count({ where: { organizerId, deletedAt: null } }),
    ]);

    return {
      events: events.map((e) => ({ ...e, registeredCount: e._count.registrations })),
      pagination: buildPaginationMeta(total, pagination.page, pagination.limit),
    };
  }

  async getEventAttendees(eventId: string, organizerId: string, page?: number, limit?: number) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organizerId, deletedAt: null },
    });

    if (!event) throw new NotFoundError('Event');

    const pagination = parsePaginationQuery({ page, limit });

    const [registrations, total] = await Promise.all([
      prisma.eventRegistration.findMany({
        where: { eventId, status: { not: 'CANCELLED' } },
        include: {
          user: {
            include: {
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true,
                  company: true,
                  position: true,
                  email: true,
                },
              },
            },
          },
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { registeredAt: 'desc' },
      }),
      prisma.eventRegistration.count({ where: { eventId, status: { not: 'CANCELLED' } } }),
    ]);

    return {
      attendees: registrations,
      pagination: buildPaginationMeta(total, pagination.page, pagination.limit),
    };
  }

  async publishEvent(eventId: string, organizerId: string) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organizerId, deletedAt: null },
    });

    if (!event) throw new NotFoundError('Event');
    if (event.status !== 'DRAFT') {
      throw new BadRequestError('Only draft events can be published');
    }

    return prisma.event.update({
      where: { id: eventId },
      data: { status: 'PUBLISHED' },
    });
  }

  async cancelEvent(eventId: string, organizerId: string): Promise<void> {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organizerId, deletedAt: null },
    });

    if (!event) throw new NotFoundError('Event');
    if (event.status === 'CANCELLED') {
      throw new BadRequestError('Event is already cancelled');
    }

    await prisma.event.update({
      where: { id: eventId },
      data: { status: 'CANCELLED' },
    });

    // Notify all registered attendees
    const registrations = await prisma.eventRegistration.findMany({
      where: { eventId, status: { in: ['REGISTERED', 'WAITLISTED'] } },
      select: { userId: true },
    });

    const userIds = registrations.map((r) => r.userId);
    if (userIds.length > 0) {
      await notificationsService
        .sendBulkNotification(
          userIds,
          'SYSTEM',
          'Event Cancelled',
          `The event "${event.title}" has been cancelled.`,
          { eventId }
        )
        .catch(() => {});
    }
  }
}

export default new EventsService();
