/**
 * CAD File Controller (Mini Markers)
 * Handles HTTP requests for mini marker file attachments
 */
import { Request, Response } from 'express';
import { cadFileService } from '../services/cad-file.service';
import { ValidationError } from '../errors';
import { CadPurpose } from '@prisma/client';

/**
 * Request with multer file upload
 */
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

/**
 * Upload a new mini marker file
 * POST /api/cad-planning/:styleId/mini-markers
 */
export const uploadMiniMarker = async (req: MulterRequest, res: Response): Promise<void> => {
  const { styleId } = req.params;
  const { purpose } = req.body;

  if (!req.file) {
    throw new ValidationError('File is required');
  }

  if (!purpose) {
    throw new ValidationError('Purpose is required (COSTING, RAW_MATERIAL_CALCULATION, or PRODUCTION)');
  }

  const fileUrl = `/uploads/cad-files/${req.file.filename}`;

  const file = await cadFileService.create(
    styleId,
    purpose as CadPurpose,
    {
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
    },
    req.user?.userId
  );

  res.status(201).json({
    data: file,
    message: 'Mini marker uploaded successfully',
  });
};

/**
 * Get all mini markers for a style (grouped by purpose)
 * GET /api/cad-planning/:styleId/mini-markers
 */
export const getMiniMarkers = async (req: Request, res: Response): Promise<void> => {
  const { styleId } = req.params;
  const grouped = await cadFileService.getAllByStyle(styleId);

  res.status(200).json({
    data: grouped,
  });
};

/**
 * Get mini markers for a specific purpose
 * GET /api/cad-planning/:styleId/mini-markers/:purpose
 */
export const getMiniMarkersByPurpose = async (req: Request, res: Response): Promise<void> => {
  const { styleId, purpose } = req.params;
  const files = await cadFileService.getByPurpose(styleId, purpose as CadPurpose);

  res.status(200).json({
    data: files,
  });
};

/**
 * Get mini marker count for a style
 * GET /api/cad-planning/:styleId/mini-marker-count
 */
export const getMiniMarkerCount = async (req: Request, res: Response): Promise<void> => {
  const { styleId } = req.params;
  const count = await cadFileService.getCount(styleId);

  res.status(200).json({
    data: { count },
  });
};

/**
 * Delete a mini marker file
 * DELETE /api/cad-planning/:styleId/mini-markers/:fileId
 */
export const deleteMiniMarker = async (req: Request, res: Response): Promise<void> => {
  const { styleId, fileId } = req.params;
  await cadFileService.delete(styleId, fileId);

  res.status(200).json({
    message: 'Mini marker deleted successfully',
  });
};

/**
 * Reorder mini markers within a purpose
 * POST /api/cad-planning/:styleId/mini-markers/reorder
 */
export const reorderMiniMarkers = async (req: Request, res: Response): Promise<void> => {
  const { styleId } = req.params;
  const { purpose, fileIds } = req.body;

  if (!Array.isArray(fileIds)) {
    throw new ValidationError('fileIds must be an array');
  }

  const files = await cadFileService.reorder(styleId, purpose as CadPurpose, fileIds);

  res.status(200).json({
    data: files,
    message: 'Mini markers reordered successfully',
  });
};
