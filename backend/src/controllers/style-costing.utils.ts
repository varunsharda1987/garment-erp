import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { logWarn } from '../utils/logger';

// ============================================
// Types for Style Costing Controller
// ============================================

export type StyleCostingWhereInput = Prisma.style_costingWhereInput;

// Type definitions for JSON detail arrays
export interface FabricDetail {
  fabricName: string;
  fabricWidth: number;
  fabricAverage: number;
  fabricRate: number;
  fabricTotal: number;
  isNotApplicable?: boolean;
  fabricId?: string;
  sourcingStrategy?: string;
  processorId?: string;
  greigeCost?: number;
  processingCost?: number;
}

export interface TrimDetail {
  trimName: string;
  trimQuantity: number;
  trimRate: number;
  trimTotal: number;
  isNotApplicable?: boolean;
  // Metadata
  materialType?: string | null;
  unit?: string | null;
  bomId?: string | null;
  // Master FK fields (legacy) - allow null for Prisma compatibility
  materialId?: string | null;
  threadId?: string | null;
  buttonId?: string | null;
  zipperId?: string | null;
  elasticId?: string | null;
  labelId?: string | null;
  packagingId?: string | null;
  // Generic trim FK fields
  hookEyeId?: string | null;
  snapButtonId?: string | null;
  buckleId?: string | null;
  beltId?: string | null;
  velcroId?: string | null;
  drawstringId?: string | null;
  ribbonId?: string | null;
  sequinId?: string | null;
  beadId?: string | null;
  motifId?: string | null;
  interliningId?: string | null;
  paddingId?: string | null;
  otherFastenerId?: string | null;
  otherTapeId?: string | null;
  otherDecorativeId?: string | null;
  otherFunctionalId?: string | null;
  // Generic fallback for NEW material types
  masterId?: string | null;
}

export interface EmbroideryDetail {
  embroideryName: string;
  embroideryAverage: number;
  embroideryRate: number;
  embroideryTotal: number;
  isNotApplicable?: boolean;
}

