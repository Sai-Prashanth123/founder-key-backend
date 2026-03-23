import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import { env } from '@config/env';
import logger from '@utils/logger';

const hasS3Config =
  env.AWS_ACCESS_KEY_ID &&
  env.AWS_SECRET_ACCESS_KEY &&
  env.AWS_S3_BUCKET;

let s3Client: S3Client | null = null;

if (hasS3Config) {
  s3Client = new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

export class MediaService {
  private useS3 = Boolean(hasS3Config);

  async uploadFile(
    buffer: Buffer,
    key: string,
    mimeType: string,
    acl: 'public-read' | 'private' = 'public-read'
  ): Promise<string> {
    if (this.useS3) {
      return this.uploadToS3(buffer, key, mimeType, acl);
    }
    return this.uploadLocal(buffer, key);
  }

  async uploadToS3(
    buffer: Buffer,
    key: string,
    mimeType: string,
    _acl: 'public-read' | 'private' = 'public-read'
  ): Promise<string> {
    if (!s3Client || !env.AWS_S3_BUCKET) {
      throw new Error('S3 is not configured');
    }

    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      })
    );

    return this.getPublicUrl(key);
  }

  async deleteFromS3(key: string): Promise<void> {
    if (!s3Client || !env.AWS_S3_BUCKET) {
      throw new Error('S3 is not configured');
    }

    const objectKey = key.startsWith('http') ? this.extractKeyFromUrl(key) : key;

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: objectKey,
      })
    );
  }

  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    if (!s3Client || !env.AWS_S3_BUCKET) {
      throw new Error('S3 is not configured');
    }

    const command = new GetObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
    });

    return getSignedUrl(s3Client, command, { expiresIn });
  }

  async uploadLocal(buffer: Buffer, filename: string, dir = 'uploads'): Promise<string> {
    const uploadDir = path.join(process.cwd(), dir, path.dirname(filename));

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(process.cwd(), dir, filename);
    await fs.promises.writeFile(filePath, buffer);

    // Return the public URL path
    return `/uploads/${filename}`;
  }

  async deleteLocal(filepath: string): Promise<void> {
    try {
      const localPath = filepath.startsWith('/uploads/')
        ? path.join(process.cwd(), filepath)
        : filepath;

      if (fs.existsSync(localPath)) {
        await fs.promises.unlink(localPath);
      }
    } catch (error) {
      logger.warn('Failed to delete local file', { filepath, error });
    }
  }

  async deleteFile(url: string): Promise<void> {
    if (this.useS3 && url.includes('.amazonaws.com')) {
      await this.deleteFromS3(url);
    } else {
      await this.deleteLocal(url);
    }
  }

  getPublicUrl(key: string): string {
    if (env.AWS_S3_BASE_URL) {
      return `${env.AWS_S3_BASE_URL}/${key}`;
    }
    if (env.AWS_S3_BUCKET && env.AWS_REGION) {
      return `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
    }
    return `/uploads/${key}`;
  }

  private extractKeyFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1); // Remove leading slash
    } catch {
      return url;
    }
  }
}

export default new MediaService();
