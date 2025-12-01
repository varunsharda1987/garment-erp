/**
 * File Cleanup Service
 *
 * Handles cleanup of orphaned files when records are deleted.
 * Also provides scheduled cleanup for files not linked to any records.
 */

import fs from 'fs';
import path from 'path';
import prisma from '../config/database';
import { logInfo, logError, logDebug } from '../utils/logger';

// Upload directories
const UPLOAD_DIRS = {
  styles: path.join(__dirname, '../../uploads/styles'),
  temp: path.join(__dirname, '../../uploads/temp'),
};

/**
 * Delete a file from the filesystem
 * @param filePath - Absolute path or relative path from uploads directory
 */
export function deleteFile(filePath: string): boolean {
  if (!filePath) return false;

  // Handle both absolute and relative paths
  let absolutePath = filePath;
  if (!path.isAbsolute(filePath)) {
    // If it's a URL path like /uploads/styles/file.jpg, convert to filesystem path
    if (filePath.startsWith('/uploads/')) {
      absolutePath = path.join(__dirname, '../..', filePath);
    } else {
      absolutePath = path.join(UPLOAD_DIRS.styles, filePath);
    }
  }

  try {
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
      logDebug(`Deleted file: ${absolutePath}`);
      return true;
    }
    return false;
  } catch (error) {
    logError(`Failed to delete file: ${absolutePath}`, error);
    return false;
  }
}

/**
 * Delete style image when style is deleted
 * @param imageUrl - The image URL stored in the style record
 */
export function deleteStyleImage(imageUrl: string | null | undefined): boolean {
  if (!imageUrl) return false;
  return deleteFile(imageUrl);
}

/**
 * Cleanup orphaned style images
 * Finds image files in the styles directory that are not referenced by any style record
 */
export async function cleanupOrphanedStyleImages(): Promise<{ deleted: number; errors: number }> {
  const result = { deleted: 0, errors: 0 };

  try {
    if (!fs.existsSync(UPLOAD_DIRS.styles)) {
      return result;
    }

    // Get all files in the styles upload directory
    const files = fs.readdirSync(UPLOAD_DIRS.styles);

    if (files.length === 0) {
      return result;
    }

    // Get all image URLs from the database
    const styles = await prisma.styles.findMany({
      select: { image: true, imageUrl: true },
    });

    // Create a set of referenced image filenames
    const referencedFiles = new Set<string>();
    styles.forEach((style) => {
      if (style.image) {
        // Extract filename from path/URL
        const filename = path.basename(style.image);
        referencedFiles.add(filename);
      }
      if (style.imageUrl) {
        const filename = path.basename(style.imageUrl);
        referencedFiles.add(filename);
      }
    });

    // Delete orphaned files
    for (const file of files) {
      if (!referencedFiles.has(file)) {
        const filePath = path.join(UPLOAD_DIRS.styles, file);
        try {
          // Check if it's actually a file (not a directory)
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            fs.unlinkSync(filePath);
            result.deleted++;
            logDebug(`Deleted orphaned style image: ${file}`);
          }
        } catch (error) {
          result.errors++;
          logError(`Failed to delete orphaned file: ${file}`, error);
        }
      }
    }

    if (result.deleted > 0) {
      logInfo(`Cleaned up ${result.deleted} orphaned style images`);
    }

    return result;
  } catch (error) {
    logError('Error during orphaned style image cleanup:', error);
    throw error;
  }
}

/**
 * Cleanup old temp files
 * Removes temporary files older than the specified age
 * @param maxAgeHours - Maximum age in hours (default 24)
 */
export function cleanupOldTempFiles(maxAgeHours: number = 24): { deleted: number; errors: number } {
  const result = { deleted: 0, errors: 0 };

  if (!fs.existsSync(UPLOAD_DIRS.temp)) {
    return result;
  }

  const files = fs.readdirSync(UPLOAD_DIRS.temp);
  const now = Date.now();
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

  for (const file of files) {
    const filePath = path.join(UPLOAD_DIRS.temp, file);
    try {
      const stats = fs.statSync(filePath);
      if (stats.isFile() && now - stats.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath);
        result.deleted++;
      }
    } catch (error) {
      result.errors++;
    }
  }

  if (result.deleted > 0) {
    logInfo(`Cleaned up ${result.deleted} old temp files`);
  }

  return result;
}

/**
 * Run all cleanup tasks
 * Can be called on a schedule or manually
 */
export async function runAllCleanupTasks(): Promise<{
  styleImages: { deleted: number; errors: number };
  tempFiles: { deleted: number; errors: number };
}> {
  logInfo('Running file cleanup tasks...');

  const styleImages = await cleanupOrphanedStyleImages();
  const tempFiles = cleanupOldTempFiles(24);

  logInfo('File cleanup complete', { styleImages, tempFiles });

  return { styleImages, tempFiles };
}

export default {
  deleteFile,
  deleteStyleImage,
  cleanupOrphanedStyleImages,
  cleanupOldTempFiles,
  runAllCleanupTasks,
};
