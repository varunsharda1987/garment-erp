/**
 * Material Master Types
 * Shared type definitions for material controllers (lace, button, thread, zipper, elastic, label, packaging)
 */

// ============================================
// Style Association Types
// ============================================

/**
 * Style association for linking trims to styles (many-to-many)
 */
export interface StyleAssociation {
  styleId: string;
  styleCode: string;
  styleName?: string;
  isPrimary: boolean;
}

/**
 * Input for creating/updating style associations
 */
export interface StyleAssociationInput {
  styleCode: string;
  isPrimary?: boolean;
  notes?: string;
}

// ============================================
// Common Query Result Types
// ============================================

/**
 * Result from COUNT queries
 * Note: PostgreSQL COUNT(*) returns bigint. Use ::integer cast in SQL or Number() wrapper
 */
export interface CountResult {
  count: number;
}

/**
 * Base material master record (common fields across all material types)
 */
export interface BaseMaterialMasterRecord {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  materialCode?: string;
  materialId?: string;
  supplierName?: string;
  supplierCodeRef?: string;
}

// ============================================
// Lace Types
// ============================================

export interface LaceMasterRecord extends BaseMaterialMasterRecord {
  laceCode: string;
  laceName: string;
  supplierCode?: string | null;
  buyerCode?: string | null; // DEPRECATED: Use styleCodes instead
  width?: string | null;
  design?: string | null;
  color?: string | null;
  composition?: string | null;
  laceType?: string | null;
  pricePerMeter?: number | null;
  supplierId?: string | null;
  description?: string | null;
  // Style associations
  styleCodes?: string[];
  styleAssociations?: StyleAssociation[];
}

export interface LaceUpdateData {
  laceName?: string;
  supplierCode?: string | null;
  buyerCode?: string | null; // DEPRECATED
  width?: string | null;
  design?: string | null;
  color?: string | null;
  composition?: string | null;
  laceType?: string | null;
  pricePerMeter?: number | null;
  supplierId?: string | null;
  description?: string | null;
  isActive?: boolean;
  updatedAt: Date;
  styleCodes?: string[]; // New style associations
}

// ============================================
// Button Types
// ============================================

export interface ButtonMasterRecord extends BaseMaterialMasterRecord {
  buttonCode: string;
  buttonName: string;
  supplierCode?: string | null;
  buyerCode?: string | null; // DEPRECATED: Use styleCodes instead
  size?: string | null;
  holes?: number | null;
  material?: string | null;
  color?: string | null;
  shape?: string | null;
  pricePerPiece?: number | null;
  pricePerGross?: number | null;
  supplierId?: string | null;
  description?: string | null;
  // Style associations
  styleCodes?: string[];
  styleAssociations?: StyleAssociation[];
}

export interface ButtonUpdateData {
  buttonName?: string;
  supplierCode?: string | null;
  buyerCode?: string | null; // DEPRECATED
  size?: string | null;
  holes?: number | null;
  material?: string | null;
  color?: string | null;
  shape?: string | null;
  pricePerPiece?: number | null;
  pricePerGross?: number | null;
  supplierId?: string | null;
  description?: string | null;
  isActive?: boolean;
  updatedAt: Date;
  styleCodes?: string[]; // New style associations
}

// ============================================
// Thread Types
// ============================================

export interface ThreadMasterRecord extends BaseMaterialMasterRecord {
  threadCode: string;
  threadName: string;
  threadCount?: string | null;
  color?: string | null;
  colorCode?: string | null;
  composition?: string | null;
  threadType?: string | null;
  coneSize?: string | null;
  pricePerCone?: number | null;
  supplierCode?: string | null;
  buyerCode?: string | null; // DEPRECATED: Use styleCodes instead
  supplierId?: string | null;
  description?: string | null;
  // Style associations
  styleCodes?: string[];
  styleAssociations?: StyleAssociation[];
}

export interface ThreadUpdateData {
  threadName?: string;
  threadCount?: string | null;
  color?: string | null;
  colorCode?: string | null;
  composition?: string | null;
  threadType?: string | null;
  coneSize?: string | null;
  pricePerCone?: number | null;
  supplierCode?: string | null;
  buyerCode?: string | null; // DEPRECATED
  supplierId?: string | null;
  description?: string | null;
  isActive?: boolean;
  updatedAt: Date;
  styleCodes?: string[]; // New style associations
}

// ============================================
// Zipper Types
// ============================================

