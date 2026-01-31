/**
 * Material Master Types
 * Shared type definitions for material controllers (lace, button, thread, zipper, elastic, label, packaging)
 */

import { MaterialType } from '@prisma/client';

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

// ============================================
// CONSOLIDATED MATERIAL MASTER TYPES (NEW)
// ============================================
// These types support the new unified material_master table
// that consolidates 31 separate material tables into one

export interface CreateMaterialMasterDto {
  materialType: MaterialType;
  code?: string; // Auto-generated if not provided
  name: string;
  description?: string;

  // Generic pricing (nullable based on material type)
  pricePerUnit?: number;
  pricePerMeter?: number;
  pricePerPiece?: number;
  pricePerKg?: number;
  pricePerGross?: number;
  unit?: string;

  // Currency support
  currencyId?: string;

  // Type-specific attributes stored as JSON
  specifications?: Record<string, any>;

  // Standard fields
  isActive?: boolean;
  hsnCode?: string;
  gstRate?: number;
}

export interface UpdateMaterialMasterDto {
  name?: string;
  description?: string;

  pricePerUnit?: number;
  pricePerMeter?: number;
  pricePerPiece?: number;
  pricePerKg?: number;
  pricePerGross?: number;
  unit?: string;

  currencyId?: string;

  specifications?: Record<string, any>;

  isActive?: boolean;
  hsnCode?: string;
  gstRate?: number;
}

export interface MaterialMasterFilterDto {
  materialType?: MaterialType;
  isActive?: boolean;
  searchTerm?: string;
  supplierId?: string;
}

export interface MaterialSupplierMappingDto {
  supplierId: string;
  supplierCode?: string;
  supplierName?: string;
  supplierPrice?: number;
  leadTimeDays?: number;
  moq?: number;
  moqUnit?: string;
  isPrimary?: boolean;
  isActive?: boolean;
}

// Type-safe specification interfaces for each material type

export interface LaceSpecifications {
  width?: number; // in mm
  design?: string;
  pattern?: string;
  elasticity?: 'high' | 'medium' | 'low' | 'none';
  composition?: string;
  laceType?: string;
}

export interface ButtonSpecifications {
  diameter?: number; // in mm
  size?: string;
  holes?: 0 | 2 | 4;
  shape?: 'round' | 'square' | 'oval' | 'custom';
  material?: string; // 'plastic', 'metal', 'wood', etc.
  buttonType?: string;
}

export interface ThreadSpecifications {
  composition?: string;
  count?: number;
  ply?: number;
  color?: string;
  shade?: string;
  threadType?: string;
}

export interface ZipperSpecifications {
  length?: number;
  teethType?: string;
  sliderType?: string;
  tapeWidth?: number;
  brand?: string;
  zipperType?: string;
}

export interface ElasticSpecifications {
  width?: number;
  thickness?: number;
  elasticity?: string;
  composition?: string;
  elasticType?: string;
}

export interface LabelSpecifications {
  size?: string;
  labelType?: string;
  printingMethod?: string;
  material?: string;
}

export interface PackagingSpecifications {
  packagingType?: string;
  size?: string;
  dimensions?: string;
  weight?: number;
  material?: string;
}

export interface MachinePartSpecifications {
  partNumber?: string;
  machineModel?: string;
  machineType?: string;
  partType?: string;
}

// Union type for all specifications
export type MaterialSpecifications =
  | LaceSpecifications
  | ButtonSpecifications
  | ThreadSpecifications
  | ZipperSpecifications
  | ElasticSpecifications
  | LabelSpecifications
  | PackagingSpecifications
  | MachinePartSpecifications
  | Record<string, any>; // Generic fallback
