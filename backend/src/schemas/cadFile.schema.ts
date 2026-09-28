/**
 * CAD File (Mini Marker) Validation Schemas
 */
import { z } from 'zod';
import { CadPurposeEnum } from './generated/prisma-enums';

// Schema for uploading a mini marker file
export const uploadCadFileSchema = z.object({
  purpose: CadPurposeEnum,
});

// POST /api/cad-planning/:styleId/row/:rowId/marker — the image itself is the multipart file; no fields
export const attachMarkerImageSchema = z.object({});

// POST /api/cad-planning/:styleId/row/:rowId/marker/link — use an image already uploaded for the style
export const linkMarkerImageSchema = z.object({
  fileId: z.string().uuid("Choose one of the style's CAD images"),
});

// Schema for reordering mini markers (future use)
export const reorderCadFilesSchema = z.object({
  purpose: CadPurposeEnum,
  fileIds: z.array(z.string().uuid()).min(1),
});

// Schema for purpose parameter in URL
export const cadPurposeParamSchema = z.object({
  purpose: CadPurposeEnum,
});

// Combined param schema for styleId + purpose
export const styleIdAndPurposeParamSchema = z.object({
  styleId: z.string().uuid(),
  purpose: CadPurposeEnum,
});

// Combined param schema for styleId + fileId
export const styleIdAndFileIdParamSchema = z.object({
  styleId: z.string().uuid(),
  fileId: z.string().uuid(),
});
