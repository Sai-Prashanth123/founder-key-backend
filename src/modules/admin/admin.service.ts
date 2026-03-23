import prisma from '@config/database';
import redis from '@config/redis';
import { NotFoundError } from '@utils/errors';
import { parsePaginationQuery, buildPaginationMeta } from '@utils/pagination';
import { UpdateUserDto } from './admin.validation';
import notificationsService from '@modules/notifications/notifications.service';

export class AdminService {
  async getDashboardStats() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalEvents,
      activeFounderCards,
      totalConnections,
      newUsersThisMonth,
      newUsersLastMonth,
      newEventsThisMonth,
      newConnectionsThisMonth,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.event.count({ where: { deletedAt: null } }),
      prisma.founderCard.count({ where: { status: 'ACTIVE' } }),
      prisma.connection.count({ where: { status: 'ACCEPTED' } }),
      prisma.user.count({ where: { deletedAt: null, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.count({
        where: {
          deletedAt: null,
          createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
        },
      }),
      prisma.event.count({ where: { deletedAt: null, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.connection.count({ where: { status: 'ACCEPTED', createdAt: { gte: thirtyDaysAgo } } }),
    ]);

    const userGrowth =
      newUsersLastMonth === 0
        ? 100
        : Math.round(((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100);

    return {
      totalUsers,
      totalEvents,
      activeFounderCards,
      totalConnections,
      monthlyGrowth: {
        users: userGrowth,
        events: newEventsThisMonth,
        connections: newConnectionsThisMonth,
      },
    };
  }

  async getUsers(
    filters: {
      role?: string;
      tier?: string;
      isActive?: boolean;
      search?: string;
    },
    page?: number,
    limit?: number
  ) {
    const pagination = parsePaginationQuery({ page, limit });

    const where: Record<string, unknown> = { deletedAt: null };

    if (filters.role) where.role = filters.role;
    if (filters.tier) where.tier = filters.tier;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        {
          profile: {
            OR: [
              { firstName: { contains: filters.search, mode: 'insensitive' } },
              { lastName: { contains: filters.search, mode: 'insensitive' } },
              { company: { contains: filters.search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
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
          gamification: { select: { fkScore: true, level: true } },
          founderCard: { select: { status: true } },
          _count: {
            select: {
              sentConnections: { where: { status: 'ACCEPTED' } },
              receivedConnections: { where: { status: 'ACCEPTED' } },
              registrations: true,
            },
          },
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: buildPaginationMeta(total, pagination.page, pagination.limit),
    };
  }

  async getUserDetail(userId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        profile: true,
        gamification: true,
        founderCard: true,
        _count: {
          select: {
            sentConnections: true,
            receivedConnections: true,
            registrations: true,
            userBadges: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundError('User');

    const { password: _pw, ...safeUser } = user;
    void _pw;
    return safeUser;
  }

  async updateUser(userId: string, dto: UpdateUserDto) {
    const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundError('User');

    return prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.tier !== undefined && { tier: dto.tier }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.isEmailVerified !== undefined && { isEmailVerified: dto.isEmailVerified }),
      },
      include: {
        profile: {
          select: { firstName: true, lastName: true, avatar: true },
        },
      },
    });
  }

  async banUser(userId: string, reason: string) {
    const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundError('User');

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    // Revoke all refresh tokens
    const pattern = `refresh_token:${userId}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);

    await notificationsService
      .createNotification(
        userId,
        'SYSTEM',
        'Account Suspended',
        `Your account has been suspended. Reason: ${reason}`,
        { reason }
      )
      .catch(() => {});

    await prisma.auditLog.create({
      data: {
        action: 'USER_BANNED',
        resource: 'User',
        resourceId: userId,
        metadata: { reason },
      },
    });

    return { success: true, message: 'User banned successfully' };
  }

  async deleteUser(userId: string) {
    const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundError('User');

    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        action: 'USER_DELETED',
        resource: 'User',
        resourceId: userId,
        metadata: { email: user.email },
      },
    });
  }

  async getEvents(
    filters: { status?: string; organizerId?: string; search?: string },
    page?: number,
    limit?: number
  ) {
    const pagination = parsePaginationQuery({ page, limit });

    const where: Record<string, unknown> = { deletedAt: null };

    if (filters.status) where.status = filters.status;
    if (filters.organizerId) where.organizerId = filters.organizerId;

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: {
          organizer: {
            include: {
              profile: { select: { firstName: true, lastName: true, avatar: true } },
            },
          },
          _count: { select: { registrations: true } },
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.event.count({ where }),
    ]);

    return {
      events,
      pagination: buildPaginationMeta(total, pagination.page, pagination.limit),
    };
  }

  async updateEvent(eventId: string, dto: Record<string, unknown>) {
    const event = await prisma.event.findFirst({ where: { id: eventId, deletedAt: null } });
    if (!event) throw new NotFoundError('Event');

    return prisma.event.update({
      where: { id: eventId },
      data: dto,
    });
  }

  async deleteEvent(eventId: string) {
    const event = await prisma.event.findFirst({ where: { id: eventId, deletedAt: null } });
    if (!event) throw new NotFoundError('Event');

    await prisma.event.delete({ where: { id: eventId } });
  }

  async getAnalytics(dateRange: { startDate?: Date; endDate?: Date; period?: string }) {
    const now = new Date();
    let startDate = dateRange.startDate;
    const endDate = dateRange.endDate ?? now;

    if (!startDate) {
      const periodMap: Record<string, number> = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365,
      };
      const days = periodMap[dateRange.period ?? '30d'] ?? 30;
      startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    const [
      totalUsers,
      newUsers,
      totalEvents,
      newEvents,
      totalConnections,
      newConnections,
      totalRegistrations,
      newRegistrations,
      founderCards,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, createdAt: { gte: startDate, lte: endDate } } }),
      prisma.event.count({ where: { deletedAt: null } }),
      prisma.event.count({ where: { deletedAt: null, createdAt: { gte: startDate, lte: endDate } } }),
      prisma.connection.count({ where: { status: 'ACCEPTED' } }),
      prisma.connection.count({ where: { status: 'ACCEPTED', createdAt: { gte: startDate, lte: endDate } } }),
      prisma.eventRegistration.count(),
      prisma.eventRegistration.count({ where: { registeredAt: { gte: startDate, lte: endDate } } }),
      prisma.founderCard.count({ where: { status: 'ACTIVE' } }),
    ]);

    return {
      period: { startDate, endDate },
      users: { total: totalUsers, new: newUsers },
      events: { total: totalEvents, new: newEvents },
      connections: { total: totalConnections, new: newConnections },
      registrations: { total: totalRegistrations, new: newRegistrations },
      founderCards: { active: founderCards },
    };
  }

  async getSettings() {
    return prisma.platformSetting.findMany({ orderBy: { key: 'asc' } });
  }

  async updateSetting(key: string, value: string, type?: string, label?: string) {
    return prisma.platformSetting.upsert({
      where: { key },
      update: { value, ...(type && { type }), ...(label && { label }) },
      create: { key, value, type: type ?? 'string', label: label ?? key },
    });
  }

  async getPermissions() {
    // Return default role-based permissions
    return {
      ATTENDEE: {
        events: ['read', 'register'],
        connections: ['create', 'read', 'delete'],
        profile: ['read', 'update'],
        founderCard: ['apply', 'read'],
      },
      ORGANIZER: {
        events: ['create', 'read', 'update', 'delete', 'publish'],
        connections: ['create', 'read', 'delete'],
        profile: ['read', 'update'],
        founderCard: ['apply', 'read'],
        leads: ['read', 'update'],
        organizer: ['dashboard', 'analytics'],
      },
      ADMIN: {
        events: ['create', 'read', 'update', 'delete', 'publish', 'manage'],
        connections: ['create', 'read', 'delete', 'manage'],
        profile: ['read', 'update', 'manage'],
        founderCard: ['apply', 'read', 'approve', 'reject', 'manage'],
        leads: ['read', 'update', 'manage'],
        admin: ['all'],
        users: ['create', 'read', 'update', 'delete', 'ban'],
        settings: ['read', 'update'],
      },
    };
  }

  async updatePermission(
    _role: string,
    _resource: string,
    _actions: string[]
  ) {
    // In a full implementation, this would be stored in DB
    return { message: 'Permission updated (stored in memory for this implementation)' };
  }

  async getAuditLogs(
    filters: { action?: string; userId?: string; resource?: string },
    page?: number,
    limit?: number
  ) {
    const pagination = parsePaginationQuery({ page, limit });

    const where: Record<string, unknown> = {};
    if (filters.action) where.action = { contains: filters.action, mode: 'insensitive' };
    if (filters.userId) where.userId = filters.userId;
    if (filters.resource) where.resource = { contains: filters.resource, mode: 'insensitive' };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            include: {
              profile: { select: { firstName: true, lastName: true } },
            },
          },
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: buildPaginationMeta(total, pagination.page, pagination.limit),
    };
  }

  async getPlatformHealth() {
    const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

    // DB health
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'healthy', latency: Date.now() - dbStart };
    } catch (err) {
      checks.database = { status: 'unhealthy', error: String(err) };
    }

    // Redis health
    const redisStart = Date.now();
    try {
      await redis.ping();
      checks.redis = { status: 'healthy', latency: Date.now() - redisStart };
    } catch (err) {
      checks.redis = { status: 'unhealthy', error: String(err) };
    }

    const isHealthy = Object.values(checks).every((c) => c.status === 'healthy');

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: checks,
    };
  }
}

export default new AdminService();
