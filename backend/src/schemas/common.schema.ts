/**
 * Common Validation Schemas
 *
 * Reusable Zod schemas for common URL parameters across all modules.
 * These are the SINGLE SOURCE OF TRUTH for param validation.
 */

import { z } from 'zod';

// ============================================================================
// Shared Enums (SINGLE SOURCE OF TRUTH — must match Prisma enums)
// ============================================================================

/**
 * Unit — must list EVERY value in the Prisma `Unit` enum (schema.prisma).
 * Previously PO / GRN / unified-PO each had a different partial subset, so
 * creating a PO/GRN with PAIR/PACK/GRAM/LITER/ROLL returned 400. Keep this the
 * single shared enum for all PO/GRN/unified-PO unit fields.
 */
export const UnitEnum = z.enum([
  'METER',
  'PIECE',
  'KILOGRAM',
  'SET',
  'YARD',
  'DOZEN',
  'GROSS',
  'TUBE',
  'CONE',
  'SPOOL',
  'BOX',
  'PAIR',
  'PACK',
  'GRAM',
  'LITER',
  'ROLL',
]);

export type Unit = z.infer<typeof UnitEnum>;

// ============================================================================
// Common ID Param Schemas
// ============================================================================

export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID'),
});

// For tables whose PK is @default(cuid()) (e.g. embroidery_master, color_master): a UUID-only param
// schema rejects every real record (bug-hunt samples-embroidery-4).
export const flexIdParamSchema = z.object({
  id: z
    .string()
    .refine(
      (val) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || /^c[a-z0-9]{20,}$/i.test(val),
      { message: 'Invalid ID (expected UUID or CUID)' }
    ),
});

// Cost sheet ID format: CS-{timestamp}-{randomString} (not UUID)
export const costSheetIdAsIdParamSchema = z.object({
  id: z.string().regex(/^CS-\d+-[a-z0-9]+$/i, 'Invalid cost sheet ID format'),
});

export const batchIdParamSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
});

export const stageIdParamSchema = z.object({
  stageId: z.string().uuid('Invalid stage ID'),
});

export const processorIdParamSchema = z.object({
  processorId: z.string().uuid('Invalid processor ID'),
});

export const styleIdParamSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
});

export const workOrderIdParamSchema = z.object({
  workOrderId: z.string().uuid('Invalid work order ID'),
});

export const orderIdParamSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
});

export const fabricIdParamSchema = z.object({
  fabricId: z.string().uuid('Invalid fabric ID'),
});

export const embroideryIdParamSchema = z.object({
  // embroidery_master PKs are cuid, not uuid — a uuid-only check rejected every real record (bug-hunt s-e-4)
  embroideryId: z
    .string()
    .refine(
      (val) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || /^c[a-z0-9]{20,}$/i.test(val),
      { message: 'Invalid embroidery ID (expected UUID or CUID)' }
    ),
});

export const managerIdParamSchema = z.object({
  managerId: z.string().uuid('Invalid manager ID'),
});

export const layIdParamSchema = z.object({
  layId: z.string().uuid('Invalid lay ID'),
});

// Composite param schemas (for routes with multiple params)
export const idAndLayIdParamSchema = z.object({
  id: z.string().uuid('Invalid ID'),
  layId: z.string().uuid('Invalid lay ID'),
});

export const materialCodeParamSchema = z.object({
  materialCode: z.string().min(1, 'Material code is required'),
});

export const optionIdParamSchema = z.object({
  optionId: z.string().uuid('Invalid option ID'),
});

export const runIdParamSchema = z.object({
  runId: z.string().uuid('Invalid run ID'),
});

export const costSheetIdParamSchema = z.object({
  costSheetId: z.string().uuid('Invalid cost sheet ID'),
});

export const supplierIdParamSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID'),
});

export const poIdParamSchema = z.object({
  poId: z.string().uuid('Invalid PO ID'),
});

export const sourceParamSchema = z.object({
  source: z.string().min(1, 'Source is required'),
});

export const idAndItemIdParamSchema = z.object({
  id: z.string().uuid('Invalid ID'),
  itemId: z.string().uuid('Invalid item ID'),
});

export const materialIdParamSchema = z.object({
  // materials.id is app-supplied: UUIDs for most, 'mat-<code>' for quick-added trims
  // (mat-btn-0001 etc.) — UUID-strict here 400'd every trim material lookup.
  materialId: z.string().min(1, 'Material ID is required').max(100),
});

// Body-field variant of the same rule. DELIBERATELY permissive — do NOT tighten to .uuid():
// even after the 2026-08 id-unification (mat-* ids migrated to master uuids), materials.id
// legitimately includes code-shaped legacy greige ids (FAB-RAW-…, allowlisted orphans) and
// some flows pass the 'auto-thread' sentinel. The FK constraint rejects garbage with P2003;
// format-validation here only creates false 400s. See materialIdParamSchema above.
export const flexMaterialId = (label = 'material ID') => z.string().min(1, `${label} is required`).max(100);

