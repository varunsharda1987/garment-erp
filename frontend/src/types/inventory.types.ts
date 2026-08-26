// Inventory & Warehouse Management Types

// Enums
export const WarehouseType = {
  RAW_MATERIAL: 'RAW_MATERIAL',
  FINISHED_GOODS: 'FINISHED_GOODS',
  WORK_IN_PROGRESS: 'WORK_IN_PROGRESS',
  GENERAL: 'GENERAL',
  TRANSIT: 'TRANSIT',
  JOB_WORK: 'JOB_WORK',
} as const;
export type WarehouseType = (typeof WarehouseType)[keyof typeof WarehouseType];

export const MovementType = {
  STOCK_IN: 'STOCK_IN',
  STOCK_OUT: 'STOCK_OUT',
  TRANSFER_IN: 'TRANSFER_IN',
  TRANSFER_OUT: 'TRANSFER_OUT',
  ADJUSTMENT_IN: 'ADJUSTMENT_IN',
  ADJUSTMENT_OUT: 'ADJUSTMENT_OUT',
} as const;
export type MovementType = (typeof MovementType)[keyof typeof MovementType];

export const TransactionType = {
  IN: 'IN',
  OUT: 'OUT',
  ADJUSTMENT_IN: 'ADJUSTMENT_IN',
  ADJUSTMENT_OUT: 'ADJUSTMENT_OUT',
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const AdjustmentReason = {
  DAMAGED: 'DAMAGED',
  EXPIRED: 'EXPIRED',
  LOST: 'LOST',
  FOUND: 'FOUND',
  CORRECTION: 'CORRECTION',
  OTHER: 'OTHER',
} as const;
export type AdjustmentReason = (typeof AdjustmentReason)[keyof typeof AdjustmentReason];

export const CountType = {
  FULL: 'FULL',
  PARTIAL: 'PARTIAL',
  CYCLE: 'CYCLE',
  SPOT_CHECK: 'SPOT_CHECK',
} as const;
export type CountType = (typeof CountType)[keyof typeof CountType];

export const CountStatus = {
  DRAFT: 'DRAFT',
  IN_PROGRESS: 'IN_PROGRESS',
  COUNTED: 'COUNTED',
  VERIFIED: 'VERIFIED',
  APPROVED: 'APPROVED',
  CANCELLED: 'CANCELLED',
} as const;
export type CountStatus = (typeof CountStatus)[keyof typeof CountStatus];

export const Unit = {
  METER: 'METER',
  PIECE: 'PIECE',
  KILOGRAM: 'KILOGRAM',
  SET: 'SET',
  YARD: 'YARD',
  DOZEN: 'DOZEN',
  GROSS: 'GROSS',
  TUBE: 'TUBE',
  CONE: 'CONE',
  SPOOL: 'SPOOL',
  BOX: 'BOX',
  PAIR: 'PAIR',
  PACK: 'PACK',
  GRAM: 'GRAM',
  LITER: 'LITER',
  ROLL: 'ROLL',
} as const;
export type Unit = (typeof Unit)[keyof typeof Unit];

// Warehouse Types
// BUG-WH6 fix: Added supplier relation to match backend response
// BUG-WH7 fix: Added _count aggregation to match backend response
// BUG-WH15 fix: Added isVirtual field to match backend/Zod schema
export interface Warehouse {
  id: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseType: WarehouseType;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  capacity?: number;
  isActive: boolean;
  isVirtual?: boolean;
  supplierId?: string | null;
  createdById: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  users?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  supplier?: {
    id: string;
    code: string;
    name: string;
  } | null;
  _count?: {
    stockMovements?: number;
    stockReservations?: number;
    stockCounts?: number;
  };
}

export type CreateWarehouseDTO = {
  warehouseCode: string;
  warehouseName: string;
  warehouseType: WarehouseType;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  capacity?: number;
  isActive?: boolean;
  isVirtual?: boolean;
  supplierId?: string;
};

// BUG-WH9 fix: Added warehouseType to match backend UpdateWarehouseDTO
export interface UpdateWarehouseDTO {
  warehouseName?: string;
  warehouseType?: WarehouseType;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  capacity?: number;
  isActive?: boolean;
  isVirtual?: boolean;
  supplierId?: string | null;
}

// BUG-WH8 fix: Added all 7 fields to match backend getWarehouseStockSummary response
export interface WarehouseStockSummary {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseType: WarehouseType;
  totalMaterials: number;
  totalValue: number;
  stockLevels: Array<{
    materialId: string;
    warehouseId: string;
    quantity: number;
    unit: string;
    lastUpdated: string | null;
    reorderLevel: number | null;
    minLevel: number | null;
    maxLevel: number | null;
    valuationRate: number | null;
    stockValue: number | null;
    materials: {
      id: string;
      code: string;
      name: string;
      unit: string;
      materialType: string;
      reorderLevel: number | null;
      materialCategories: { name: string } | null;
    } | null;
    warehouses: {
      id: string;
      warehouseCode: string;
      warehouseName: string;
      warehouseType: string | null;
    } | null;
  }>;
}

// Stock Level Types
export interface StockLevel {
  id: string;
  materialId: string;
  warehouseId: string;
  quantity: number;
  unit: Unit;
  valuationRate: number;
  stockValue: number;
  reorderLevel?: number;
  minStockLevel?: number;
  maxStockLevel?: number;
  lastMovementDate?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
  materials?: {
    id: string;
    code: string;
    name: string;
    unit?: string;
    materialType?: string;
    categoryId?: string;
    materialCategories?: {
      id: string;
      name: string;
    };
  };
  warehouses?: {
    id: string;
    warehouseCode: string;
    warehouseName: string;
  };
}

export interface UpdateStockLevelDTO {
  reorderLevel?: number;
  minStockLevel?: number;
  maxStockLevel?: number;
}

export interface StockValuationReport {
  totalValue: number;
  totalQuantity: number;
  items: StockLevel[];
}

export interface StockAgingReport {
  materialId: string;
  materialCode: string;
  materialName: string;
  quantity: number;
  daysSinceLastMovement: number;
  lastMovementDate?: Date | string;
  ageCategory?: string; // convenience bucket from the backend: '0-30 days' | '30-60 days' | ... | '180+ days'
}

// Stock Movement Types
export interface StockMovement {
  id: string;
  movementType: MovementType;
  materialId: string;
  warehouseId: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  quantity: number;
  unit: Unit;
  rate?: number;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  remarks?: string;
  performedById: string;
  movementDate: Date | string;
  createdAt: Date | string;
  materials?: {
    id: string;
    code: string;
    name: string;
    unit?: string;
  };
  performedBy?: {
    firstName?: string;
    lastName?: string;
  };
  warehouses?: {
    id: string;
    warehouseCode: string;
    warehouseName: string;
  };
  fromWarehouses?: {
    id: string;
    warehouseCode: string;
    warehouseName: string;
  };
  toWarehouses?: {
    id: string;
    warehouseCode: string;
    warehouseName: string;
  };
  users?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  supplier?: {
    id: string;
    code: string;
    name: string;
  } | null;
}

export interface CreateStockInDTO {
  materialId?: string;
  itemType?: string; // 'GREIGE' | 'FABRIC' | 'MATERIAL'
  itemId?: string; // ID of the greige/fabric/material
  warehouseId: string;
  supplierId?: string; // Direct supplier reference
  quantity: number;
  unit: Unit;
  rate?: number;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  remarks?: string;
  foldLengthCm?: number;
  thanCount?: number;
  rollNumbers?: string; // Comma-separated roll numbers (Greige only)
  // Invoice tracking
  invoiceNumber?: string;
  invoiceDate?: string;
  // Backdating support
  receivedDate?: string;
}

export interface CreateStockOutDTO {
  materialId: string;
  warehouseId: string;
  quantity: number;
  unit: Unit;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  remarks?: string;
}

export interface CreateStockTransferDTO {
  materialId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  unit: Unit;
  remarks?: string;
}

export interface CreateStockAdjustmentDTO {
  materialId: string;
  warehouseId: string;
  adjustmentQuantity: number; // Negative for decrease, positive for increase
  unit: Unit;
  reason: AdjustmentReason;
  remarks?: string;
}

export interface MovementSummary {
  totalIn: number;
  totalOut: number;
  totalTransfer: number;
  netChange: number;
}

export interface StockTransaction {
  id: string;
  movementId: string;
  materialId: string;
  warehouseId: string;
  transactionType: TransactionType;
  quantity: number;
  rate: number;
  value: number;
  balanceQuantity: number;
  balanceValue: number;
  transactionDate: Date | string;
  createdAt: Date | string;
}

// Stock Count Types
export interface StockCount {
  id: string;
  countNumber: string;
  warehouseId: string;
  countType: CountType;
  countDate: Date | string;
  status: CountStatus;
  totalItems: number;
  countedItems: number;
  varianceItems: number;
  remarks?: string;
  countedById: string;
  verifiedById?: string;
  approvedById?: string;
  verifiedAt?: Date | string;
  approvedAt?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
  warehouses?: {
    id: string;
    warehouseCode: string;
    warehouseName: string;
  };
  countedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  verifiedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  approvedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  items?: StockCountItem[];
}

export interface StockCountItem {
  id: string;
  stockCountId: string;
  materialId: string;
  systemQuantity: number;
  physicalQuantity?: number;
  variance?: number;
  unit: Unit;
  remarks?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  materials?: {
    id: string;
    code: string;
    name: string;
    unit?: string;
  };
}

export interface CreateStockCountDTO {
  warehouseId: string;
  countType: CountType;
  countDate?: Date | string;
  remarks?: string;
  materialIds?: string[]; // For PARTIAL, CYCLE, SPOT_CHECK
}

export interface UpdateCountItemDTO {
  physicalQuantity: number;
  remarks?: string;
}

export interface VarianceReport {
  totalVariance: number;
  positiveVariance: number;
  negativeVariance: number;
  items: StockCountItem[];
}

export interface CountSummary {
  totalCounts: number;
  draftCounts: number;
  inProgressCounts: number;
  completedCounts: number;
  totalVariance: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  count?: number;
}

// Filter Types
export interface WarehouseFilters {
  warehouseType?: WarehouseType;
  isActive?: boolean;
  search?: string;
}

export interface StockLevelFilters {
  warehouseId?: string;
  materialId?: string;
  belowReorderLevel?: boolean;
  search?: string;
}

export interface StockMovementFilters {
  warehouseId?: string;
  materialId?: string;
  movementType?: MovementType;
  startDate?: string;
  endDate?: string;
}

export interface StockCountFilters {
  warehouseId?: string;
  countType?: CountType;
  status?: CountStatus;
  startDate?: string;
  endDate?: string;
}