export interface ZipperMasterRecord extends BaseMaterialMasterRecord {
  zipperCode: string;
  zipperName: string;
  supplierCode?: string | null;
  buyerCode?: string | null;
  length?: string | null;
  teethType?: string | null;
  color?: string | null;
  brand?: string | null;
  sliderType?: string | null;
  tapeWidth?: string | null;
  pricePerPiece?: number | null;
  supplierId?: string | null;
  description?: string | null;
}

export interface ZipperUpdateData {
  zipperName?: string;
  supplierCode?: string | null;
  buyerCode?: string | null;
  length?: string | null;
  teethType?: string | null;
  color?: string | null;
  brand?: string | null;
  sliderType?: string | null;
  tapeWidth?: string | null;
  pricePerPiece?: number | null;
  supplierId?: string | null;
  description?: string | null;
  isActive?: boolean;
  updatedAt: Date;
}

// ============================================
// Elastic Types
// ============================================

export interface ElasticMasterRecord extends BaseMaterialMasterRecord {
  elasticCode: string;
  elasticName: string;
  supplierCode?: string | null;
  buyerCode?: string | null;
  width?: string | null;
  stretchPercent?: number | null;
  elasticType?: string | null;
  color?: string | null;
  composition?: string | null;
  pricePerMeter?: number | null;
  supplierId?: string | null;
  description?: string | null;
}

export interface ElasticUpdateData {
  elasticName?: string;
  supplierCode?: string | null;
  buyerCode?: string | null;
  width?: string | null;
  elasticType?: string | null;
  color?: string | null;
  composition?: string | null;
  pricePerMeter?: number | null;
  supplierId?: string | null;
  description?: string | null;
  isActive?: boolean;
  updatedAt: Date;
}

// ============================================
// Label Types
// ============================================

export interface LabelMasterRecord extends BaseMaterialMasterRecord {
  labelCode: string;
  labelName: string;
  supplierCode?: string | null;
  buyerCode?: string | null;
  labelType?: string | null;
  material?: string | null;
  size?: string | null;
  content?: string | null;
  printMethod?: string | null;
  color?: string | null;
  pricePerPiece?: number | null;
  pricePerHundred?: number | null;
  supplierId?: string | null;
  description?: string | null;
}

export interface LabelUpdateData {
  labelName?: string;
  supplierCode?: string | null;
  buyerCode?: string | null;
  labelType?: string | null;
  material?: string | null;
  size?: string | null;
  content?: string | null;
  printMethod?: string | null;
  color?: string | null;
  pricePerPiece?: number | null;
  pricePerHundred?: number | null;
  supplierId?: string | null;
  description?: string | null;
  isActive?: boolean;
  updatedAt: Date;
}

// ============================================
// Packaging Types
// ============================================

export interface PackagingMasterRecord extends BaseMaterialMasterRecord {
  packagingCode: string;
  packagingName: string;
  supplierCode?: string | null;
  buyerCode?: string | null;
  packagingType?: string | null;
  material?: string | null;
  size?: string | null;
  thickness?: string | null;
  printDetails?: string | null;
  pricePerPiece?: number | null;
  pricePerHundred?: number | null;
  supplierId?: string | null;
  description?: string | null;
}

export interface PackagingUpdateData {
  packagingName?: string;
  supplierCode?: string | null;
  buyerCode?: string | null;
  packagingType?: string | null;
  material?: string | null;
  size?: string | null;
  thickness?: string | null;
  printDetails?: string | null;
  pricePerPiece?: number | null;
  pricePerHundred?: number | null;
  supplierId?: string | null;
  description?: string | null;
  isActive?: boolean;
  updatedAt: Date;
}

// ============================================
// Bulk Import Types
// ============================================

export interface BulkImportResult {
  success: boolean;
  row: number;
  laceCode?: string;
  buttonCode?: string;
  threadCode?: string;
  zipperCode?: string;
  elasticCode?: string;
  labelCode?: string;
  packagingCode?: string;
  materialCode?: string;
  laceName?: string;
  buttonName?: string;
  threadName?: string;
  zipperName?: string;
  elasticName?: string;
  labelName?: string;
  packagingName?: string;
  stockCreated?: boolean;
  error?: string;
}

export interface BulkImportSummary {
  total: number;
  success: number;
  failed: number;
}

// ============================================
// Warehouse Types
// ============================================

export interface WarehouseRecord {
  id: string;
  code?: string;
  name?: string;
}
