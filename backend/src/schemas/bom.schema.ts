/**
 * Bill of Materials (BOM) Validation Schemas
 *
 * Zod schemas for BOM management endpoints.
 */

import { z } from 'zod';
import { flexMaterialId } from './common.schema';
import { MaterialTypeEnum } from './generated/prisma-enums';

// BOM status enum
export const BOMStatus = z.enum(['Draft', 'Pending', 'Approved', 'Rejected', 'Active', 'Obsolete']);

// BOM line item schema
const bomLineItemSchema = z.object({
  materialId: flexMaterialId('material ID'),
  // Import from generated prisma-enums to ensure alignment with Prisma schema
  materialType: MaterialTypeEnum,
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().min(1).max(20),
  wastage: z.number().min(0).max(100).default(0),
  notes: z.string().max(500).optional(),
  sequence: z.number().int().nonnegative().optional(),
});

// Create BOM schema
export const createBOMSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  variantId: z.string().uuid('Invalid variant ID').optional(),
  version: z.string().max(20).default('1.0'),
  status: BOMStatus.default('Draft'),
  effectiveDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  description: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  lineItems: z.array(bomLineItemSchema).min(1, 'At least one line item is required'),
});

// Update BOM schema
export const updateBOMSchema = createBOMSchema.partial().extend({
  id: z.string().uuid(),
});

// Update BOM status schema
export const updateBOMStatusSchema = z.object({
  id: z.string().uuid(),
  status: BOMStatus,
  reason: z.string().max(500).optional(),
});

// Clone BOM schema
export const cloneBOMSchema = z.object({
  sourceId: z.string().uuid(),
  targetStyleId: z.string().uuid().optional(),
  targetVariantId: z.string().uuid().optional(),
  newVersion: z.string().max(20).optional(),
});

// BOM query params schema
export const bomQuerySchema = z.object({
  styleId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  status: BOMStatus.optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type CreateBOMInput = z.infer<typeof createBOMSchema>;
export type UpdateBOMInput = z.infer<typeof updateBOMSchema>;
export type UpdateBOMStatusInput = z.infer<typeof updateBOMStatusSchema>;
export type CloneBOMInput = z.infer<typeof cloneBOMSchema>;
export type BOMQueryInput = z.infer<typeof bomQuerySchema>;
