import { z } from 'zod';

export const updateUserSchema = z.object({
  role: z.enum(['ATTENDEE', 'ORGANIZER', 'ADMIN']).optional(),
  tier: z.enum(['FREE', 'FOUNDER']).optional(),
  isActive: z.boolean().optional(),
  isEmailVerified: z.boolean().optional(),
});

export const updateSettingsSchema = z.object({
  value: z.string().min(0),
  type: z.enum(['string', 'number', 'boolean', 'json']).optional(),
  label: z.string().optional(),
});

export const updatePermissionSchema = z.object({
  role: z.enum(['ATTENDEE', 'ORGANIZER', 'ADMIN']),
  resource: z.string().min(1),
  actions: z.array(z.string()),
});

export const banUserSchema = z.object({
  reason: z.string().min(1, 'Ban reason is required').max(500),
});

export const adminGetUsersSchema = z.object({
  role: z.enum(['ATTENDEE', 'ORGANIZER', 'ADMIN']).optional(),
  tier: z.enum(['FREE', 'FOUNDER']).optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const adminGetEventsSchema = z.object({
  status: z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED']).optional(),
  organizerId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const analyticsDateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  period: z.enum(['7d', '30d', '90d', '1y']).optional().default('30d'),
});

export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;
export type UpdatePermissionDto = z.infer<typeof updatePermissionSchema>;
export type BanUserDto = z.infer<typeof banUserSchema>;
