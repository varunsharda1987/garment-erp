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
const issueScreenshotDir = path.join(__dirname, '../../uploads/issue-screenshots');
const buyerPoDocumentDir = path.join(__dirname, '../../uploads/po-documents');
const companyAssetDir = path.join(__dirname, '../../uploads/company');

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
if (!fs.existsSync(issueScreenshotDir)) {
  fs.mkdirSync(issueScreenshotDir, { recursive: true });
}
if (!fs.existsSync(buyerPoDocumentDir)) {
  fs.mkdirSync(buyerPoDocumentDir, { recursive: true });
}
if (!fs.existsSync(companyAssetDir)) {
  fs.mkdirSync(companyAssetDir, { recursive: true });
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

// ============================================
// COMPANY BRANDING (logo + authorised signature)
// ============================================

const companyAssetStorage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, companyAssetDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // 'logo' | 'signature' — the multer field name, so the two never collide on disk.
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const companyAssetFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Only JPG, PNG and WEBP images are allowed'));
};

/** Factory so logo and signature share config but keep distinct field names. */
const companyAssetUpload = (field: 'logo' | 'signature') =>
  multer({
    storage: companyAssetStorage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB — these are embedded in every PDF
    fileFilter: companyAssetFilter,
  }).single(field);

const wrapCompanyAsset =
  (field: 'logo' | 'signature') =>
  (req: Request, res: Response, next: NextFunction): void => {
    companyAssetUpload(field)(req, res, (err: unknown) => {
      if (!err) {
        next();
        return;
      }
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          next(new ValidationError('Image is too large. Maximum size is 2MB.'));
          return;
        }
        next(new ValidationError(err.message));
        return;
      }
      next(new ValidationError(err instanceof Error ? err.message : 'Image upload failed'));
    });
  };

export const uploadCompanyLogo = wrapCompanyAsset('logo');
export const uploadCompanySignature = wrapCompanyAsset('signature');

// ============================================
// ISSUE REPORT SCREENSHOTS (PNG/JPG/WEBP)
// ============================================

const issueScreenshotStorage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, issueScreenshotDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // Pasted clipboard images arrive as "image.png" — extname still resolves correctly
    cb(null, `issue-${uniqueSuffix}${path.extname(file.originalname) || '.png'}`);
  },
});

const issueScreenshotFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExtensions = /jpeg|jpg|png|webp/;
  const extname =
    allowedExtensions.test(path.extname(file.originalname).toLowerCase()) || !path.extname(file.originalname);
  const allowedMimetypes = ['image/jpeg', 'image/png', 'image/webp'];
  const mimetype = allowedMimetypes.includes(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only PNG, JPG, and WEBP images are allowed'));
  }
};

const issueScreenshotUpload = multer({
  storage: issueScreenshotStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: issueScreenshotFilter,
}).single('screenshot');

/**
 * Multer upload for issue-report screenshots.
 * Wrapped like uploadCadFile so rejections surface as 400 with the real reason.
 */
export const uploadIssueScreenshot = (req: Request, res: Response, next: NextFunction): void => {
  issueScreenshotUpload(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        next(new ValidationError('Screenshot is too large. Maximum size is 5MB.'));
        return;
      }
      next(new ValidationError(err.message));
      return;
    }
    next(new ValidationError(err instanceof Error ? err.message : 'Screenshot upload failed'));
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

// ============================================
// LACE IMAGE UPLOAD (JPG/PNG/WEBP)
// ============================================

const laceImageDir = path.join(__dirname, '../../uploads/lace-images');

if (!fs.existsSync(laceImageDir)) {
  fs.mkdirSync(laceImageDir, { recursive: true });
}

const laceImageStorage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, laceImageDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `lace-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const laceImageFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExtensions = /jpeg|jpg|png|webp/;
  const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
  const allowedMimetypes = ['image/jpeg', 'image/png', 'image/webp'];
  const mimetype = allowedMimetypes.includes(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, and WEBP images are allowed'));
  }
};

const laceImageUpload = multer({
  storage: laceImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: laceImageFilter,
}).single('image');

/**
 * Multer upload for lace images.
 * Wrapped so rejections surface as 400 with the real reason.
 */
export const uploadLaceImage = (req: Request, res: Response, next: NextFunction): void => {
  laceImageUpload(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        next(new ValidationError('Image is too large. Maximum size is 5MB.'));
        return;
      }
      next(new ValidationError(err.message));
      return;
    }
    next(new ValidationError(err instanceof Error ? err.message : 'Image upload failed'));
  });
};

/**
 * Delete a lace image file from disk
 */
export const deleteLaceImageFile = (fileUrl: string): void => {
  const fileName = path.basename(fileUrl);
  const filePath = path.join(laceImageDir, fileName);

  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      logger.error('Failed to delete lace image:', filePath, error);
    }
  }
};

// ============================================
// BUYER PO DOCUMENTS (PDF/JPG/PNG)
// ============================================
//
// The customer's own purchase order, attached to a sale_order_buyer_pos row.
//
// Unlike every other directory here, /uploads/po-documents is NOT world-readable: app.ts mounts
// createFileAccessMiddleware('authenticated') on that prefix, because a buyer PO carries prices and
// terms. Do not "simplify" that by setting FILE_ACCESS_MODE globally — it would 401 every style
// image, CAD file and lace image in the app.

const buyerPoDocumentStorage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, buyerPoDocumentDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `po-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// A buyer PO arrives as a PDF, or as a photo/scan of one.
const buyerPoDocumentFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
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

const buyerPoDocumentUpload = multer({
  storage: buyerPoDocumentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: buyerPoDocumentFilter,
}).single('file');

/**
 * Multer upload for a buyer PO document.
 *
 * Wrapped like `uploadCadFile` so a bad type or an oversize file surfaces as a 400 naming the
 * reason. Raw multer hands a plain Error to next(), which the global handler reports as a 500
 * "An unexpected error occurred" — telling the user nothing about what they did wrong.
 */
export const uploadBuyerPoDocument = (req: Request, res: Response, next: NextFunction): void => {
  buyerPoDocumentUpload(req, res, (err: unknown) => {
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
 * Delete a buyer PO document from disk.
 *
 * `path.basename` is load-bearing, not tidiness: it strips any directory part, so a crafted
 * `../../` in a stored URL cannot reach outside the PO directory.
 */
export const deleteBuyerPoDocumentFile = (fileUrl: string): void => {
  const fileName = path.basename(fileUrl);
  const filePath = path.join(buyerPoDocumentDir, fileName);

  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      logger.error('Failed to delete buyer PO document:', filePath, error);
    }
  }
};
