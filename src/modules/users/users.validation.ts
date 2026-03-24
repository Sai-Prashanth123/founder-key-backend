import { z } from 'zod';

export const updateProfileSchema = z.object({
  firstName: z.string().min(2).max(50).trim().optional(),
  lastName: z.string().min(2).max(50).trim().optional(),
  phone: z.string().max(20).trim().optional(),
  bio: z.string().max(500, 'Bio must be under 500 characters').trim().optional(),
  company: z.string().max(100).trim().optional(),
  position: z.string().max(100).trim().optional(),
  location: z.string().max(100).trim().optional(),
  skills: z
    .array(z.string().max(50).trim())
    .max(20, 'You can add up to 20 skills')
    .optional(),
  interests: z
    .array(z.string().max(50).trim())
    .max(20, 'You can add up to 20 interests')
    .optional(),
  lookingFor: z
    .array(z.string().max(50).trim())
    .max(10, 'You can add up to 10 looking-for items')
    .optional(),
  socialLinks: z
    .object({
      twitter: z.string().url().optional().or(z.literal('')),
      linkedin: z.string().url().optional().or(z.literal('')),
      website: z.string().url().optional().or(z.literal('')),
      instagram: z.string().url().optional().or(z.literal('')),
    })
    .optional(),
});

export const searchUsersSchema = z.object({
  q: z.string().max(100).optional(),
  skills: z.string().optional(),
  company: z.string().max(100).optional(),
  role: z.enum(['ATTENDEE', 'ORGANIZER', 'ADMIN']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
export type SearchUsersDto = z.infer<typeof searchUsersSchema>;