export interface AccessoryDetail {
  accessoryName: string;
  accessoryQuantity: number;
  accessoryRate: number;
  accessoryTotal: number;
  isNotApplicable?: boolean;
  // Master FK fields - allow null for Prisma compatibility
  id?: string | null;
  labelId?: string | null;
  packagingId?: string | null;
  materialId?: string | null;
  materialType?: string | null;
  // Generic fallback for NEW accessory types
  masterId?: string | null;
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

export const FabricDetailSchema = z
  .object({
    fabricName: z.string().min(1, 'Fabric name is required'),
    fabricWidth: z.number().nonnegative('Fabric width must be non-negative'),
    fabricAverage: z.number().nonnegative('Fabric average must be non-negative'),
    fabricRate: z.number().nonnegative('Fabric rate must be non-negative'),
    fabricTotal: z.number().nonnegative('Fabric total must be non-negative'),
    isNotApplicable: z.boolean().optional().default(false),
    // Sourcing strategy fields (optional)
    fabricId: z.string().optional(),
    sourcingStrategy: z.enum(['STOCK_REUSE', 'READY_FABRIC', 'GREIGE_PROCESSED']).optional(),
    stockLotId: z.string().optional(),
    processorId: z.string().optional(),
    rateCardId: z.string().optional(),
    procurementId: z.string().optional(),
    greigeCost: z.number().optional(),
    processingCost: z.number().optional(),
    isManualOverride: z.boolean().optional(),
    overrideReason: z.string().optional(),
  })
  .refine((data) => data.isNotApplicable || (data.fabricRate > 0 && data.fabricAverage > 0), {
    message: 'Fabric rate and average must be > 0 unless marked as Not Applicable (N/A)',
    path: ['fabricRate'],
  });

export const TrimDetailSchema = z
  .object({
    trimName: z.string().min(1, 'Trim name is required'),
    trimQuantity: z.number().nonnegative('Trim quantity must be non-negative'),
    trimRate: z.number().nonnegative('Trim rate must be non-negative'),
    trimTotal: z.number().nonnegative('Trim total must be non-negative'),
    isNotApplicable: z.boolean().optional().default(false),
    // BOM reference fields (optional)
    unit: z.string().optional(),
    bomId: z.string().optional(),
    materialType: z.string().optional(),
    // Master FK fields - needed for MRP material resolution
    materialId: z.string().uuid().optional().nullable(),
    threadId: z.string().uuid().optional().nullable(),
    buttonId: z.string().uuid().optional().nullable(),
    zipperId: z.string().uuid().optional().nullable(),
    elasticId: z.string().uuid().optional().nullable(),
    labelId: z.string().uuid().optional().nullable(),
    packagingId: z.string().uuid().optional().nullable(),
    hookEyeId: z.string().uuid().optional().nullable(),
    snapButtonId: z.string().uuid().optional().nullable(),
    buckleId: z.string().uuid().optional().nullable(),
    beltId: z.string().uuid().optional().nullable(),
    velcroId: z.string().uuid().optional().nullable(),
    drawstringId: z.string().uuid().optional().nullable(),
    ribbonId: z.string().uuid().optional().nullable(),
    sequinId: z.string().uuid().optional().nullable(),
    beadId: z.string().uuid().optional().nullable(),
    motifId: z.string().uuid().optional().nullable(),
    interliningId: z.string().uuid().optional().nullable(),
    paddingId: z.string().uuid().optional().nullable(),
    otherFastenerId: z.string().uuid().optional().nullable(),
    otherTapeId: z.string().uuid().optional().nullable(),
    otherDecorativeId: z.string().uuid().optional().nullable(),
    otherFunctionalId: z.string().uuid().optional().nullable(),
    // Generic fallback for NEW material types (no dedicated FK column needed)
    masterId: z.string().uuid().optional().nullable(),
  })
  .refine((data) => data.isNotApplicable || (data.trimRate > 0 && data.trimQuantity > 0), {
    message: 'Trim rate and quantity must be > 0 unless marked as Not Applicable (N/A)',
    path: ['trimRate'],
  });

export const EmbroideryDetailSchema = z
  .object({
    embroideryName: z.string().min(1, 'Embroidery name is required'),
    embroideryAverage: z.number().nonnegative('Embroidery average must be non-negative'),
    embroideryRate: z.number().nonnegative('Embroidery rate must be non-negative'),
    embroideryTotal: z.number().nonnegative('Embroidery total must be non-negative'),
    isNotApplicable: z.boolean().optional().default(false),
  })
  .refine((data) => data.isNotApplicable || (data.embroideryRate > 0 && data.embroideryAverage > 0), {
    message: 'Embroidery rate and average must be > 0 unless marked as Not Applicable (N/A)',
    path: ['embroideryRate'],
  });

export const AccessoryDetailSchema = z
  .object({
    accessoryName: z.string().min(1, 'Accessory name is required'),
    accessoryQuantity: z.number().nonnegative('Accessory quantity must be non-negative'),
    accessoryRate: z.number().nonnegative('Accessory rate must be non-negative'),
    accessoryTotal: z.number().nonnegative('Accessory total must be non-negative'),
    isNotApplicable: z.boolean().optional().default(false),
    // Master FK fields - needed for MRP material resolution
    id: z.string().uuid().optional(),
    labelId: z.string().uuid().optional().nullable(),
    packagingId: z.string().uuid().optional().nullable(),
    materialId: z.string().uuid().optional().nullable(),
    materialType: z.string().optional().nullable(),
    // Generic fallback for NEW accessory types
    masterId: z.string().uuid().optional().nullable(),
  })
  .refine((data) => data.isNotApplicable || (data.accessoryRate > 0 && data.accessoryQuantity > 0), {
    message: 'Accessory rate and quantity must be > 0 unless marked as Not Applicable (N/A)',
    path: ['accessoryRate'],
  });

/**
 * Safely parse a Prisma JSON column as a typed array using Zod validation.
 * Logs a warning if the stored data doesn't match the expected schema,
 * instead of silently double-casting (as unknown as Type[]).
 */
export function parseJsonArray<T>(value: unknown, schema: z.ZodType<T>, fieldName: string): T[] {
  if (!value || !Array.isArray(value)) {
    if (value !== null && value !== undefined) {
      logWarn(
        `[CostSheet] JSON column '${fieldName}' expected an array but got ${typeof value}. Returning empty array. This may indicate corrupted data — check the cost sheet record.`
      );
    }
    return [];
  }
  const results: T[] = [];
  for (let i = 0; i < value.length; i++) {
    const parsed = schema.safeParse(value[i]);
    if (parsed.success) {
      results.push(parsed.data);
    } else {
      logWarn(
        `[CostSheet] JSON column '${fieldName}' item[${i}] failed validation: ${parsed.error.issues.map((e) => e.message).join(', ')}. Item will be included as-is but may have invalid data.`
      );
      results.push(value[i] as T);
    }
  }
  return results;
}

export const CMTCostsSchema = z.object({
  cuttingCost: z.number().nonnegative('Cutting cost must be non-negative').default(0),
  stitchingCost: z.number().nonnegative('Stitching cost must be non-negative').default(0),
  finishingCost: z.number().nonnegative('Finishing cost must be non-negative').default(0),
  buttonAttachmentCost: z.number().nonnegative('Button attachment cost must be non-negative').default(0),
  handworkCost: z.number().nonnegative('Handwork cost must be non-negative').default(0),
  smockingCost: z.number().nonnegative('Smocking cost must be non-negative').default(0),
});

// Lace Detail Schema - for lace items in cost sheet
export const LaceDetailSchema = z.object({
  laceName: z.string().min(1, 'Lace name is required'),
  laceWidth: z.number().nonnegative('Lace width must be non-negative'),
  laceAverage: z.number().nonnegative('Lace average must be non-negative'),
  laceRate: z.number().nonnegative('Lace rate must be non-negative'),
  laceTotal: z.number().nonnegative('Lace total must be non-negative'),
  // The controller reads lace.wastagePercent; it was omitted here so validateBody stripped it and
  // lace wastage was silently lost (bug-hunt F5).
  wastagePercent: z.number().min(0).max(100).optional(),
  isNotApplicable: z.boolean().optional().default(false),
  // Master FK fields - needed for PO generation
  laceId: z.string().uuid().optional().nullable(),
  greigeLaceId: z.string().uuid().optional().nullable(),
  processorId: z.string().uuid().optional().nullable(),
  rateCardId: z.string().uuid().optional().nullable(),
  // Canonical value is GREIGE_PROCESSED — matches the frontend (LaceCostingRow/Section), the
  // canonical LaceSourcingStrategyEnum, and costSheetPOGeneration's `=== 'GREIGE_PROCESSED'` check.
  // The old rogue 'GREIGE_LACE_PROCESSED' never matched, so greige-lace never generated its
  // greige/dyeing POs (bug-hunt F5).
  sourcingStrategy: z.enum(['STOCK_REUSE', 'READY_LACE', 'GREIGE_PROCESSED']).optional(),
  // Cost breakdown
  greigeCost: z.number().optional(),
  processingCost: z.number().optional(),
});

export const CreateCostSheetSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),

  // Cost Sheet Purpose/Mode
  purpose: z.enum(['COSTING', 'RAW_MATERIAL_CALCULATION', 'PRODUCTION']).default('COSTING'),

  // Basic Information
  numberOfComponents: z.number().int().positive().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),

  // Dynamic arrays
  fabricDetails: z.array(FabricDetailSchema).min(1, 'At least one fabric is required'),
  trimsDetails: z.array(TrimDetailSchema).min(1, 'At least one trim is required'),
  laceDetails: z.array(LaceDetailSchema).optional().default([]),
  cmtCosts: CMTCostsSchema,
  embroideryDetails: z.array(EmbroideryDetailSchema).default([]),
  accessoriesDetails: z.array(AccessoryDetailSchema).default([]),

  // Value Loss & Markup
  valueLossPercent: z.number().min(0).max(100, 'Value loss must be between 0-100%').default(2),
  markupPercent: z.number().min(0).max(100, 'Markup must be between 0-100%').default(15),

  // Additional fields
  notes: z.string().optional(),

  // Closed Cost - Final agreed price with customer (exclusive of tax)
  closedCost: z.number().positive('Closed cost must be positive').optional().nullable(),
  closedCostNotes: z.string().optional().nullable(),

  // ==========================================
  // Budget Fields (for RAW_MATERIAL_CALCULATION/PRODUCTION direct procurement)
  // ==========================================
  enableBudgetTracking: z.boolean().optional().default(false),
  fabricBudget: z.number().nonnegative('Fabric budget must be non-negative').optional(),
  trimsBudget: z.number().nonnegative('Trims budget must be non-negative').optional(),
  cmtBudget: z.number().nonnegative('CMT budget must be non-negative').optional(),
  embroideryBudget: z.number().nonnegative('Embroidery budget must be non-negative').optional(),
  accessoriesBudget: z.number().nonnegative('Accessories budget must be non-negative').optional(),
  totalBudget: z.number().nonnegative('Total budget must be non-negative').optional(),

  // Buffer Percentages (defaults applied if budget tracking enabled)
  fabricBufferPercent: z.number().min(0).max(100).optional(),
  trimsBufferPercent: z.number().min(0).max(100).optional(),
  cmtBufferPercent: z.number().min(0).max(100).optional(),
  embroideryBufferPercent: z.number().min(0).max(100).optional(),
  accessoriesBufferPercent: z.number().min(0).max(100).optional(),

  // Order Linking (optional - for direct procurement tracking)
  orderId: z.string().uuid('Invalid order ID').optional(),
  orderItemId: z.string().uuid('Invalid order item ID').optional(),
});

export const UpdateCostSheetSchema = CreateCostSheetSchema.partial().omit({ styleId: true });
