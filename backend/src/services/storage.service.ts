/**
 * Storage Service
 *
 * Handles file uploads to either local disk or DigitalOcean Spaces.
 * Provides a unified interface for storing and retrieving files.
 *
 * Usage:
 *   const storageService = new StorageService();
 *   const url = await storageService.uploadFile(buffer, 'styles/image.jpg', 'image/jpeg');
 *   await storageService.deleteFile('styles/image.jpg');
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getStorageConfig, getPublicUrl, isSpacesConfigured } from '../config/storage';
import path from 'path';
import fs from 'fs';
import { logInfo, logError, logDebug } from '../utils/logger';

export class StorageService {
  private s3Client: S3Client | null = null;
  private config = getStorageConfig();

  constructor() {
    if (this.config.provider === 'spaces' && isSpacesConfigured()) {
      this.initializeS3Client();
    }
  }

  /**
   * Initialize S3 client for DigitalOcean Spaces
   */
  private initializeS3Client(): void {
    try {
      this.s3Client = new S3Client({
        endpoint: `https://${this.config.spaces.endpoint}`,
        region: this.config.spaces.region,
        credentials: {
          accessKeyId: this.config.spaces.accessKeyId,
          secretAccessKey: this.config.spaces.secretAccessKey,
        },
        forcePathStyle: false, // Required for DigitalOcean Spaces
      });
      logInfo('[StorageService] S3 client initialized for DigitalOcean Spaces');
    } catch (error) {
      logError('[StorageService] Failed to initialize S3 client:', error);
      throw error;
    }
  }

  /**
   * Upload a file to storage
   *
   * @param buffer File buffer
   * @param key Storage key (path) e.g., 'styles/style-123.jpg'
   * @param contentType MIME type e.g., 'image/jpeg'
   * @returns Public URL of the uploaded file
   */
  async uploadFile(buffer: Buffer, key: string, contentType: string): Promise<string> {
    if (this.config.provider === 'spaces' && this.s3Client) {
      return this.uploadToSpaces(buffer, key, contentType);
    } else {
      return this.uploadToLocal(buffer, key);
    }
  }

  /**
   * Upload file to DigitalOcean Spaces
   */
  private async uploadToSpaces(buffer: Buffer, key: string, contentType: string): Promise<string> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    const command = new PutObjectCommand({
      Bucket: this.config.spaces.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read', // Make files publicly accessible
      CacheControl: 'max-age=31536000', // 1 year cache
    });

    try {
      await this.s3Client.send(command);
      const url = getPublicUrl(key);
      logDebug(`[StorageService] Uploaded to Spaces: ${url}`);
      return url;
    } catch (error) {
      logError(`[StorageService] Failed to upload to Spaces: ${key}`, error);
      throw error;
    }
  }

  /**
   * Upload file to local storage
   */
  private async uploadToLocal(buffer: Buffer, key: string): Promise<string> {
    const localPath = path.join(__dirname, '..', this.config.local.uploadDir, key);
    const dir = path.dirname(localPath);

    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    try {
      fs.writeFileSync(localPath, buffer);
      const url = getPublicUrl(key);
      logDebug(`[StorageService] Uploaded to local: ${url}`);
      return url;
    } catch (error) {
      logError(`[StorageService] Failed to upload to local: ${key}`, error);
      throw error;
    }
  }

  /**
   * Delete a file from storage
   *
   * @param key Storage key (path) e.g., 'styles/style-123.jpg'
   */
  async deleteFile(key: string): Promise<void> {
    if (this.config.provider === 'spaces' && this.s3Client) {
      return this.deleteFromSpaces(key);
    } else {
      return this.deleteFromLocal(key);
    }
  }

  /**
   * Delete file from DigitalOcean Spaces
   */
  private async deleteFromSpaces(key: string): Promise<void> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    const command = new DeleteObjectCommand({
      Bucket: this.config.spaces.bucket,
      Key: key,
    });

    try {
      await this.s3Client.send(command);
      logDebug(`[StorageService] Deleted from Spaces: ${key}`);
    } catch (error) {
      logError(`[StorageService] Failed to delete from Spaces: ${key}`, error);
      throw error;
    }
  }

  /**
   * Delete file from local storage
   */
  private async deleteFromLocal(key: string): Promise<void> {
    const localPath = path.join(__dirname, '..', this.config.local.uploadDir, key);

    try {
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
        logDebug(`[StorageService] Deleted from local: ${key}`);
      }
    } catch (error) {
      logError(`[StorageService] Failed to delete from local: ${key}`, error);
      throw error;
    }
  }

  /**
   * Check if a file exists in storage
   *
   * @param key Storage key (path)
   * @returns true if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    if (this.config.provider === 'spaces' && this.s3Client) {
      try {
        const command = new HeadObjectCommand({
          Bucket: this.config.spaces.bucket,
          Key: key,
        });
        await this.s3Client.send(command);
        return true;
      } catch {
        return false;
      }
    } else {
      const localPath = path.join(__dirname, '..', this.config.local.uploadDir, key);
      return fs.existsSync(localPath);
    }
  }

  /**
   * Get the storage provider being used
   */
  getProvider(): string {
    return this.config.provider;
  }

  /**
   * Check if storage is properly configured
   */
  isConfigured(): boolean {
    if (this.config.provider === 'spaces') {
      return isSpacesConfigured();
    }
    return true; // Local storage is always available
  }
}

// Singleton instance
let storageServiceInstance: StorageService | null = null;

/**
 * Get the storage service singleton
 */
export function getStorageService(): StorageService {
  if (!storageServiceInstance) {
    storageServiceInstance = new StorageService();
  }
  return storageServiceInstance;
}

export default StorageService;
