/**
 * Storage Configuration
 *
 * Supports two storage providers:
 * 1. Local - Files stored on disk (for development)
 * 2. Spaces - DigitalOcean Spaces with CDN (for production)
 *
 * Configuration (in .env):
 *   STORAGE_PROVIDER=local|spaces
 *
 *   # For DigitalOcean Spaces:
 *   DO_SPACES_ENDPOINT=blr1.digitaloceanspaces.com
 *   DO_SPACES_BUCKET=garment-erp-uploads
 *   DO_SPACES_REGION=blr1
 *   DO_SPACES_KEY=your-access-key
 *   DO_SPACES_SECRET=your-secret-key
 *   DO_SPACES_CDN_URL=https://garment-erp-uploads.blr1.cdn.digitaloceanspaces.com
 */

export type StorageProvider = 'local' | 'spaces';

export interface SpacesConfig {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  cdnUrl: string;
}

export interface LocalConfig {
  uploadDir: string;
  publicUrl: string;
}

export interface StorageConfig {
  provider: StorageProvider;
  spaces: SpacesConfig;
  local: LocalConfig;
}

/**
 * Get storage configuration from environment variables
 */
export function getStorageConfig(): StorageConfig {
  const provider = (process.env.STORAGE_PROVIDER || 'local') as StorageProvider;

  return {
    provider,

    spaces: {
      endpoint: process.env.DO_SPACES_ENDPOINT || 'blr1.digitaloceanspaces.com',
      bucket: process.env.DO_SPACES_BUCKET || 'garment-erp-uploads',
      region: process.env.DO_SPACES_REGION || 'blr1',
      accessKeyId: process.env.DO_SPACES_KEY || '',
      secretAccessKey: process.env.DO_SPACES_SECRET || '',
      cdnUrl: process.env.DO_SPACES_CDN_URL || '',
    },

    local: {
      uploadDir: './uploads',
      publicUrl: '/uploads',
    },
  };
}

/**
 * Check if Spaces is properly configured
 */
export function isSpacesConfigured(): boolean {
  const config = getStorageConfig();
  return (
    config.provider === 'spaces' &&
    !!config.spaces.accessKeyId &&
    !!config.spaces.secretAccessKey &&
    !!config.spaces.bucket
  );
}

/**
 * Get the public URL for a file based on storage provider
 *
 * @param key File key/path (e.g., 'styles/style-123.jpg')
 * @returns Full public URL
 */
export function getPublicUrl(key: string): string {
  const config = getStorageConfig();

  if (config.provider === 'spaces' && config.spaces.cdnUrl) {
    // Use CDN URL for Spaces
    return `${config.spaces.cdnUrl}/${key}`;
  } else if (config.provider === 'spaces') {
    // Fallback to direct Spaces URL
    return `https://${config.spaces.bucket}.${config.spaces.endpoint}/${key}`;
  } else {
    // Local storage
    return `${config.local.publicUrl}/${key}`;
  }
}

export default getStorageConfig;