export const customerIdParamSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
});

export const typeParamSchema = z.object({
  type: z.string().min(1, 'Type is required'),
});

export const keyParamSchema = z.object({
  key: z.string().min(1, 'Key is required'),
});

export const warehouseIdParamSchema = z.object({
  warehouseId: z.string().uuid('Invalid warehouse ID'),
});

export const materialTypeParamSchema = z.object({
  materialType: z.string().min(1, 'Material type is required'),
});

export const countIdParamSchema = z.object({
  countId: z.string().uuid('Invalid count ID'),
});

export const countIdAndItemIdParamSchema = z.object({
  countId: z.string().uuid('Invalid count ID'),
  itemId: z.string().uuid('Invalid item ID'),
});

export const codeParamSchema = z.object({
  code: z.string().min(1, 'Code is required').max(10, 'Code must be at most 10 characters'),
});

export const rowIdParamSchema = z.object({
  rowId: z.string().uuid('Invalid row ID'),
});

export const cadIdParamSchema = z.object({
  cadId: z.string().uuid('Invalid CAD ID'),
});

export const greigeIdParamSchema = z.object({
  greigeId: z.string().uuid('Invalid greige ID'),
});

export const partIdParamSchema = z.object({
  partId: z.string().uuid('Invalid part ID'),
});

export const componentIdParamSchema = z.object({
  componentId: z.string().uuid('Invalid component ID'),
});

export const groupKeyParamSchema = z.object({
  groupKey: z.string().min(1, 'Group key is required'),
});

export const sourceOrderIdParamSchema = z.object({
  sourceOrderId: z.string().uuid('Invalid source order ID'),
});

export const styleIdAndRowIdParamSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  rowId: z.string().uuid('Invalid row ID'),
});

export const styleIdAndFabricIdParamSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  fabricId: z.string().uuid('Invalid fabric ID'),
});

export const styleIdAndPartIdParamSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  partId: z.string().uuid('Invalid part ID'),
});

export const styleIdAndComponentIdParamSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  componentId: z.string().uuid('Invalid component ID'),
});

export const styleIdAndGroupKeyParamSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  groupKey: z.string().min(1, 'Group key is required'),
});

export const orderIdAndSourceOrderIdParamSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  sourceOrderId: z.string().uuid('Invalid source order ID'),
});

export const moduleNameParamSchema = z.object({
  moduleName: z.string().min(1, 'Module name is required'),
});

export const presetIdParamSchema = z.object({
  presetId: z.string().uuid('Invalid preset ID'),
});

export const customerIdAndPresetIdParamSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  presetId: z.string().uuid('Invalid preset ID'),
});

export const imageIdParamSchema = z.object({
  imageId: z.string().uuid('Invalid image ID'),
});

export const styleIdAndImageIdParamSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  imageId: z.string().uuid('Invalid image ID'),
});

export const serviceTypeParamSchema = z.object({
  serviceType: z.string().min(1, 'Service type is required'),
});

export const greigeLaceIdParamSchema = z.object({
  greigeLaceId: z.string().uuid('Invalid greige lace ID'),
});

export const moduleParamSchema = z.object({
  module: z.string().min(1, 'Module is required'),
});

export const userIdParamSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

export const entityTypeAndEntityIdParamSchema = z.object({
  entityType: z.string().min(1, 'Entity type is required'),
  entityId: z.string().uuid('Invalid entity ID'),
});

export const roleParamSchema = z.object({
  role: z.string().min(1, 'Role is required'),
});

export const roleAndPermissionParamSchema = z.object({
  role: z.string().min(1, 'Role is required'),
  permission: z.string().min(1, 'Permission is required'),
});

export const stateCodeParamSchema = z.object({
  stateCode: z.string().min(1, 'State code is required'),
});

export const orderIdAndIdParamSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  id: z.string().uuid('Invalid ID'),
});

export const orderIdAndThreadIdParamSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  threadId: z.string().uuid('Invalid thread ID'),
});

// ============================================================================
// Type Exports
// ============================================================================

export type IdParam = z.infer<typeof idParamSchema>;
export type BatchIdParam = z.infer<typeof batchIdParamSchema>;
export type StageIdParam = z.infer<typeof stageIdParamSchema>;
export type ProcessorIdParam = z.infer<typeof processorIdParamSchema>;
export type StyleIdParam = z.infer<typeof styleIdParamSchema>;
export type WorkOrderIdParam = z.infer<typeof workOrderIdParamSchema>;
