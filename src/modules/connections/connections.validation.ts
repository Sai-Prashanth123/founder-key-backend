import { z } from 'zod';

export const sendConnectionSchema = z.object({
  receiverId: z.string().uuid('Invalid receiver ID'),
});

export const respondConnectionSchema = z.object({
  action: z.enum(['ACCEPT', 'REJECT'], {
    errorMap: () => ({ message: 'Action must be ACCEPT or REJECT' }),
  }),
});

export const scanQRSchema = z.object({
  qrData: z.string().min(1, 'QR data is required'),
});

export type SendConnectionDto = z.infer<typeof sendConnectionSchema>;
export type RespondConnectionDto = z.infer<typeof respondConnectionSchema>;
export type ScanQRDto = z.infer<typeof scanQRSchema>;
