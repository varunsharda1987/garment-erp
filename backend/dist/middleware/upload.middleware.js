"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupOldTempFiles = exports.cleanupTempFile = exports.uploadImportFile = exports.uploadStyleImage = void 0;
// Image upload middleware using multer
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
// Directory paths
const uploadDir = path_1.default.join(__dirname, '../../uploads/styles');
const tempImportDir = path_1.default.join(__dirname, '../../uploads/temp');
// Create upload directories if they don't exist
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
if (!fs_1.default.existsSync(tempImportDir)) {
    fs_1.default.mkdirSync(tempImportDir, { recursive: true });
}
// Storage configuration
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `style-${uniqueSuffix}${path_1.default.extname(file.originalname)}`);
    },
});
// File filter - only allow JPG and PNG
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
        return cb(null, true);
    }
    else {
        cb(new Error('Only JPG and PNG images are allowed'));
    }
};
// Export multer upload middleware for style images
exports.uploadStyleImage = (0, multer_1.default)({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter,
}).single('image');
// Disk storage for CSV/Excel import (prevents memory exhaustion with large files)
const importStorage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, tempImportDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `import-${uniqueSuffix}${path_1.default.extname(file.originalname)}`);
    },
});
// File filter for CSV and Excel files
const importFileFilter = (req, file, cb) => {
    const allowedTypes = /csv|xlsx|xls/;
    const extname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
    const mimetypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    const mimetype = mimetypes.includes(file.mimetype);
    if (mimetype && extname) {
        return cb(null, true);
    }
    else {
        cb(new Error('Only CSV and Excel files are allowed'));
    }
};
// Export multer upload middleware for CSV/Excel imports
exports.uploadImportFile = (0, multer_1.default)({
    storage: importStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: importFileFilter,
}).single('file');
/**
 * Cleanup temp import file after processing
 * Call this after import is complete (success or failure)
 */
const cleanupTempFile = (filePath) => {
    if (filePath && fs_1.default.existsSync(filePath)) {
        try {
            fs_1.default.unlinkSync(filePath);
        }
        catch (error) {
            // Log error but don't throw - cleanup is best effort
            console.error('Failed to cleanup temp file:', filePath, error);
        }
    }
};
exports.cleanupTempFile = cleanupTempFile;
/**
 * Cleanup all temp files older than specified hours
 * Can be called periodically or on server startup
 */
const cleanupOldTempFiles = (maxAgeHours = 24) => {
    if (!fs_1.default.existsSync(tempImportDir))
        return;
    const files = fs_1.default.readdirSync(tempImportDir);
    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    files.forEach((file) => {
        const filePath = path_1.default.join(tempImportDir, file);
        try {
            const stats = fs_1.default.statSync(filePath);
            if (now - stats.mtimeMs > maxAgeMs) {
                fs_1.default.unlinkSync(filePath);
            }
        }
        catch (error) {
            // Ignore errors for individual files
        }
    });
};
exports.cleanupOldTempFiles = cleanupOldTempFiles;
