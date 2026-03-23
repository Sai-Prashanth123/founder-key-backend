import { z } from 'zod';

export const applyCardSchema = z.object({
  message: z
    .string()
    .max(500, 'Application message must be under 500 characters')
    .trim()
    .optional(),
});

export const updateCardStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'DEACTIVATED', 'REJECTED']),
  reason: z.string().max(500).trim().optional(),
});

export type ApplyCardDto = z.infer<typeof applyCardSchema>;
export type UpdateCardStatusDto = z.infer<typeof updateCardStatusSchema>;
