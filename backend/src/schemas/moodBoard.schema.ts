/**
 * Mood Board Validation Schemas
 *
 * Zod schemas for mood board endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// MOOD BOARD SCHEMAS
// ============================================================================

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

export type BulkUpdateMoodBoardItemsInput = z.infer<typeof bulkUpdateMoodBoardItemsSchema>;
