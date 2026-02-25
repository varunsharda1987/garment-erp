/**
 * Migrate Images to DigitalOcean Spaces
 *
 * This script:
 * 1. Scans existing images in backend/uploads/styles/
 * 2. Uploads each image to DigitalOcean Spaces
 * 3. Updates database URLs to use CDN URLs
 *
 * Usage:
 *   npx ts-node scripts/deployment/migrate-images-to-spaces.ts
 *
 * Prerequisites:
 *   - Configure .env with DO_SPACES_* variables
 *   - Set STORAGE_PROVIDER=spaces
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

// Configuration
const LOCAL_UPLOAD_DIR = path.join(__dirname, '../../backend/uploads/styles');
const BATCH_SIZE = 10; // Process 10 images at a time

interface MigrationStats {
  total: number;
  uploaded: number;
  skipped: number;
  failed: number;
  dbUpdated: number;
}

async function main() {
  console.log('============================================');
  console.log('  Image Migration to DigitalOcean Spaces');
  console.log('============================================');
  console.log('');

  // Validate configuration
  const config = {
    endpoint: process.env.DO_SPACES_ENDPOINT,
    bucket: process.env.DO_SPACES_BUCKET,
    region: process.env.DO_SPACES_REGION,
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
    cdnUrl: process.env.DO_SPACES_CDN_URL,
  };

  if (!config.accessKeyId || !config.secretAccessKey || !config.bucket) {
    console.error('ERROR: Missing DigitalOcean Spaces configuration.');
    console.error('Required env vars: DO_SPACES_KEY, DO_SPACES_SECRET, DO_SPACES_BUCKET');
    process.exit(1);
  }

  // Initialize S3 client
  const s3Client = new S3Client({
    endpoint: `https://${config.endpoint}`,
    region: config.region || 'blr1',
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: false,
  });

  // Check if local upload directory exists
  if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
    console.error(`ERROR: Upload directory not found: ${LOCAL_UPLOAD_DIR}`);
    process.exit(1);
  }

  // Get list of local image files
  const files = fs.readdirSync(LOCAL_UPLOAD_DIR).filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
  });

  console.log(`Found ${files.length} images to migrate`);
  console.log('');

  const stats: MigrationStats = {
    total: files.length,
    uploaded: 0,
    skipped: 0,
    failed: 0,
    dbUpdated: 0,
  };

  // Process in batches
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(files.length / BATCH_SIZE)}...`);

    await Promise.all(
      batch.map(async (file) => {
        try {
          const key = `styles/${file}`;
          const localPath = path.join(LOCAL_UPLOAD_DIR, file);

          // Check if already exists in Spaces
          try {
            await s3Client.send(
              new HeadObjectCommand({
                Bucket: config.bucket,
                Key: key,
              })
            );
            console.log(`  SKIP: ${file} (already exists)`);
            stats.skipped++;
            return;
          } catch {
            // File doesn't exist, continue with upload
          }

          // Read file
          const fileBuffer = fs.readFileSync(localPath);
          const contentType = getContentType(file);

          // Upload to Spaces
          await s3Client.send(
            new PutObjectCommand({
              Bucket: config.bucket,
              Key: key,
              Body: fileBuffer,
              ContentType: contentType,
              ACL: 'public-read',
              CacheControl: 'max-age=31536000',
            })
          );

          console.log(`  UPLOADED: ${file}`);
          stats.uploaded++;
        } catch (error) {
          console.error(`  FAILED: ${file}`, error);
          stats.failed++;
        }
      })
    );
  }

  console.log('');
  console.log('Updating database URLs...');

  // Update database URLs
  try {
    const cdnBaseUrl = config.cdnUrl || `https://${config.bucket}.${config.endpoint}`;

    // Update styles table
    const updateResult = await prisma.$executeRaw`
      UPDATE styles
      SET image = REPLACE(image, '/uploads/styles/', ${cdnBaseUrl + '/styles/'})
      WHERE image LIKE '/uploads/styles/%'
    `;

    stats.dbUpdated = updateResult;
    console.log(`Updated ${updateResult} style records`);

    // Also update imageUrl field if it exists
    await prisma.$executeRaw`
      UPDATE styles
      SET "imageUrl" = REPLACE("imageUrl", '/uploads/styles/', ${cdnBaseUrl + '/styles/'})
      WHERE "imageUrl" LIKE '/uploads/styles/%'
    `;
  } catch (error) {
    console.error('Error updating database:', error);
  }

  // Print summary
  console.log('');
  console.log('============================================');
  console.log('  Migration Summary');
  console.log('============================================');
  console.log(`  Total files:    ${stats.total}`);
  console.log(`  Uploaded:       ${stats.uploaded}`);
  console.log(`  Skipped:        ${stats.skipped}`);
  console.log(`  Failed:         ${stats.failed}`);
  console.log(`  DB Updated:     ${stats.dbUpdated}`);
  console.log('============================================');

  if (stats.failed > 0) {
    console.log('');
    console.log('WARNING: Some files failed to upload. Re-run the script to retry.');
  }

  if (stats.uploaded > 0 || stats.dbUpdated > 0) {
    console.log('');
    console.log('NEXT STEPS:');
    console.log('1. Verify images load correctly from CDN');
    console.log('2. Test the application');
    console.log('3. Once verified, delete local images:');
    console.log(`   rm -rf ${LOCAL_UPLOAD_DIR}/*`);
  }

  await prisma.$disconnect();
}

function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const types: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return types[ext] || 'application/octet-stream';
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
