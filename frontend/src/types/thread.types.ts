/**
 * Thread Module Types - Frontend
 */

import { unitLabel } from '@/lib/units';
import type { ThreadPackagingType } from './generated/prisma-enums';

export type ThreadPly = 'TWO_PLY' | 'THREE_PLY';

export type ThreadMaterial = 'POLYESTER' | 'COTTON';

// How the thread comes: CONE / TUBE / SPOOL (older pages), and cones of a set length. Generated from
// schema.prisma. A thread PO line's unit is read from it (CONE_5K → CONE) by the unit registry.
export type { ThreadPackagingType };

export type ThreadQuantityInput = 'UNITS' | 'BOXES';

// MRP-38: typed as Record<…> so a new enum member fails the build instead of rendering
// "undefined" in the requirements table.
export const THREAD_PLY_LABELS: Record<ThreadPly, string> = {
  TWO_PLY: '2-Ply',
  THREE_PLY: '3-Ply',
};

export const THREAD_MATERIAL_LABELS: Record<ThreadMaterial, string> = {
  POLYESTER: 'Polyester',
  COTTON: 'Cotton',
};

// The ONE packaging label map (ThreadSelector and OrderThreadRequirementForm each had a copy).
// Cone / Tube / Spool are the units thread is bought in, so their names come from the unit registry.
// allow-unit-list — packaging types, named through the registry
export const THREAD_PACKAGING_LABELS: Record<ThreadPackagingType, string> = {
  CONE: unitLabel('CONE'),
  TUBE: unitLabel('TUBE'),
  SPOOL: unitLabel('SPOOL'),
  CONE_5K: `${unitLabel('CONE')} (5,000 m)`,
  CONE_10K: `${unitLabel('CONE')} (10,000 m)`,
};

export interface ThreadQuantityConversion {
  totalUnits: number;
  totalBoxes: number;
  totalMeters: number;
}

export type ThreadRequirementStatus = 'PENDING' | 'PO_GENERATED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export const THREAD_REQUIREMENT_STATUS_LABELS: Record<ThreadRequirementStatus, string> = {
  PENDING: 'Pending',
  PO_GENERATED: 'PO Generated',
  PARTIALLY_RECEIVED: 'Partially Received',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
};

export interface OrderThreadRequirement {
  id: string;
  orderId: string;
  threadId: string;
  threadName: string;
  threadCode: string;
  ply: ThreadPly;
  materialComposition: ThreadMaterial;
  colorName: string;
  packagingType: ThreadPackagingType;
  inputType: ThreadQuantityInput;
  unitsOrdered?: number;
  boxesOrdered?: number;
  totalUnits: number;
  totalBoxes: number;
  totalMeters: number;
  unitPrice?: number;
  totalCost?: number;
  status: ThreadRequirementStatus;
  supplierId?: string;
  supplierName?: string;
  poItemId?: string;
  orderNumber?: string;
  notes?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ThreadRequirementQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ThreadRequirementStatus;
  orderId?: string;
}

