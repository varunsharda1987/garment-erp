/**
 * CAD File Controller (Mini Markers)
 * Handles HTTP requests for mini marker file attachments
 */
import { Request, Response } from 'express';
import { cadFileService, type MarkerImageResult } from '../services/cad-file.service';
import { ValidationError } from '../errors';
import { CadPurpose } from '@prisma/client';
import { deleteCadFile } from '../middleware/upload.middleware';
import prisma from '../config/database';
import { markerSummariesForStyle } from '../services/helpers/cad-marker.helper';

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

// ---------------------------------------------------------------------------
// A CAD row's marker image — read by the marker reader, checked by cad-marker.helper
// ---------------------------------------------------------------------------

/**
 * Every CAD row of the style with its marker image state (the CAD table's CAD image column)
 * GET /api/cad-planning/:styleId/row-markers
 */
export const getRowMarkers = async (req: Request, res: Response): Promise<void> => {
  const { styleId } = req.params;
  res.status(200).json({ data: await markerSummariesForStyle(prisma, styleId) });
};

/**
 * A refused upload leaves no file on disk — unless it was stored first: an image an approved row did not take
 * (it differs from the row) stays in the style's images for Correct… to use.
 */
async function dropOrphanUpload(fileUrl: string): Promise<void> {
  if ((await prisma.cad_purpose_files.count({ where: { fileUrl } })) === 0) deleteCadFile(fileUrl);
}

function markerMessage(result: MarkerImageResult): string {
  switch (result.summary?.state) {
    case 'MATCHES':
      return 'Marker image read — the row matches it';
    case 'UNUSED':
      return result.file.readStatus === 'READ' || result.file.readStatus === 'PARTIAL'
        ? 'Marker image read — click Use these values to fill the row'
        : 'The image was kept, but it could not be read — type the values; saving will ask for a reason';
    case 'DIFFERS':
    case 'EXPLAINED':
      return result.file.readStatus === 'READ' || result.file.readStatus === 'PARTIAL'
        ? 'Marker image read — check the values it gives before saving'
        : 'The image was kept, but it could not be read — saving will ask for a reason';
    default:
      return 'Marker image saved';
  }
}

/**
 * Upload a CAD row's marker image; it is read at once (about 10 seconds)
 * POST /api/cad-planning/:styleId/row/:rowId/marker
 */
export const attachMarkerImage = async (req: MulterRequest, res: Response): Promise<void> => {
  const { styleId, rowId } = req.params;
  if (!req.file) {
    throw new ValidationError('Choose the marker image to upload (JPG, PNG or PDF)');
  }
  const fileUrl = `/uploads/cad-files/${req.file.filename}`;
  let result: MarkerImageResult;
  try {
    result = await cadFileService.attachToRow(
      styleId,
      rowId,
      { fileUrl, fileName: req.file.originalname, fileSize: req.file.size },
      req.user?.userId
    );
  } catch (error) {
    await dropOrphanUpload(fileUrl); // refused before it was stored (other style…) — no orphan file on disk
    throw error;
  }
  res.status(201).json({ data: result, message: markerMessage(result) });
};

/**
 * Upload the corrected marker's image for Correct CAD — read now, the row's marker once the correction applies
 * POST /api/cad-planning/:styleId/row/:rowId/correction/marker
 */
export const attachCorrectionMarker = async (req: MulterRequest, res: Response): Promise<void> => {
  const { styleId, rowId } = req.params;
  if (!req.file) {
    throw new ValidationError('Choose the corrected marker image (JPG, PNG or PDF)');
  }
  const fileUrl = `/uploads/cad-files/${req.file.filename}`;
  try {
    const result = await cadFileService.uploadForCorrection(
      styleId,
      rowId,
      { fileUrl, fileName: req.file.originalname, fileSize: req.file.size },
      req.user?.userId
    );
    res.status(201).json({ data: result, message: 'Marker image read' });
  } catch (error) {
    await dropOrphanUpload(fileUrl);
    throw error;
  }
};

/**
 * Correct CAD with an image already uploaded for the style — read if it never was
 * POST /api/cad-planning/:styleId/row/:rowId/correction/marker/link
 */
export const linkCorrectionMarker = async (req: Request, res: Response): Promise<void> => {
  const { styleId, rowId } = req.params;
  const result = await cadFileService.linkForCorrection(styleId, rowId, req.body.fileId, req.user?.userId);
  res.status(200).json({ data: result, message: 'Marker image read' });
};

/**
 * Use an image already uploaded for the style as a CAD row's marker
 * POST /api/cad-planning/:styleId/row/:rowId/marker/link
 */
export const linkMarkerImage = async (req: Request, res: Response): Promise<void> => {
  const { styleId, rowId } = req.params;
  const result = await cadFileService.linkToRow(styleId, rowId, req.body.fileId, req.user?.userId);
  res.status(200).json({ data: result, message: markerMessage(result) });
};

/**
 * Read a CAD row's marker image again
 * POST /api/cad-planning/:styleId/row/:rowId/marker/reread
 */
export const rereadMarkerImage = async (req: Request, res: Response): Promise<void> => {
  const { styleId, rowId } = req.params;
  const result = await cadFileService.rereadForRow(styleId, rowId, req.user?.userId);
  res.status(200).json({ data: result, message: markerMessage(result) });
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
