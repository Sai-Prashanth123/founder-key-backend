import { Request, Response } from 'express';
import mediaService from './media.service';
import { sendSuccess } from '@utils/response';
import { BadRequestError } from '@utils/errors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export class MediaController {
  async uploadFile(req: Request, res: Response): Promise<void> {
    if (!req.file) {
      throw new BadRequestError('File is required');
    }

    if (!req.file.buffer) {
      throw new BadRequestError('File buffer is missing');
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    const key = `media/${req.user!.userId}/${filename}`;

    const url = await mediaService.uploadFile(req.file.buffer, key, req.file.mimetype);

    sendSuccess(
      res,
      { url, filename, key, mimeType: req.file.mimetype, size: req.file.size },
      'File uploaded successfully'
    );
  }

  async deleteFile(req: Request, res: Response): Promise<void> {
    const { key } = req.params as Record<string, string>;
    if (!key) throw new BadRequestError('File key is required');

    // Ensure user can only delete their own files
    const decodedKey = decodeURIComponent(key);
    if (!decodedKey.includes(req.user!.userId) && req.user!.role !== 'ADMIN') {
      throw new BadRequestError('You do not have permission to delete this file');
    }

    await mediaService.deleteFile(decodedKey);
    sendSuccess(res, null, 'File deleted successfully');
  }

  async getPresignedUrl(req: Request, res: Response): Promise<void> {
    const { key } = req.params as Record<string, string>;
    const { expiresIn } = req.query as { expiresIn?: string };

    const url = await mediaService.getPresignedUrl(
      decodeURIComponent(key),
      expiresIn ? Number(expiresIn) : 3600
    );

    sendSuccess(res, { url, expiresIn: expiresIn ? Number(expiresIn) : 3600 }, 'Presigned URL generated');
  }
}

export default new MediaController();
