// Image upload middleware using multer
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { Request } from 'express';

// Directory paths
const uploadDir = path.join(__dirname, '../../uploads/styles');
const tempImportDir = path.join(__dirname, '../../uploads/temp');

// Create upload directories if they don't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(tempImportDir)) {
  fs.mkdirSync(tempImportDir, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, uploadDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `style-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// File filter - only allow JPG and PNG
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only JPG and PNG images are allowed'));
  }
};

// Export multer upload middleware for style images
export const uploadStyleImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter,
}).single('image');

// Disk storage for CSV/Excel import (prevents memory exhaustion with large files)
const importStorage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, tempImportDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `import-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// File filter for CSV and Excel files
const importFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /csv|xlsx|xls/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  const mimetype = mimetypes.includes(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only CSV and Excel files are allowed'));
  }
};

// Export multer upload middleware for CSV/Excel imports
export const uploadImportFile = multer({
  storage: importStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: importFileFilter,
}).single('file');

/**
 * Cleanup temp import file after processing
 * Call this after import is complete (success or failure)
 */
export const cleanupTempFile = (filePath: string): void => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      // Log error but don't throw - cleanup is best effort
      logger.error('Failed to cleanup temp file:', filePath, error);
    }
  }
};

/**
 * Cleanup all temp files older than specified hours
 * Can be called periodically or on server startup
 */
export const cleanupOldTempFiles = (maxAgeHours: number = 24): void => {
  if (!fs.existsSync(tempImportDir)) return;

  const files = fs.readdirSync(tempImportDir);
  const now = Date.now();
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

  files.forEach((file) => {
    const filePath = path.join(tempImportDir, file);
    try {
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      // Ignore errors for individual files
    }
  });
};
