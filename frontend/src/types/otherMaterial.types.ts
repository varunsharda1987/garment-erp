/**
 * Other Material Types
 *
 * Types for miscellaneous/generic materials that don't fit other categories
 */

import type { Supplier } from './supplier.types';

/**
 * Other Material Supplier Junction
 */
export interface OtherMaterialSupplier {
  id: string;
  otherMaterialId: string;
  supplierId: string;
  isPreferred: boolean;
  isActive: boolean;
  notes?: string | null;
  pricePerUnit?: number | null;
  createdAt: string;
  updatedAt: string;
  supplier: Supplier;
}

/**
 * Other Material Master
 */
export interface OtherMaterial {
  id: string;
  materialCode: string;
  materialName: string;
  category?: string | null;
  unit: string;
  specifications?: string | null;
  pricePerUnit?: number | null;
  image?: string | null;
  supplierId?: string | null;
  description?: string | null;
  isActive: boolean;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;

  // Relations (camelCase due to serializer)
  otherMaterialSuppliers?: OtherMaterialSupplier[];
  materialId?: string | null;
  materialCodeRef?: string | null;
}

/**
 * Create Other Material Request
 */
export interface CreateOtherMaterialRequest {
  materialName: string;
  category?: string;
  unit?: string;
  specifications?: string;
  pricePerUnit?: number;
  supplierId?: string;
  description?: string;
  suppliers?: Array<{
    supplierId: string;
    isPreferred?: boolean;
    isActive?: boolean;
    notes?: string;
    pricePerUnit?: number;
  }>;
}

/**
 * Update Other Material Request
 */
export interface UpdateOtherMaterialRequest {
  materialName?: string;
  category?: string;
  unit?: string;
  specifications?: string;
  pricePerUnit?: number;
  supplierId?: string;
  description?: string;
  isActive?: boolean;
  suppliers?: Array<{
    supplierId: string;
    isPreferred?: boolean;
    isActive?: boolean;
    notes?: string;
    pricePerUnit?: number;
  }>;
}

/**
 * Other Material List Response
 */
export interface OtherMaterialListResponse {
  data: OtherMaterial[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Template column definition for bulk import
 * BUG-OM3 fix: Aligned with backend response structure
 * Backend returns: { field, header, required, description }
 */
export interface OtherMaterialTemplateColumn {
  field: string;
  header: string;
  required: boolean;
  description: string;
}

/**
 * Template response for bulk import
 * BUG-OM3 fix: Backend returns exampleData (not sampleData)
 */
export interface OtherMaterialTemplateResponse {
  columns: OtherMaterialTemplateColumn[];
  exampleData: Record<string, unknown>[];
}
