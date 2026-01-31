/**
 * Order BOM (Bill of Materials) Types
 * Type definitions for Order-level BOM operations
 *
 * Order BOM is created after Cost Sheet approval and contains
 * order-specific quantities and prices for MRP & Production.
 */

// ============================================
// Order BOM Status
// ============================================

import { OrderBOMStatus } from '@prisma/client';
export { OrderBOMStatus };

// ============================================
// Order BOM Item Input Types
// ============================================

/**
 * Material type for Order BOM items
 */
export type OrderBOMItemMaterialType =
  | 'BUTTON'
  | 'THREAD'
  | 'ZIPPER'
  | 'LACE'
  | 'ELASTIC'
  | 'LABEL'
  | 'PACKAGING'
  | 'FABRIC'
  | 'GENERIC';

/**
 * Usage category for Order BOM items
 */
export type OrderBOMItemUsageCategory =
  | 'GARMENT_TRIM'
  | 'PACKAGING'
  | 'VALUE_ADDITION'
  | 'FABRIC';

/**
 * Order BOM item input for creation
 */
export interface OrderBOMItemInput {
  materialType: OrderBOMItemMaterialType;
  materialId?: string;      // Generic materials table
  buttonId?: string;
  threadId?: string;
  zipperId?: string;
  laceId?: string;
  elasticId?: string;
  labelId?: string;
  packagingId?: string;
  fabricId?: string;

  quantityPerGarment: number;
  orderQuantity: number;
  wastagePercent?: number;
  unit: string;
  unitPrice: number;

  componentName?: string;
  usageCategory?: OrderBOMItemUsageCategory;
  notes?: string;
  sortOrder?: number;
}

// ============================================
// Order BOM Creation Types
// ============================================

/**
 * Input for creating Order BOM from Cost Sheet
 */
export interface CreateOrderBOMFromCostSheetInput {
  orderId: string;
  styleId: string;
  costSheetId: string;
  orderItemId?: string;
  createdById: string;
}

/**
 * Input for copying Order BOM from previous order (repeat orders)
 */
export interface CopyOrderBOMInput {
  targetOrderId: string;
  sourceOrderId: string;
  styleId: string;
  orderItemId?: string;
  createdById: string;
  adjustQuantity?: number; // New order quantity (optional, uses source if not provided)
}

/**
 * Input for creating Order BOM manually
 */
export interface CreateOrderBOMInput {
  orderId: string;
  styleId: string;
  orderItemId?: string;
  sourceCostSheetId?: string;
  createdById: string;
  items: OrderBOMItemInput[];
}

// ============================================
// Order BOM Update Types
// ============================================

/**
 * Input for updating Order BOM
 */
export interface UpdateOrderBOMInput {
  items?: OrderBOMItemInput[];
}

/**
 * Input for approving Order BOM
 */
export interface ApproveOrderBOMInput {
  approvedById: string;
}

// ============================================
// Order BOM Query Types
// ============================================

/**
 * Query filters for Order BOM list
 */
export interface OrderBOMQueryFilters {
  orderId?: string;
  styleId?: string;
  status?: OrderBOMStatus;
  isActive?: boolean;
}

/**
 * Order BOM with relations (from database)
 */
export interface OrderBOMWithRelations {
  id: string;
  orderId: string;
  orderItemId?: string | null;
  styleId: string;
  version: number;
  isActive: boolean;
  status: OrderBOMStatus;
  totalMaterialCost?: number | null;
  sourceCostSheetId?: string | null;
  copiedFromOrderId?: string | null;
  createdById: string;
  approvedById?: string | null;
  approvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;

  // Relations
  order?: {
    id: string;
    orderNumber: string;
    [key: string]: unknown;
  };
  style?: {
    id: string;
    styleCode: string;
    styleName: string;
    [key: string]: unknown;
  };
  items?: OrderBOMItemWithRelations[];
}

/**
 * Order BOM item with material relations
 */
export interface OrderBOMItemWithRelations {
  id: string;
  orderBomId: string;
  materialType: string;
  materialId?: string | null;
  buttonId?: string | null;
  threadId?: string | null;
  zipperId?: string | null;
  laceId?: string | null;
  elasticId?: string | null;
  labelId?: string | null;
  packagingId?: string | null;
  fabricId?: string | null;

  quantityPerGarment: number;
  orderQuantity: number;
  totalQuantity: number;
  wastagePercent?: number | null;
  totalWithWastage?: number | null;
  unit: string;
  unitPrice: number;
  totalCost: number;

  componentName?: string | null;
  usageCategory?: string | null;
  notes?: string | null;
  sortOrder: number;

  // Material relations (only one will be populated based on materialType)
  material?: { id: string; code: string; name: string; [key: string]: unknown } | null;
  button_master?: { id: string; buttonCode: string; buttonName: string; [key: string]: unknown } | null;
  thread_master?: { id: string; threadCode: string; threadName: string; [key: string]: unknown } | null;
  zipper_master?: { id: string; zipperCode: string; zipperName: string; [key: string]: unknown } | null;
  lace_master?: { id: string; laceCode: string; laceName: string; [key: string]: unknown } | null;
  elastic_master?: { id: string; elasticCode: string; elasticName: string; [key: string]: unknown } | null;
  label_master?: { id: string; labelCode: string; labelName: string; [key: string]: unknown } | null;
  packaging_master?: { id: string; packagingCode: string; packagingName: string; [key: string]: unknown } | null;
  fabric_master?: { id: string; fabricCode: string; fabricName: string; [key: string]: unknown } | null;
}

// ============================================
// Material Requirement Calculation Types
// ============================================

/**
 * Material requirement calculation result
 */
export interface OrderBOMMaterialRequirement {
  materialType: string;
  materialName: string;
  materialCode: string;
  quantityPerGarment: number;
  orderQuantity: number;
  baseQuantity: number;
  wastagePercent: number;
  wastageQuantity: number;
  totalQuantity: number;
  unit: string;
  unitPrice: number;
  totalCost: number;
}

/**
 * Order BOM calculation summary
 */
export interface OrderBOMCalculationSummary {
  totalItems: number;
  totalMaterialCost: number;
  requirements: OrderBOMMaterialRequirement[];
  byCategory: {
    [category: string]: {
      itemCount: number;
      totalCost: number;
    };
  };
}
