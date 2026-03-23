import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import sharp from 'sharp';
import { BadRequestError } from '@utils/errors';
import { UPLOAD } from '@config/constants';
import { env } from '@config/env';

const MAX_SIZE = (env.UPLOAD_MAX_SIZE_MB || 5) * 1024 * 1024;
const ALLOWED_TYPES = (
  env.UPLOAD_ALLOWED_TYPES || 'image/jpeg,image/jpg,image/png,image/webp,image/gif'
).split(',');

const ensureUploadDir = (dir: string): void => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const diskStorage = multer.diskStorage({
  destination: (req: Request, _file: Express.Multer.File, cb) => {
    const uploadPath = path.join(process.cwd(), 'uploads', 'temp');
    ensureUploadDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const memoryStorage = multer.memoryStorage();

const imageFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestError(`File type not allowed. Allowed types: ${ALLOWED_TYPES.join(', ')}`));
  }
};

const multerDiskConfig = multer({
  storage: diskStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: MAX_SIZE,
    files: 10,
  },
});

const multerMemoryConfig = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: MAX_SIZE,
    files: 10,
  },
});

export const uploadSingle = (fieldName: string) => multerMemoryConfig.single(fieldName);

export const uploadMultiple = (fieldName: string, maxCount: number) =>
  multerMemoryConfig.array(fieldName, maxCount);

export const uploadFields = (fields: Array<{ name: string; maxCount?: number }>) =>
  multerMemoryConfig.fields(fields);

export const uploadDiskSingle = (fieldName: string) => multerDiskConfig.single(fieldName);

export const processImage = async (
  buffer: Buffer,
  width?: number,
  height?: number,
  format: 'jpeg' | 'png' | 'webp' = 'jpeg'
): Promise<Buffer> => {
  let pipeline = sharp(buffer);

  if (width || height) {
    pipeline = pipeline.resize(
      width ?? UPLOAD.AVATAR_SIZE,
      height ?? UPLOAD.AVATAR_SIZE,
      {
        fit: 'cover',
        position: 'center',
        withoutEnlargement: true,
      }
    );
  }

  if (format === 'jpeg') {
    pipeline = pipeline.jpeg({ quality: 85, progressive: true });
  } else if (format === 'webp') {
    pipeline = pipeline.webp({ quality: 85 });
  } else if (format === 'png') {
    pipeline = pipeline.png({ compressionLevel: 8 });
  }

  return pipeline.toBuffer();
};

export const processAvatar = async (buffer: Buffer): Promise<Buffer> => {
  return processImage(buffer, UPLOAD.AVATAR_SIZE, UPLOAD.AVATAR_SIZE, 'jpeg');
};

export const processCoverImage = async (buffer: Buffer): Promise<Buffer> => {
  return processImage(buffer, UPLOAD.COVER_WIDTH, UPLOAD.COVER_HEIGHT, 'jpeg');
};
