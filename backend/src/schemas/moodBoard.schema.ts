/**
 * Mood Board Validation Schemas
 *
 * Zod schemas for mood board endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// SHARED ENUMS
// ============================================================================

/**
 * mood_boards.status is a plain String column in Prisma (default "DRAFT").
 * Allowed values come from the schema comment + frontend `MoodBoardStatus` union.
 */
export const moodBoardStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']);

/**
 * mood_board_items.itemType is a plain String column in Prisma.
 * Allowed values come from the schema comment + frontend `MoodBoardItemType` union.
 */
export const moodBoardItemTypeEnum = z.enum(['IMAGE', 'COLOR', 'TEXT', 'FABRIC_REF', 'STYLE_REF']);

// ============================================================================
// MOOD BOARD SCHEMAS
// ============================================================================

/**
 * Create Mood Board
 * POST /api/mood-boards
 */
export const createMoodBoardSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255, 'Name must not exceed 255 characters'),
  description: z.string().optional().nullable(),
  seasonId: z.string().uuid('Invalid season ID').optional().nullable(),
  status: moodBoardStatusEnum.optional(),
  canvasWidth: z.coerce.number().int('Canvas width must be an integer').positive().optional(),
  canvasHeight: z.coerce.number().int('Canvas height must be an integer').positive().optional(),
});

/**
 * Update Mood Board
 * PATCH /api/mood-boards/:id
 */
export const updateMoodBoardSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').max(255, 'Name must not exceed 255 characters').optional(),
  description: z.string().optional().nullable(),
  seasonId: z.string().uuid('Invalid season ID').optional().nullable(),
  status: moodBoardStatusEnum.optional(),
  canvasWidth: z.coerce.number().int('Canvas width must be an integer').positive().optional(),
  canvasHeight: z.coerce.number().int('Canvas height must be an integer').positive().optional(),
});

// ============================================================================
// MOOD BOARD ITEM SCHEMAS
// ============================================================================

/**
 * Add Item to Mood Board
 * POST /api/mood-boards/:id/items
 *
 * NOTE: this endpoint accepts BOTH `multipart/form-data` (image upload — every field
 * arrives as a string) and plain JSON (color/text swatches). Hence `z.coerce.number()`.
 * The numbers are deliberately NOT `.int()`: the canvas seeds positions with
 * `100 + Math.random() * 200` (a float) and the controller truncates via `parseInt()`.
 * `imageUrl` is intentionally absent — the controller derives it from `req.file`.
 */
export const createMoodBoardItemSchema = z.object({
  itemType: moodBoardItemTypeEnum,
  colorHex: z.string().max(50, 'Color hex must not exceed 50 characters').optional().nullable(),
  fabricId: z.string().uuid('Invalid fabric ID').optional().nullable(),
  styleId: z.string().uuid('Invalid style ID').optional().nullable(),
  title: z.string().optional().nullable(),
  caption: z.string().optional().nullable(),
  positionX: z.coerce.number().optional(),
  positionY: z.coerce.number().optional(),
  width: z.coerce.number().optional(),
  height: z.coerce.number().optional(),
  rotation: z.coerce.number().optional(),
  zIndex: z.coerce.number().optional(),
});

/**
 * Update Mood Board Item
 * PATCH /api/mood-boards/:id/items/:itemId
 *
 * Values go straight to Prisma Int columns here (no parseInt in the controller),
 * so integers are enforced. The canvas already rounds every value it sends.
 */
export const updateMoodBoardItemSchema = z.object({
  positionX: z.coerce.number().int('positionX must be an integer').optional(),
  positionY: z.coerce.number().int('positionY must be an integer').optional(),
  width: z.coerce.number().int('width must be an integer').positive().optional(),
  height: z.coerce.number().int('height must be an integer').positive().optional(),
  rotation: z.coerce.number().int('rotation must be an integer').optional(),
  zIndex: z.coerce.number().int('zIndex must be an integer').optional(),
  title: z.string().optional().nullable(),
  caption: z.string().optional().nullable(),
  colorHex: z.string().max(50, 'Color hex must not exceed 50 characters').optional().nullable(),
});

/**
 * Bulk Update Mood Board Item Positions
 * POST /api/mood-boards/:id/items/bulk-update
 */
export const bulkUpdateMoodBoardItemsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid('Invalid item ID'),
        positionX: z.number(),
        positionY: z.number(),
        width: z.number().positive().optional(),
        height: z.number().positive().optional(),
        zIndex: z.number().int().optional(),
      })
    )
    .min(1, 'At least one item is required'),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateMoodBoardInput = z.infer<typeof createMoodBoardSchema>;
export type UpdateMoodBoardInput = z.infer<typeof updateMoodBoardSchema>;
export type CreateMoodBoardItemInput = z.infer<typeof createMoodBoardItemSchema>;
export type UpdateMoodBoardItemInput = z.infer<typeof updateMoodBoardItemSchema>;
export type BulkUpdateMoodBoardItemsInput = z.infer<typeof bulkUpdateMoodBoardItemsSchema>;
