// Image upload middleware using multer
import logger from '../utils/logger';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../errors';

// Directory paths
const uploadDir = path.join(__dirname, '../../uploads/styles');
const tempImportDir = path.join(__dirname, '../../uploads/temp');
const cadUploadDir = path.join(__dirname, '../../uploads/cad-files');

// Create upload directories if they don't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(tempImportDir)) {
  fs.mkdirSync(tempImportDir, { recursive: true });
}
if (!fs.existsSync(cadUploadDir)) {
  fs.mkdirSync(cadUploadDir, { recursive: true });
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

// ============================================
// CAD FILE UPLOAD (Mini Markers - PDF/JPG/PNG)
// ============================================

// Storage configuration for CAD files
const cadStorage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, cadUploadDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `cad-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// File filter for CAD files - allow PDF, JPG, PNG
const cadFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExtensions = /jpeg|jpg|png|pdf/;
  const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
  const allowedMimetypes = ['image/jpeg', 'image/png', 'application/pdf'];
  const mimetype = allowedMimetypes.includes(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, and PDF files are allowed'));
  }
};

const cadUpload = multer({
  storage: cadStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: cadFileFilter,
}).single('file');

/**
 * Multer upload for CAD files (mini markers).
 *
 * Wraps multer so rejections (bad file type, size limit) surface as a 400 with the
 * real reason. Raw multer passes a plain Error to next(), which the global handler
 * reports as a 500 "An unexpected error occurred" — hiding why the upload failed.
 */
export const uploadCadFile = (req: Request, res: Response, next: NextFunction): void => {
  cadUpload(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        next(new ValidationError('File is too large. Maximum size is 10MB.'));
        return;
      }
      next(new ValidationError(err.message));
      return;
    }
    next(new ValidationError(err instanceof Error ? err.message : 'File upload failed'));
  });
};

/**
 * Delete a CAD file from disk
 */
export const deleteCadFile = (fileUrl: string): void => {
  // fileUrl is like /uploads/cad-files/cad-123456789.pdf
  const fileName = path.basename(fileUrl);
  const filePath = path.join(cadUploadDir, fileName);

  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      logger.error('Failed to delete CAD file:', filePath, error);
    }
  }
};
