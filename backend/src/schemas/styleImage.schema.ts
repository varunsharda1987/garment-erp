/**
 * Style Image Validation Schemas
 *
 * Zod schemas for style gallery functionality.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

// Matches the Prisma `StyleImageType` enum and the frontend StyleImageType union
// (frontend/src/types/styleImage.types.ts) value-for-value. Anything outside this list is rejected by
// Postgres, so validating against it turns a 500 into a 400.
//
// NOTE: this replaces a drifted `ImageTypeEnum` (FRONT/BACK/DETAIL/FLAT/SKETCH/TECH_PACK/SAMPLE) that
// shared only MAIN and OTHER with the database. updateImageSchema validated against those invented
// values, so changing an image's type to any REAL type returned 400 — image-type editing was broken.
export const StyleImageTypeEnum = z.enum([
  'MAIN',
  'SKETCH_FRONT',
  'SKETCH_BACK',
  'SKETCH_SIDE',
  'TECHNICAL_FLAT',
  'DETAIL_VIEW',
  'CONSTRUCTION',
  'OTHER',
]);

// ============================================================================
// STYLE IMAGE SCHEMAS
// ============================================================================

/**
 * Upload Image — MULTIPART (multipart/form-data)
 * POST /api/styles/:styleId/images
 *
 * ⚠ This body is parsed by multer (`uploadStyleImage`, .single('image')), so validateBody MUST be
 * mounted AFTER it. The IMAGE ITSELF lives on `req.file` and is never part of req.body — this schema
 * only covers the two text fields the controller destructures (`imageType`, `caption`).
 *
 * Both are optional: the frontend appends each field only when it has a value, and imageType falls
 * back to the Prisma column default (OTHER). Multipart text fields always arrive as STRINGS, and an
 * empty string is normalised to undefined so a blank form field does not fail the enum/length check.
 * The whole body is normalised from undefined/null to {} so a file-only upload cannot 400.
 */
export const uploadImageSchema = z.preprocess(
  (body) => (body === undefined || body === null ? {} : body),
  z.object({
    imageType: z.preprocess((v) => (v === '' || v === null ? undefined : v), StyleImageTypeEnum.optional()),
    caption: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.string().max(200).optional()),
  })
);

/**
 * Update Image
 * PATCH /api/styles/:styleId/images/:imageId
 */
export const updateImageSchema = z.object({
  imageType: StyleImageTypeEnum.optional(),
  caption: z.string().max(200).optional().nullable(),
  isMain: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

/**
 * Reorder Images
 * POST /api/styles/:styleId/images/reorder
 */
// `imageIds`, not `orderedIds` — the controller and the drag-drop UI both send `imageIds`.
// The mismatched name 400'd every reorder.
export const reorderImagesSchema = z.object({
  imageIds: z.array(z.string().uuid()).min(1, 'At least one image ID is required'),
});

// ============================================================================
// Type Exports
// ============================================================================

export type UploadImageInput = z.infer<typeof uploadImageSchema>;
export type UpdateImageInput = z.infer<typeof updateImageSchema>;
export type ReorderImagesInput = z.infer<typeof reorderImagesSchema>;
