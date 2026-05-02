/**
 * Common Validation Schemas
 *
 * Reusable Zod schemas for common URL parameters across all modules.
 * These are the SINGLE SOURCE OF TRUTH for param validation.
 */

import { z } from 'zod';

// ============================================================================
// Common ID Param Schemas
// ============================================================================

export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID'),
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
  embroideryId: z.string().uuid('Invalid embroidery ID'),
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
  materialId: z.string().uuid('Invalid material ID'),
});

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