export interface PaginatedThreadRequirements {
  data: OrderThreadRequirement[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ThreadRequirementStats {
  total: number;
  pending: number;
  poGenerated: number;
  received: number;
  cancelled: number;
}

export interface GenerateThreadPOInput {
  requirementIds: string[];
  supplierId: string;
  expectedDeliveryDate: string;
  remarks?: string;
}

export interface ThreadPOSupplier {
  id: string;
  name: string;
  code: string;
}

/**
 * DTO for creating thread requirement (API request)
 */
export interface CreateThreadRequirementDto {
  orderId?: string; // Optional since it comes from URL param
  threadId: string;
  packagingType: ThreadPackagingType;
  inputType: ThreadQuantityInput;
  unitsOrdered?: number;
  boxesOrdered?: number;
  unitPrice?: number;
  notes?: string;
}

/**
 * Thread shortage detection result
 */
export interface ThreadShortage {
  threadId: string;
  threadName: string;
  threadCode: string;
  requiredUnits: number;
  availableUnits: number;
  shortageUnits: number;
  shortageBoxes: number;
  hasShortage: boolean;
}

// ============================================
// MASTER DATA TYPES (for existing thread management)
// ============================================

/**
 * Thread supplier relationship (for multi-supplier support)
 */
export interface ThreadSupplier {
  id: string;
  threadId: string;
  supplierId: string;
  isPreferred: boolean;
  isActive: boolean;
  notes?: string | null;
  pricePerCone?: number | null;
  createdAt?: string;
  updatedAt?: string;
  supplier: {
    id: string;
    code: string;
    name: string;
    contactPerson?: string | null;
    email?: string | null;
    phone?: string | null;
    isActive: boolean;
  };
}

/**
 * Thread supplier input (for forms)
 */
export interface ThreadSupplierInput {
  supplierId: string;
  isPreferred: boolean;
  isActive: boolean;
  notes?: string;
  pricePerCone?: number | string;
}

/**
 * Main Thread entity (matches thread_master Prisma model)
 */
export interface Thread {
  id: string;
  threadCode: string;
  threadName: string;
  supplierCode?: string | null;
  buyerCode?: string | null;
  color?: string | null;
  colorCode?: string | null;
  coneSize?: string | null;
  pricePerCone?: number | null;
  image?: string | null;
  supplierId?: string | null;
  description?: string | null;
  brand?: string | null;
  metersPerUnit?: number | null;
  packagingType?: ThreadPackagingType | null;
  piecesPerBox?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  // NEW Thread Material module fields
  ply?: ThreadPly | null;
  materialComposition?: ThreadMaterial | null;
  colorId?: string | null;
  unitsPerBox?: number | null;

  // API response relationships (from serializer)
  materialCode?: string;
  materialId?: string;
  supplierName?: string;
  supplierCodeRef?: string;
  threadSuppliers?: ThreadSupplier[];

  // Style associations (from serializer)
  styleCodes?: string[];
  styleNames?: string[];
  styleAssociations?: Array<{
    styleId: string;
    styleCode: string;
    styleName?: string;
    isPrimary: boolean;
  }>;
}

/**
 * Thread form data (for create/edit forms)
 */
export interface ThreadFormData {
  threadName: string;
  supplierCode?: string;
  buyerCode?: string;
  color?: string;
  colorCode?: string;
  coneSize?: string;
  brand?: string;
  metersPerUnit?: number | string;
  packagingType?: ThreadPackagingType;
  piecesPerBox?: number | string;
  pricePerCone?: number | string;
  supplierId?: string;
  description?: string;
  styleCodes?: string[];
  suppliers?: ThreadSupplierInput[];

  // NEW Thread Material module fields
  ply?: ThreadPly;
  materialComposition?: ThreadMaterial;
  colorId?: string;
  unitsPerBox?: number | string;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreateThreadRequest {
  threadName: string;
  supplierCode?: string;
  buyerCode?: string;
  color?: string;
  colorCode?: string;
  coneSize?: string;
  brand?: string;
  metersPerUnit?: number;
  packagingType?: ThreadPackagingType;
  piecesPerBox?: number;
  pricePerCone?: number;
  supplierId?: string;
  description?: string;
  styleCodes?: string[];
  suppliers?: ThreadSupplierInput[];
  ply?: ThreadPly;
  materialComposition?: ThreadMaterial;
  colorId?: string;
  unitsPerBox?: number;
}

export interface UpdateThreadRequest extends Partial<CreateThreadRequest> {
  isActive?: boolean;
}

export interface ThreadListResponse {
  data: Thread[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ThreadResponse {
  thread: Thread;
  material?: {
    id: string;
    code: string;
    name: string;
    materialType: string;
    unit: string;
    isActive: boolean;
  };
  message?: string;
}

export interface BulkImportResult {
  success: boolean;
  row: number;
  threadCode?: string;
  materialCode?: string;
  threadName?: string;
  stockCreated?: boolean;
  error?: string;
}

export interface BulkImportResponse {
  results: BulkImportResult[];
  summary: {
    total: number;
    success: number;
    failed: number;
  };
  message: string;
}

export interface BulkImportRow {
  threadName: string;
  supplierCode?: string;
  buyerCode?: string;
  color?: string;
  colorCode?: string;
  coneSize?: string;
  brand?: string;
  metersPerUnit?: number;
  packagingType?: ThreadPackagingType;
  piecesPerBox?: number;
  pricePerCone?: number;
  stockQuantity?: number;
  locationCode?: string;
}

export interface TemplateResponse {
  columns: Array<{
    name: string;
    required: boolean;
    description: string;
  }>;
  exampleData: BulkImportRow[];
}
