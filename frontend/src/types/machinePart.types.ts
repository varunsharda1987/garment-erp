/**
 * Machine Part Types
 *
 * Types for machine parts and spares management
 */

import type { Supplier } from './supplier.types';

/**
 * Machine Part Supplier Junction
 */
export interface MachinePartSupplier {
  id: string;
  machinePartId: string;
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
 * Machine Part Master
 */
export interface MachinePart {
  id: string;
  partCode: string;
  partName: string;
  partNumber?: string | null;
  category?: string | null;
  machine?: string | null;
  brand?: string | null;
  model?: string | null;
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
  machinePartSuppliers?: MachinePartSupplier[];
  materialId?: string | null;
  materialCode?: string | null;
}

/**
 * Create Machine Part Request
 */
export interface CreateMachinePartRequest {
  partName: string;
  partNumber?: string;
  category?: string;
  machine?: string;
  brand?: string;
  model?: string;
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
 * Update Machine Part Request
 */
export interface UpdateMachinePartRequest {
  partName?: string;
  partNumber?: string;
  category?: string;
  machine?: string;
  brand?: string;
  model?: string;
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
 * Machine Part List Response
 */
export interface MachinePartListResponse {
  data: MachinePart[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
