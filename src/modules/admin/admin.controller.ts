import { Request, Response } from 'express';
import adminService from './admin.service';
import { sendSuccess, sendPaginated } from '@utils/response';
import { UpdateUserDto, BanUserDto } from './admin.validation';

export class AdminController {
  async getDashboard(req: Request, res: Response): Promise<void> {
    const stats = await adminService.getDashboardStats();
    sendSuccess(res, stats, 'Dashboard stats retrieved');
  }

  async getUsers(req: Request, res: Response): Promise<void> {
    const { role, tier, isActive, search, page, limit } = req.query as {
      role?: string;
      tier?: string;
      isActive?: string;
      search?: string;
      page?: string;
      limit?: string;
    };

    const result = await adminService.getUsers(
      {
        role,
        tier,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        search,
      },
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined
    );
    sendPaginated(res, result.users, result.pagination, 'Users retrieved');
  }

  async getUserDetail(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const user = await adminService.getUserDetail(id);
    sendSuccess(res, user, 'User retrieved');
  }

  async updateUser(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const dto = req.body as UpdateUserDto;
    const user = await adminService.updateUser(id, dto);
    sendSuccess(res, user, 'User updated');
  }

  async deleteUser(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    await adminService.deleteUser(id);
    sendSuccess(res, null, 'User deleted');
  }

  async banUser(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const dto = req.body as BanUserDto;
    const result = await adminService.banUser(id, dto.reason);
    sendSuccess(res, result, 'User banned');
  }

  async getEvents(req: Request, res: Response): Promise<void> {
    const { status, organizerId, search, page, limit } = req.query as {
      status?: string;
      organizerId?: string;
      search?: string;
      page?: string;
      limit?: string;
    };

    const result = await adminService.getEvents(
      { status, organizerId, search },
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined
    );
    sendPaginated(res, result.events, result.pagination, 'Events retrieved');
  }

  async updateEvent(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const event = await adminService.updateEvent(id, req.body as Record<string, unknown>);
    sendSuccess(res, event, 'Event updated');
  }

  async deleteEvent(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    await adminService.deleteEvent(id);
    sendSuccess(res, null, 'Event deleted');
  }

  async getAnalytics(req: Request, res: Response): Promise<void> {
    const { startDate, endDate, period } = req.query as {
      startDate?: string;
      endDate?: string;
      period?: string;
    };

    const analytics = await adminService.getAnalytics({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      period,
    });
    sendSuccess(res, analytics, 'Analytics retrieved');
  }

  async getSettings(req: Request, res: Response): Promise<void> {
    const settings = await adminService.getSettings();
    sendSuccess(res, settings, 'Settings retrieved');
  }

  async updateSetting(req: Request, res: Response): Promise<void> {
    const { key } = req.params;
    const { value, type, label } = req.body as { value: string; type?: string; label?: string };
    const setting = await adminService.updateSetting(key, value, type, label);
    sendSuccess(res, setting, 'Setting updated');
  }

  async getPermissions(req: Request, res: Response): Promise<void> {
    const permissions = await adminService.getPermissions();
    sendSuccess(res, permissions, 'Permissions retrieved');
  }

  async updatePermission(req: Request, res: Response): Promise<void> {
    const { role, resource, actions } = req.body as {
      role: string;
      resource: string;
      actions: string[];
    };
    const result = await adminService.updatePermission(role, resource, actions);
    sendSuccess(res, result, 'Permission updated');
  }

  async getAuditLogs(req: Request, res: Response): Promise<void> {
    const { action, userId, resource, page, limit } = req.query as {
      action?: string;
      userId?: string;
      resource?: string;
      page?: string;
      limit?: string;
    };

    const result = await adminService.getAuditLogs(
      { action, userId, resource },
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined
    );
    sendPaginated(res, result.logs, result.pagination, 'Audit logs retrieved');
  }

  async getHealth(req: Request, res: Response): Promise<void> {
    const health = await adminService.getPlatformHealth();
    sendSuccess(res, health, 'Platform health retrieved');
  }
}

export default new AdminController();
