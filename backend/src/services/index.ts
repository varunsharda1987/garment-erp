/**
 * Services Index
 * Export all service classes and singleton instances
 */

// Base Service
export { BaseService } from './base.service';
export type { PaginationOptions, PaginatedResult, IncludeConfig } from './base.service';

// Customer Service
export { customerService } from './customer.service';
export type {
  CreateCustomerDTO,
  UpdateCustomerDTO,
  BrandCategoryInput,
  GstNumberInput,
  CustomerQueryOptions,
  CreateAccessoryPresetDTO,
  UpdateAccessoryPresetDTO,
  AccessoryItem,
} from './customer.service';

// Supplier Service
export { supplierService } from './supplier.service';
export type {
  CreateSupplierDTO,
  UpdateSupplierDTO,
  SupplierQueryOptions,
  SupplierCategoryData,
} from './supplier.service';

// Style Service
export { styleService } from './style.service';
export type { CreateStyleDTO, UpdateStyleDTO, StyleWithRelations } from './style.service';

// Order Service
export { orderService } from './order.service';
export type {
  CreateOrderDTO,
  UpdateOrderDTO,
  OrderQueryOptions,
  OrderItemInput,
  OrderItemBreakup,
  OrderStatus,
  OrderPriority,
} from './order.service';

// Order BOM Service
export { orderBomService } from './order-bom.service';
export type {
  OrderBOMItemInput,
  CreateOrderBOMFromCostSheetInput,
  CopyOrderBOMInput,
  CreateOrderBOMInput,
  UpdateOrderBOMInput,
  ApproveOrderBOMInput,
  OrderBOMQueryFilters,
  OrderBOMWithRelations,
  OrderBOMItemWithRelations,
  OrderBOMMaterialRequirement,
  OrderBOMCalculationSummary,
} from '../types/order-bom.types';

// Costing Service
export { costingService } from './costing.service';
export type {
  CreateCostSheetDTO,
  UpdateCostSheetDTO,
  CostSheetQueryOptions,
  FabricDetail,
  TrimDetail,
  EmbroideryDetail,
  AccessoryDetail,
  CMTCosts,
  CostCalculationResult,
} from './costing.service';

// Fabric Service
export { fabricService } from './fabric.service';
export type { CreateFabricDTO, UpdateFabricDTO, FabricQueryOptions, FabricSupplierInput } from './fabric.service';

// Greige Service
export { greigeService } from './greige.service';
export type {
  CreateGreigeDTO,
  UpdateGreigeDTO,
  GreigeQueryOptions,
  GreigeSupplierInput,
  BulkImportGreigeInput,
  BulkImportResult,
} from './greige.service';

// Material Service
export { materialService } from './material.service';
export type {
  CreateMaterialDTO,
  UpdateMaterialDTO,
  MaterialQueryOptions,
  SupplierInput,
  CreateCategoryDTO,
  UpdateCategoryDTO,
} from './material.service';

// Material Master Service (Consolidated)
export * as materialMasterService from './material-master.service';
export type {
  CreateMaterialMasterDto,
  UpdateMaterialMasterDto,
  MaterialMasterFilterDto,
  MaterialSupplierMappingDto,
  LaceSpecifications,
  ButtonSpecifications,
  ThreadSpecifications,
  ZipperSpecifications,
  ElasticSpecifications,
  LabelSpecifications,
  PackagingSpecifications,
  MachinePartSpecifications,
  MaterialSpecifications,
} from '../types/material-master.types';
