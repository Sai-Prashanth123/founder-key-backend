import prisma from '@config/database';
import { NotFoundError, ForbiddenError, BadRequestError } from '@utils/errors';
import { parsePaginationQuery, buildPaginationMeta } from '@utils/pagination';

export class OrganizerService {
  async getDashboardStats(organizerId: string) {
    const [totalEvents, upcomingEvents, totalRegistrations, totalLeads] = await Promise.all([
      prisma.event.count({ where: { organizerId, deletedAt: null } }),
      prisma.event.count({
        where: {
          organizerId,
          deletedAt: null,
          status: 'PUBLISHED',
          startDate: { gte: new Date() },
        },
      }),
      prisma.eventRegistration.count({
        where: {
          event: { organizerId },
          status: { not: 'CANCELLED' },
        },
      }),
      prisma.lead.count({ where: { organizerId } }),
    ]);

    const recentEvents = await prisma.event.findMany({
      where: { organizerId, deletedAt: null },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { registrations: { where: { status: { not: 'CANCELLED' } } } } },
      },
    });

    return {
      totalEvents,
      upcomingEvents,
      totalAttendees: totalRegistrations,
      totalLeads,
      recentEvents: recentEvents.map((e) => ({
        ...e,
        registeredCount: e._count.registrations,
      })),
    };
  }

  async getLeads(
    organizerId: string,
    filters: { status?: string; eventId?: string; search?: string },
    page?: number,
    limit?: number
  ) {
    const pagination = parsePaginationQuery({ page, limit });

    const where: Record<string, unknown> = { organizerId };

    if (filters.status) where.status = filters.status;
    if (filters.eventId) where.eventId = filters.eventId;

    if (filters.search) {
      where.attendee = {
        profile: {
          OR: [
            { firstName: { contains: filters.search, mode: 'insensitive' } },
            { lastName: { contains: filters.search, mode: 'insensitive' } },
            { company: { contains: filters.search, mode: 'insensitive' } },
          ],
        },
      };
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          attendee: {
            include: {
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true,
                  company: true,
                  position: true,
                  linkedin: true,
                  twitter: true,
                  website: true,
                },
              },
            },
          },
          event: {
            select: { id: true, title: true, startDate: true },
          },
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.lead.count({ where }),
    ]);

    return {
      leads: leads.map((lead) => ({
        ...lead,
        attendeeEmail: lead.attendee.email,
      })),
      pagination: buildPaginationMeta(total, pagination.page, pagination.limit),
    };
  }

  async updateLeadStatus(
    leadId: string,
    organizerId: string,
    status: string,
    notes?: string
  ) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundError('Lead');
    if (lead.organizerId !== organizerId) {
      throw new ForbiddenError('You do not have access to this lead');
    }

    return prisma.lead.update({
      where: { id: leadId },
      data: {
        status: status as 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'ARCHIVED',
        notes: notes ?? lead.notes,
      },
    });
  }

  async exportLeads(organizerId: string, eventId?: string) {
    const where: Record<string, unknown> = { organizerId };
    if (eventId) where.eventId = eventId;

    const leads = await prisma.lead.findMany({
      where,
      include: {
        attendee: {
          include: {
            profile: true,
          },
        },
        event: {
          select: { id: true, title: true, startDate: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return leads.map((lead) => ({
      id: lead.id,
      status: lead.status,
      notes: lead.notes,
      firstName: lead.attendee.profile?.firstName ?? '',
      lastName: lead.attendee.profile?.lastName ?? '',
      email: lead.attendee.email,
      company: lead.attendee.profile?.company ?? '',
      position: lead.attendee.profile?.position ?? '',
      linkedin: lead.attendee.profile?.linkedin ?? '',
      eventTitle: lead.event.title,
      eventDate: lead.event.startDate.toISOString(),
      registeredAt: lead.createdAt.toISOString(),
    }));
  }

  async getAttendeeDirectory(
    organizerId: string,
    eventId?: string,
    page?: number,
    limit?: number,
    search?: string
  ) {
    const pagination = parsePaginationQuery({ page, limit });

    const where: Record<string, unknown> = {
      event: { organizerId, deletedAt: null },
      status: { not: 'CANCELLED' },
    };

    if (eventId) where.eventId = eventId;

    if (search) {
      where.user = {
        profile: {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { company: { contains: search, mode: 'insensitive' } },
          ],
        },
      };
    }

    const [registrations, total] = await Promise.all([
      prisma.eventRegistration.findMany({
        where,
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
                  linkedin: true,
                  skills: true,
                },
              },
              founderCard: { select: { status: true } },
              gamification: { select: { fkScore: true, level: true } },
            },
          },
          event: { select: { id: true, title: true, startDate: true } },
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { registeredAt: 'desc' },
      }),
      prisma.eventRegistration.count({ where }),
    ]);

    return {
      attendees: registrations.map((r) => ({
        ...r,
        email: r.user.email,
      })),
      pagination: buildPaginationMeta(total, pagination.page, pagination.limit),
    };
  }

  async getEventAnalytics(eventId: string, organizerId: string) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organizerId, deletedAt: null },
    });

    if (!event) throw new NotFoundError('Event');

    const [
      totalRegistrations,
      attendedCount,
      cancelledCount,
      waitlistedCount,
      registrationsByDay,
      leadsByStatus,
    ] = await Promise.all([
      prisma.eventRegistration.count({ where: { eventId } }),
      prisma.eventRegistration.count({ where: { eventId, status: 'ATTENDED' } }),
      prisma.eventRegistration.count({ where: { eventId, status: 'CANCELLED' } }),
      prisma.eventRegistration.count({ where: { eventId, status: 'WAITLISTED' } }),
      prisma.eventRegistration.groupBy({
        by: ['registeredAt'],
        where: { eventId },
        _count: true,
        orderBy: { registeredAt: 'asc' },
      }),
      prisma.lead.groupBy({
        by: ['status'],
        where: { eventId },
        _count: true,
      }),
    ]);

    const conversionRate =
      totalRegistrations > 0
        ? Math.round((attendedCount / totalRegistrations) * 100)
        : 0;

    return {
      event: {
        id: event.id,
        title: event.title,
        startDate: event.startDate,
        capacity: event.capacity,
      },
      registrations: {
        total: totalRegistrations,
        attended: attendedCount,
        cancelled: cancelledCount,
        waitlisted: waitlistedCount,
        active: totalRegistrations - cancelledCount,
        conversionRate,
        capacityUtilization: Math.round((totalRegistrations / event.capacity) * 100),
      },
      timeline: registrationsByDay,
      leads: leadsByStatus.reduce(
        (acc, item) => ({ ...acc, [item.status]: item._count }),
        {} as Record<string, number>
      ),
    };
  }

  async sendEventBlast(
    eventId: string,
    organizerId: string,
    subject: string,
    body: string,
    audience: 'all' | 'registered' | 'waitlist'
  ) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organizerId, deletedAt: null },
    });
    if (!event) throw new NotFoundError('Event');

    const statusFilter: Record<string, unknown> =
      audience === 'registered'
        ? { status: 'REGISTERED' }
        : audience === 'waitlist'
        ? { status: 'WAITLISTED' }
        : { status: { not: 'CANCELLED' } };

    const registrations = await prisma.eventRegistration.findMany({
      where: { eventId, ...statusFilter },
      include: { user: { select: { email: true } } },
    });

    // In production this would send emails; for now we return recipients count
    return { sent: registrations.length, recipients: registrations.map((r) => r.user.email) };
  }

  async checkInAttendee(eventId: string, organizerId: string, userId: string) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organizerId, deletedAt: null },
    });
    if (!event) throw new NotFoundError('Event');

    const registration = await prisma.eventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    if (!registration) throw new NotFoundError('Registration');
    if (registration.status === 'CANCELLED') {
      throw new BadRequestError('Cannot check in a cancelled registration');
    }
    if (registration.checkedIn) {
      throw new BadRequestError('Attendee is already checked in');
    }

    const updated = await prisma.eventRegistration.update({
      where: { id: registration.id },
      data: {
        checkedIn: true,
        checkedInAt: new Date(),
        status: 'ATTENDED',
      },
      include: {
        user: {
          include: {
            profile: { select: { firstName: true, lastName: true, avatar: true, company: true } },
          },
        },
      },
    });

    return updated;
  }

  async getEventGuests(
    eventId: string,
    organizerId: string,
    page?: number,
    limit?: number,
    search?: string,
    status?: string
  ) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organizerId, deletedAt: null },
    });
    if (!event) throw new NotFoundError('Event');

    const pagination = parsePaginationQuery({ page, limit });

    const where: Record<string, unknown> = { eventId };
    if (status) where.status = status;
    if (search) {
      where.user = {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          {
            profile: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { company: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        ],
      };
    }

    const [registrations, total] = await Promise.all([
      prisma.eventRegistration.findMany({
        where,
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
                },
              },
            },
          },
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { registeredAt: 'desc' },
      }),
      prisma.eventRegistration.count({ where }),
    ]);

    return {
      guests: registrations.map((r) => ({
        id: r.id,
        userId: r.userId,
        status: r.status,
        checkedIn: r.checkedIn,
        checkedInAt: r.checkedInAt,
        registeredAt: r.registeredAt,
        email: r.user.email,
        profile: r.user.profile,
      })),
      pagination: buildPaginationMeta(total, pagination.page, pagination.limit),
      event: { id: event.id, title: event.title, capacity: event.capacity },
    };
  }
}

export default new OrganizerService();
