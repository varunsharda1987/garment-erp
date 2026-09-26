/**
 * AUTO-GENERATED from backend/prisma/schema.prisma — DO NOT EDIT BY HAND.
 * Regenerate: node scripts/skills/generate-zod-enums.js
 *
 * One const object + type per Prisma enum, same values, same order. Import (or re-export) these
 * instead of re-typing the values — the hand-typed frontend `Unit` copies drifted to 13 of 16.
 */

export const CadCorrectionStatus = {
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPLIED: 'APPLIED',
  PARTIAL: 'PARTIAL',
  REJECTED: 'REJECTED',
} as const;
export type CadCorrectionStatus = (typeof CadCorrectionStatus)[keyof typeof CadCorrectionStatus];

export const StyleImageType = {
  MAIN: 'MAIN',
  SKETCH_FRONT: 'SKETCH_FRONT',
  SKETCH_BACK: 'SKETCH_BACK',
  SKETCH_SIDE: 'SKETCH_SIDE',
  TECHNICAL_FLAT: 'TECHNICAL_FLAT',
  DETAIL_VIEW: 'DETAIL_VIEW',
  CONSTRUCTION: 'CONSTRUCTION',
  OTHER: 'OTHER',
} as const;
export type StyleImageType = (typeof StyleImageType)[keyof typeof StyleImageType];

export const LaceLabDipStatus = {
  PENDING: 'PENDING',
  SENT_TO_PROCESSOR: 'SENT_TO_PROCESSOR',
  SAMPLE_RECEIVED: 'SAMPLE_RECEIVED',
  AWAITING_BUYER_APPROVAL: 'AWAITING_BUYER_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type LaceLabDipStatus = (typeof LaceLabDipStatus)[keyof typeof LaceLabDipStatus];

export const AgeGroup = {
  ADULT: 'ADULT',
  KIDS_1_3Y: 'KIDS_1_3Y',
  KIDS_4_7Y: 'KIDS_4_7Y',
  KIDS_8_14Y: 'KIDS_8_14Y',
} as const;
export type AgeGroup = (typeof AgeGroup)[keyof typeof AgeGroup];

export const CustomerCategory = {
  DOMESTIC: 'DOMESTIC',
  EXPORT: 'EXPORT',
  WHOLESALER: 'WHOLESALER',
  RETAILER: 'RETAILER',
} as const;
export type CustomerCategory = (typeof CustomerCategory)[keyof typeof CustomerCategory];

export const CustomerType = {
  BUYER: 'BUYER',
} as const;
export type CustomerType = (typeof CustomerType)[keyof typeof CustomerType];

export const BusinessType = {
  B2B: 'B2B',
  B2C: 'B2C',
} as const;
export type BusinessType = (typeof BusinessType)[keyof typeof BusinessType];

export const MarketType = {
  INTERNATIONAL: 'INTERNATIONAL',
  DOMESTIC: 'DOMESTIC',
} as const;
export type MarketType = (typeof MarketType)[keyof typeof MarketType];

export const CustomerAddressType = {
  SHIP_TO: 'SHIP_TO',
  COURIER: 'COURIER',
  OFFICE: 'OFFICE',
} as const;
export type CustomerAddressType = (typeof CustomerAddressType)[keyof typeof CustomerAddressType];

export const DeliveryStatus = {
  PENDING: 'PENDING',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;
export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

export const DeliveryLocationType = {
  WAREHOUSE: 'WAREHOUSE',
  PROCESSOR: 'PROCESSOR',
} as const;
export type DeliveryLocationType = (typeof DeliveryLocationType)[keyof typeof DeliveryLocationType];

export const GRNStatus = {
  PENDING_QC: 'PENDING_QC',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  PARTIALLY_ACCEPTED: 'PARTIALLY_ACCEPTED',
  REVERSED: 'REVERSED',
} as const;
export type GRNStatus = (typeof GRNStatus)[keyof typeof GRNStatus];

export const Gender = {
  MEN: 'MEN',
  WOMEN: 'WOMEN',
  KIDS: 'KIDS',
  UNISEX: 'UNISEX',
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const StyleStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;
export type StyleStatus = (typeof StyleStatus)[keyof typeof StyleStatus];

export const CADStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  APPROVED: 'APPROVED',
} as const;
export type CADStatus = (typeof CADStatus)[keyof typeof CADStatus];

export const CadPurpose = {
  COSTING: 'COSTING',
  RAW_MATERIAL_CALCULATION: 'RAW_MATERIAL_CALCULATION',
  PRODUCTION: 'PRODUCTION',
} as const;
export type CadPurpose = (typeof CadPurpose)[keyof typeof CadPurpose];

export const CostSheetApprovalStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type CostSheetApprovalStatus = (typeof CostSheetApprovalStatus)[keyof typeof CostSheetApprovalStatus];

export const CadApprovalStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  ALTERNATE_APPROVED: 'ALTERNATE_APPROVED',
} as const;
export type CadApprovalStatus = (typeof CadApprovalStatus)[keyof typeof CadApprovalStatus];

export const CostSheetPurpose = {
  COSTING: 'COSTING',
  RAW_MATERIAL_CALCULATION: 'RAW_MATERIAL_CALCULATION',
  PRODUCTION: 'PRODUCTION',
  PROCUREMENT_PRODUCTION: 'PROCUREMENT_PRODUCTION',
} as const;
export type CostSheetPurpose = (typeof CostSheetPurpose)[keyof typeof CostSheetPurpose];

export const CostSheetVarianceStatus = {
  PENDING: 'PENDING',
  WITHIN_BUDGET: 'WITHIN_BUDGET',
  REQUIRES_APPROVAL: 'REQUIRES_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type CostSheetVarianceStatus = (typeof CostSheetVarianceStatus)[keyof typeof CostSheetVarianceStatus];

export const OrderBOMStatus = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  LOCKED: 'LOCKED',
} as const;
export type OrderBOMStatus = (typeof OrderBOMStatus)[keyof typeof OrderBOMStatus];

export const VarianceApprovalStatus = {
  NOT_REQUIRED: 'NOT_REQUIRED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type VarianceApprovalStatus = (typeof VarianceApprovalStatus)[keyof typeof VarianceApprovalStatus];

export const GreigeRateSource = {
  PROCUREMENT: 'PROCUREMENT',
  STOCK_VALUATION: 'STOCK_VALUATION',
  GREIGE_MASTER: 'GREIGE_MASTER',
  MANUAL_OVERRIDE: 'MANUAL_OVERRIDE',
  PURCHASE_ORDER: 'PURCHASE_ORDER',
} as const;
export type GreigeRateSource = (typeof GreigeRateSource)[keyof typeof GreigeRateSource];

export const FabricFinishType = {
  DYED: 'DYED',
  PRINTED: 'PRINTED',
  YARN_DYED: 'YARN_DYED',
  RAW: 'RAW',
} as const;
export type FabricFinishType = (typeof FabricFinishType)[keyof typeof FabricFinishType];

export const ProcessType = {
  PRINTING: 'PRINTING',
  DYEING: 'DYEING',
  EMBROIDERY: 'EMBROIDERY',
  CUTTING: 'CUTTING',
  STITCHING: 'STITCHING',
  FINISHING: 'FINISHING',
  WASHING: 'WASHING',
  TRANSPORTATION: 'TRANSPORTATION',
  HANDWORK: 'HANDWORK',
  SMOCKING: 'SMOCKING',
  KAAJ_BUTTON: 'KAAJ_BUTTON',
} as const;
export type ProcessType = (typeof ProcessType)[keyof typeof ProcessType];

export const PrintingType = {
  PIGMENT: 'PIGMENT',
  PROCIAN: 'PROCIAN',
  DISCHARGE: 'DISCHARGE',
  PIGMENT_DISCHARGE: 'PIGMENT_DISCHARGE',
} as const;
export type PrintingType = (typeof PrintingType)[keyof typeof PrintingType];

export const PrintDirection = {
  ONE_WAY: 'ONE_WAY',
  TWO_WAY: 'TWO_WAY',
} as const;
export type PrintDirection = (typeof PrintDirection)[keyof typeof PrintDirection];

export const InspectionType = {
  INLINE: 'INLINE',
  FINAL: 'FINAL',
  AQL: 'AQL',
  RANDOM: 'RANDOM',
  MIDLINE: 'MIDLINE',
} as const;
export type InspectionType = (typeof InspectionType)[keyof typeof InspectionType];

export const InvoiceStatus = {
  PENDING: 'PENDING',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  SETTLED_WITH_CREDIT: 'SETTLED_WITH_CREDIT',
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const LocationType = {
  FACTORY: 'FACTORY',
  WAREHOUSE: 'WAREHOUSE',
  OFFICE: 'OFFICE',
} as const;
export type LocationType = (typeof LocationType)[keyof typeof LocationType];

export const NotificationType = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ALERT: 'ALERT',
  SUCCESS: 'SUCCESS',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const OrderStatus = {
  PENDING: 'PENDING',
  IN_PRODUCTION: 'IN_PRODUCTION',
  COMPLETED: 'COMPLETED',
  DISPATCHED: 'DISPATCHED',
  CANCELLED: 'CANCELLED',
  SPLIT: 'SPLIT',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const StockProductionOrderStatus = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  IN_PRODUCTION: 'IN_PRODUCTION',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type StockProductionOrderStatus = (typeof StockProductionOrderStatus)[keyof typeof StockProductionOrderStatus];

export const SaleOrderStatus = {
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  PARTIALLY_ALLOCATED: 'PARTIALLY_ALLOCATED',
  FULLY_ALLOCATED: 'FULLY_ALLOCATED',
  PARTIALLY_DISPATCHED: 'PARTIALLY_DISPATCHED',
  DISPATCHED: 'DISPATCHED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;
export type SaleOrderStatus = (typeof SaleOrderStatus)[keyof typeof SaleOrderStatus];

export const PaymentMethod = {
  CASH: 'CASH',
  CHEQUE: 'CHEQUE',
  BANK_TRANSFER: 'BANK_TRANSFER',
  UPI: 'UPI',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const Priority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const ProductionStage = {
  CUTTING: 'CUTTING',
  STITCHING: 'STITCHING',
  FINISHING: 'FINISHING',
  CHECKING: 'CHECKING',
  PACKING: 'PACKING',
  ORDER_RECEIVED: 'ORDER_RECEIVED',
  PENDING_COSTING: 'PENDING_COSTING',
  PENDING_GREIGE_ORDER: 'PENDING_GREIGE_ORDER',
  TRIMS_NOT_ORDERED: 'TRIMS_NOT_ORDERED',
  IN_PRINTING: 'IN_PRINTING',
  IN_DYING: 'IN_DYING',
  IN_EMBROIDERY: 'IN_EMBROIDERY',
  IN_HANDWORK: 'IN_HANDWORK',
  IN_CUTTING: 'IN_CUTTING',
  IN_STITCHING: 'IN_STITCHING',
  IN_FINISHING: 'IN_FINISHING',
  IN_SMOCKING: 'IN_SMOCKING',
  READY_TO_SHIP: 'READY_TO_SHIP',
  SHIPPED: 'SHIPPED',
  COMPLETED: 'COMPLETED',
} as const;
export type ProductionStage = (typeof ProductionStage)[keyof typeof ProductionStage];

export const PurchaseOrderStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
  PENDING_GREIGE: 'PENDING_GREIGE',
  READY_FOR_PROCESSING: 'READY_FOR_PROCESSING',
  SHORT_CLOSED: 'SHORT_CLOSED',
} as const;
export type PurchaseOrderStatus = (typeof PurchaseOrderStatus)[keyof typeof PurchaseOrderStatus];

export const POCategory = {
  FABRIC: 'FABRIC',
  GREIGE: 'GREIGE',
  PROCESSING: 'PROCESSING',
  TRIMS: 'TRIMS',
  THREAD: 'THREAD',
  LACE: 'LACE',
  GREIGE_LACE: 'GREIGE_LACE',
  LACE_PROCESSING: 'LACE_PROCESSING',
  GENERAL: 'GENERAL',
  BUTTON: 'BUTTON',
  ZIPPER: 'ZIPPER',
  ELASTIC: 'ELASTIC',
  LABEL: 'LABEL',
  PACKAGING: 'PACKAGING',
  MACHINE_PART: 'MACHINE_PART',
  OTHER_MATERIAL: 'OTHER_MATERIAL',
  EMBROIDERY_SERVICE: 'EMBROIDERY_SERVICE',
  WASHING_SERVICE: 'WASHING_SERVICE',
  FINISHING_SERVICE: 'FINISHING_SERVICE',
  CUTTING_SERVICE: 'CUTTING_SERVICE',
  STITCHING_SERVICE: 'STITCHING_SERVICE',
  HANDWORK_SERVICE: 'HANDWORK_SERVICE',
  SMOCKING_SERVICE: 'SMOCKING_SERVICE',
  TRANSPORTATION_SERVICE: 'TRANSPORTATION_SERVICE',
} as const;
export type POCategory = (typeof POCategory)[keyof typeof POCategory];

export const POSource = {
  MANUAL: 'MANUAL',
  COST_SHEET: 'COST_SHEET',
  MRP: 'MRP',
  SERVICE_REQUIREMENT: 'SERVICE_REQUIREMENT',
  PRODUCTION_RUN: 'PRODUCTION_RUN',
} as const;
export type POSource = (typeof POSource)[keyof typeof POSource];

export const ServiceType = {
  EMBROIDERY: 'EMBROIDERY',
  PRINTING: 'PRINTING',
  DYEING: 'DYEING',
  WASHING: 'WASHING',
  FINISHING: 'FINISHING',
  CUTTING: 'CUTTING',
  STITCHING: 'STITCHING',
  HANDWORK: 'HANDWORK',
  SMOCKING: 'SMOCKING',
  TRANSPORTATION: 'TRANSPORTATION',
  OTHER: 'OTHER',
} as const;
export type ServiceType = (typeof ServiceType)[keyof typeof ServiceType];

export const ServiceRequirementStatus = {
  PENDING: 'PENDING',
  PO_GENERATED: 'PO_GENERATED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type ServiceRequirementStatus = (typeof ServiceRequirementStatus)[keyof typeof ServiceRequirementStatus];

export const ChallanType = {
  OUTWARD: 'OUTWARD',
  INWARD: 'INWARD',
  INTERNAL: 'INTERNAL',
} as const;
export type ChallanType = (typeof ChallanType)[keyof typeof ChallanType];

export const ChallanStatus = {
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  IN_TRANSIT: 'IN_TRANSIT',
  RECEIVED: 'RECEIVED',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;
export type ChallanStatus = (typeof ChallanStatus)[keyof typeof ChallanStatus];

export const DefectDisposition = {
  PENDING: 'PENDING',
  SCRAP: 'SCRAP',
  REWORK_INITIATED: 'REWORK_INITIATED',
  REWORK_COMPLETED: 'REWORK_COMPLETED',
  RETURN_TO_VENDOR: 'RETURN_TO_VENDOR',
  DOWNGRADE: 'DOWNGRADE',
  DISPOSED: 'DISPOSED',
} as const;
export type DefectDisposition = (typeof DefectDisposition)[keyof typeof DefectDisposition];

export const QualityStatus = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  CONDITIONAL_PASS: 'CONDITIONAL_PASS',
} as const;
export type QualityStatus = (typeof QualityStatus)[keyof typeof QualityStatus];

export const QuotationStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;
export type QuotationStatus = (typeof QuotationStatus)[keyof typeof QuotationStatus];

export const RequisitionStatus = {
  PENDING: 'PENDING',
  ISSUED: 'ISSUED',
  RECEIVED: 'RECEIVED',
} as const;
export type RequisitionStatus = (typeof RequisitionStatus)[keyof typeof RequisitionStatus];

export const SampleStatus = {
  REQUESTED: 'REQUESTED',
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SENT: 'SENT',
  FEEDBACK_PENDING: 'FEEDBACK_PENDING',
  REVISION_NEEDED: 'REVISION_NEEDED',
  APPROVED_WITH_COMMENTS: 'APPROVED_WITH_COMMENTS',
} as const;
export type SampleStatus = (typeof SampleStatus)[keyof typeof SampleStatus];

export const SampleType = {
  ORIGINAL_SAMPLE: 'ORIGINAL_SAMPLE',
  LOOK_SAMPLE: 'LOOK_SAMPLE',
  FIT_SAMPLE: 'FIT_SAMPLE',
  PHOTO_SAMPLE: 'PHOTO_SAMPLE',
  PRODUCTION_SAMPLE: 'PRODUCTION_SAMPLE',
  PP_SAMPLE: 'PP_SAMPLE',
  SIZE_SET_SAMPLE: 'SIZE_SET_SAMPLE',
  SHIPMENT_SAMPLE: 'SHIPMENT_SAMPLE',
} as const;
export type SampleType = (typeof SampleType)[keyof typeof SampleType];

export const Severity = {
  MINOR: 'MINOR',
  MAJOR: 'MAJOR',
  CRITICAL: 'CRITICAL',
} as const;
export type Severity = (typeof Severity)[keyof typeof Severity];

export const SupplierCategory = {
  FABRIC_SUPPLIER: 'FABRIC_SUPPLIER',
  GREIGE_SUPPLIER: 'GREIGE_SUPPLIER',
  TRIMS_SUPPLIER: 'TRIMS_SUPPLIER',
  THREAD_SUPPLIER: 'THREAD_SUPPLIER',
  PACKAGING_SUPPLIER: 'PACKAGING_SUPPLIER',
  LACE_SUPPLIER: 'LACE_SUPPLIER',
  DYEING_PRINTING: 'DYEING_PRINTING',
  EMBROIDERY: 'EMBROIDERY',
  HAND_WORK: 'HAND_WORK',
  SMOCKING: 'SMOCKING',
  CMT_UNIT: 'CMT_UNIT',
  FINISHING_CONTRACTOR: 'FINISHING_CONTRACTOR',
  STITCHING_CONTRACTOR: 'STITCHING_CONTRACTOR',
  WASHING: 'WASHING',
  DORI_PIPING_CONTRACTOR: 'DORI_PIPING_CONTRACTOR',
  MACHINE_PARTS_SUPPLIER: 'MACHINE_PARTS_SUPPLIER',
  OTHER_SERVICES: 'OTHER_SERVICES',
} as const;
export type SupplierCategory = (typeof SupplierCategory)[keyof typeof SupplierCategory];

export const TransactionType = {
  STOCK_IN: 'STOCK_IN',
  STOCK_OUT: 'STOCK_OUT',
  ADJUSTMENT: 'ADJUSTMENT',
  TRANSFER: 'TRANSFER',
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const StockStatus = {
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  EXHAUSTED: 'EXHAUSTED',
  ISSUED: 'ISSUED',
  PENDING_RETURN: 'PENDING_RETURN',
} as const;
export type StockStatus = (typeof StockStatus)[keyof typeof StockStatus];

export const StockEntryType = {
  GENERIC: 'GENERIC',
  PLANNED_STOCK: 'PLANNED_STOCK',
  EXCESS: 'EXCESS',
  EXCESS_MOQ: 'EXCESS_MOQ',
  CROSS_STYLE_REUSE: 'CROSS_STYLE_REUSE',
  RETURNED: 'RETURNED',
  VARIANCE_UNUSED: 'VARIANCE_UNUSED',
} as const;
export type StockEntryType = (typeof StockEntryType)[keyof typeof StockEntryType];

export const SpecializedStockTransactionType = {
  STOCK_IN: 'STOCK_IN',
  CONSUMPTION: 'CONSUMPTION',
  RETURN: 'RETURN',
  RETURN_TO_SUPPLIER: 'RETURN_TO_SUPPLIER',
  ADJUSTMENT_IN: 'ADJUSTMENT_IN',
  ADJUSTMENT_OUT: 'ADJUSTMENT_OUT',
  ALLOCATION: 'ALLOCATION',
  TRANSFER: 'TRANSFER',
  TRANSFER_OUT: 'TRANSFER_OUT',
  TRANSFER_IN: 'TRANSFER_IN',
  ISSUE: 'ISSUE',
  RECEIPT: 'RECEIPT',
  PRICE_CORRECTION: 'PRICE_CORRECTION',
  EMBROIDERY_SEND_OUT: 'EMBROIDERY_SEND_OUT',
  EMBROIDERY_RECEIPT: 'EMBROIDERY_RECEIPT',
  EMBROIDERY_CANCELLED: 'EMBROIDERY_CANCELLED',
  QUALITY_DOWNGRADE: 'QUALITY_DOWNGRADE',
} as const;
export type SpecializedStockTransactionType =
  (typeof SpecializedStockTransactionType)[keyof typeof SpecializedStockTransactionType];

export const TransactionReferenceType = {
  MANUAL: 'MANUAL',
  MANUAL_ADJUSTMENT: 'MANUAL_ADJUSTMENT',
  CHALLAN: 'CHALLAN',
  GRN: 'GRN',
  GRN_REJECTION: 'GRN_REJECTION',
  PROCESSING_BATCH: 'PROCESSING_BATCH',
  ORDER: 'ORDER',
  TRANSFER: 'TRANSFER',
  ALLOCATION: 'ALLOCATION',
  ISSUE_NOTE: 'ISSUE_NOTE',
  EMBROIDERY_SEND_OUT: 'EMBROIDERY_SEND_OUT',
  MATERIAL_REQUIREMENT: 'MATERIAL_REQUIREMENT',
  PROCESSING_DELIVERY: 'PROCESSING_DELIVERY',
  PROCUREMENT: 'PROCUREMENT',
  ADJUSTMENT: 'ADJUSTMENT',
  JOB_WORK_ORDER: 'JOB_WORK_ORDER',
  EXTERNAL_PROCESS: 'EXTERNAL_PROCESS',
} as const;
export type TransactionReferenceType = (typeof TransactionReferenceType)[keyof typeof TransactionReferenceType];

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

export const MaterialType = {
  GENERIC: 'GENERIC',
  TRIMS: 'TRIMS',
  LACE: 'LACE',
  BUTTON: 'BUTTON',
  THREAD: 'THREAD',
  ZIPPER: 'ZIPPER',
  ELASTIC: 'ELASTIC',
  LABEL: 'LABEL',
  PACKAGING: 'PACKAGING',
  ACCESSORIES: 'ACCESSORIES',
  SERVICE: 'SERVICE',
  MACHINE_PART: 'MACHINE_PART',
  OTHER: 'OTHER',
  FABRIC: 'FABRIC',
  GREIGE: 'GREIGE',
  HOOK_EYE: 'HOOK_EYE',
  SNAP_BUTTON: 'SNAP_BUTTON',
  BUCKLE: 'BUCKLE',
  BELT: 'BELT',
  VELCRO: 'VELCRO',
  DRAWSTRING: 'DRAWSTRING',
  RIBBON: 'RIBBON',
  SEQUIN: 'SEQUIN',
  BEAD: 'BEAD',
  MOTIF: 'MOTIF',
  INTERLINING: 'INTERLINING',
  PADDING: 'PADDING',
  OTHER_FASTENER: 'OTHER_FASTENER',
  OTHER_TAPE: 'OTHER_TAPE',
  OTHER_DECORATIVE: 'OTHER_DECORATIVE',
  OTHER_FUNCTIONAL: 'OTHER_FUNCTIONAL',
  OTHER_MATERIAL: 'OTHER_MATERIAL',
} as const;
export type MaterialType = (typeof MaterialType)[keyof typeof MaterialType];

export const MaterialUsageCategory = {
  GARMENT_TRIM: 'GARMENT_TRIM',
  VALUE_ADDITION: 'VALUE_ADDITION',
  PACKAGING: 'PACKAGING',
} as const;
export type MaterialUsageCategory = (typeof MaterialUsageCategory)[keyof typeof MaterialUsageCategory];

export const ThreadPackagingType = {
  CONE: 'CONE',
  TUBE: 'TUBE',
  SPOOL: 'SPOOL',
  CONE_5K: 'CONE_5K',
  CONE_10K: 'CONE_10K',
} as const;
export type ThreadPackagingType = (typeof ThreadPackagingType)[keyof typeof ThreadPackagingType];

export const ThreadPly = {
  TWO_PLY: 'TWO_PLY',
  THREE_PLY: 'THREE_PLY',
} as const;
export type ThreadPly = (typeof ThreadPly)[keyof typeof ThreadPly];

export const ThreadMaterial = {
  POLYESTER: 'POLYESTER',
  COTTON: 'COTTON',
} as const;
export type ThreadMaterial = (typeof ThreadMaterial)[keyof typeof ThreadMaterial];

export const ThreadQuantityInput = {
  UNITS: 'UNITS',
  BOXES: 'BOXES',
} as const;
export type ThreadQuantityInput = (typeof ThreadQuantityInput)[keyof typeof ThreadQuantityInput];

export const ThreadRequirementStatus = {
  PENDING: 'PENDING',
  PO_GENERATED: 'PO_GENERATED',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;
export type ThreadRequirementStatus = (typeof ThreadRequirementStatus)[keyof typeof ThreadRequirementStatus];

export const LabelCategory = {
  SEWN_IN: 'SEWN_IN',
  HANGTAG: 'HANGTAG',
  PRICE_TAG: 'PRICE_TAG',
} as const;
export type LabelCategory = (typeof LabelCategory)[keyof typeof LabelCategory];

export const UserRole = {
  ADMIN: 'ADMIN',
  PRODUCTION_MANAGER: 'PRODUCTION_MANAGER',
  SALES: 'SALES',
  INVENTORY: 'INVENTORY',
  ACCOUNTS: 'ACCOUNTS',
  QUALITY: 'QUALITY',
  PURCHASE: 'PURCHASE',
  FACTORY_SUPERVISOR: 'FACTORY_SUPERVISOR',
  MERCHANDISER: 'MERCHANDISER',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const TestTemplateType = {
  FPT: 'FPT',
  GPT: 'GPT',
} as const;
export type TestTemplateType = (typeof TestTemplateType)[keyof typeof TestTemplateType];

export const TestResult = {
  PENDING: 'PENDING',
  PASS: 'PASS',
  FAIL: 'FAIL',
  RETEST_REQUIRED: 'RETEST_REQUIRED',
  CONDITIONAL_PASS: 'CONDITIONAL_PASS',
} as const;
export type TestResult = (typeof TestResult)[keyof typeof TestResult];

export const WarehouseType = {
  RAW_MATERIAL: 'RAW_MATERIAL',
  FINISHED_GOODS: 'FINISHED_GOODS',
  WORK_IN_PROGRESS: 'WORK_IN_PROGRESS',
  GENERAL: 'GENERAL',
  TRANSIT: 'TRANSIT',
  JOB_WORK: 'JOB_WORK',
} as const;
export type WarehouseType = (typeof WarehouseType)[keyof typeof WarehouseType];

export const GreigeQuality = {
  PRINTING: 'PRINTING',
  DYEING: 'DYEING',
  SUPER_DYEING: 'SUPER_DYEING',
} as const;
export type GreigeQuality = (typeof GreigeQuality)[keyof typeof GreigeQuality];

export const MovementType = {
  STOCK_IN: 'STOCK_IN',
  STOCK_OUT: 'STOCK_OUT',
  TRANSFER_IN: 'TRANSFER_IN',
  TRANSFER_OUT: 'TRANSFER_OUT',
  ADJUSTMENT_IN: 'ADJUSTMENT_IN',
  ADJUSTMENT_OUT: 'ADJUSTMENT_OUT',
} as const;
export type MovementType = (typeof MovementType)[keyof typeof MovementType];

export const StateType = {
  STATE: 'STATE',
  UNION_TERRITORY: 'UNION_TERRITORY',
} as const;
export type StateType = (typeof StateType)[keyof typeof StateType];

export const CityTier = {
  TIER_1: 'TIER_1',
  TIER_2: 'TIER_2',
  TIER_3: 'TIER_3',
} as const;
export type CityTier = (typeof CityTier)[keyof typeof CityTier];

export const ReservationType = {
  ORDER: 'ORDER',
  WORK_ORDER: 'WORK_ORDER',
  MATERIAL_REQUISITION: 'MATERIAL_REQUISITION',
} as const;
export type ReservationType = (typeof ReservationType)[keyof typeof ReservationType];

export const ReservationStatus = {
  ACTIVE: 'ACTIVE',
  CONSUMED: 'CONSUMED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;
export type ReservationStatus = (typeof ReservationStatus)[keyof typeof ReservationStatus];

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

export const StockTransactionType = {
  IN: 'IN',
  OUT: 'OUT',
  ADJUSTMENT_IN: 'ADJUSTMENT_IN',
  ADJUSTMENT_OUT: 'ADJUSTMENT_OUT',
} as const;
export type StockTransactionType = (typeof StockTransactionType)[keyof typeof StockTransactionType];

export const AccountType = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  EXPENSE: 'EXPENSE',
} as const;
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const AccountGroup = {
  CURRENT_ASSET: 'CURRENT_ASSET',
  FIXED_ASSET: 'FIXED_ASSET',
  CURRENT_LIABILITY: 'CURRENT_LIABILITY',
  LONG_TERM_LIABILITY: 'LONG_TERM_LIABILITY',
  EQUITY: 'EQUITY',
  DIRECT_REVENUE: 'DIRECT_REVENUE',
  INDIRECT_REVENUE: 'INDIRECT_REVENUE',
  DIRECT_EXPENSE: 'DIRECT_EXPENSE',
  INDIRECT_EXPENSE: 'INDIRECT_EXPENSE',
  OVERHEAD: 'OVERHEAD',
} as const;
export type AccountGroup = (typeof AccountGroup)[keyof typeof AccountGroup];

export const TaxType = {
  GST: 'GST',
  IGST: 'IGST',
  SGST: 'SGST',
  CGST: 'CGST',
  VAT: 'VAT',
  CUSTOMS_DUTY: 'CUSTOMS_DUTY',
  EXCISE_DUTY: 'EXCISE_DUTY',
  SERVICE_TAX: 'SERVICE_TAX',
} as const;
export type TaxType = (typeof TaxType)[keyof typeof TaxType];

export const HSNSACType = {
  HSN: 'HSN',
  SAC: 'SAC',
} as const;
export type HSNSACType = (typeof HSNSACType)[keyof typeof HSNSACType];

export const ExpenseCategory = {
  DIRECT: 'DIRECT',
  INDIRECT: 'INDIRECT',
  OVERHEAD: 'OVERHEAD',
  ADMINISTRATIVE: 'ADMINISTRATIVE',
  MARKETING: 'MARKETING',
} as const;
export type ExpenseCategory = (typeof ExpenseCategory)[keyof typeof ExpenseCategory];

export const BankAccountType = {
  CURRENT: 'CURRENT',
  SAVINGS: 'SAVINGS',
  OD: 'OD',
  CC: 'CC',
} as const;
export type BankAccountType = (typeof BankAccountType)[keyof typeof BankAccountType];

export const RateType = {
  BUYING: 'BUYING',
  SELLING: 'SELLING',
  AVERAGE: 'AVERAGE',
} as const;
export type RateType = (typeof RateType)[keyof typeof RateType];

export const MaterialRequirementStatus = {
  PENDING: 'PENDING',
  SIZE_PENDING: 'SIZE_PENDING',
  FULFILLED_STOCK: 'FULFILLED_STOCK',
  PARTIAL_STOCK: 'PARTIAL_STOCK',
  PO_REQUIRED: 'PO_REQUIRED',
  PO_GENERATED: 'PO_GENERATED',
  PO_SENT: 'PO_SENT',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
  CONVERTED: 'CONVERTED',
  DECISION_PENDING: 'DECISION_PENDING',
} as const;
export type MaterialRequirementStatus = (typeof MaterialRequirementStatus)[keyof typeof MaterialRequirementStatus];

export const RequirementSource = {
  SALES_ORDER: 'SALES_ORDER',
  WORK_ORDER: 'WORK_ORDER',
  MANUAL: 'MANUAL',
} as const;
export type RequirementSource = (typeof RequirementSource)[keyof typeof RequirementSource];

export const CuttingBatchStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  ON_HOLD: 'ON_HOLD',
} as const;
export type CuttingBatchStatus = (typeof CuttingBatchStatus)[keyof typeof CuttingBatchStatus];

export const StitchingIssueStatus = {
  PENDING_RECEIPT: 'PENDING_RECEIPT',
  RECEIVED: 'RECEIVED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;
export type StitchingIssueStatus = (typeof StitchingIssueStatus)[keyof typeof StitchingIssueStatus];

export const FinishingStatus = {
  PENDING_RECEIPT: 'PENDING_RECEIPT',
  RECEIVED: 'RECEIVED',
  IN_PROGRESS: 'IN_PROGRESS',
  PACKING: 'PACKING',
  COMPLETED: 'COMPLETED',
} as const;
export type FinishingStatus = (typeof FinishingStatus)[keyof typeof FinishingStatus];

export const TransferSlipStatus = {
  CREATED: 'CREATED',
  PRINTED: 'PRINTED',
  CONFIRMED: 'CONFIRMED',
  RECEIVED: 'RECEIVED',
  DEVIATION_RECORDED: 'DEVIATION_RECORDED',
} as const;
export type TransferSlipStatus = (typeof TransferSlipStatus)[keyof typeof TransferSlipStatus];

export const PackingType = {
  SOLID: 'SOLID',
  ASSORTED: 'ASSORTED',
} as const;
export type PackingType = (typeof PackingType)[keyof typeof PackingType];

export const LabDipStatus = {
  PENDING: 'PENDING',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  RESUBMIT: 'RESUBMIT',
} as const;
export type LabDipStatus = (typeof LabDipStatus)[keyof typeof LabDipStatus];

export const BuyerApprovalStatus = {
  NOT_SENT: 'NOT_SENT',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  RESUBMIT_REQUIRED: 'RESUBMIT_REQUIRED',
} as const;
export type BuyerApprovalStatus = (typeof BuyerApprovalStatus)[keyof typeof BuyerApprovalStatus];

export const JobWorkOrderStatus = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  ISSUED: 'ISSUED',
  IN_TRANSIT: 'IN_TRANSIT',
  AT_PROCESSOR: 'AT_PROCESSOR',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  RECEIVED: 'RECEIVED',
  QUALITY_CHECKED: 'QUALITY_CHECKED',
  STOCK_UPDATED: 'STOCK_UPDATED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;
export type JobWorkOrderStatus = (typeof JobWorkOrderStatus)[keyof typeof JobWorkOrderStatus];

export const InventoryDisposition = {
  PENDING: 'PENDING',
  RETURNED_TO_STOCK: 'RETURNED_TO_STOCK',
  AT_PROCESSOR: 'AT_PROCESSOR',
  WRITTEN_OFF: 'WRITTEN_OFF',
  TRANSFERRED: 'TRANSFERRED',
  RETURNED_TO_SUPPLIER: 'RETURNED_TO_SUPPLIER',
} as const;
export type InventoryDisposition = (typeof InventoryDisposition)[keyof typeof InventoryDisposition];

export const PrintMethod = {
  SCREEN_MACHINE: 'SCREEN_MACHINE',
  SCREEN_HAND: 'SCREEN_HAND',
  ROTARY: 'ROTARY',
  BLOCK: 'BLOCK',
} as const;
export type PrintMethod = (typeof PrintMethod)[keyof typeof PrintMethod];

export const PrintChemistry = {
  PIGMENT: 'PIGMENT',
  PROCIAN: 'PROCIAN',
  DISCHARGE: 'DISCHARGE',
} as const;
export type PrintChemistry = (typeof PrintChemistry)[keyof typeof PrintChemistry];

export const ASNStatus = {
  PENDING: 'PENDING',
  APPLIED: 'APPLIED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  RESCHEDULE: 'RESCHEDULE',
} as const;
export type ASNStatus = (typeof ASNStatus)[keyof typeof ASNStatus];

export const DeliveryConfirmation = {
  DELIVERED: 'DELIVERED',
  PARTIAL: 'PARTIAL',
  REJECTED: 'REJECTED',
} as const;
export type DeliveryConfirmation = (typeof DeliveryConfirmation)[keyof typeof DeliveryConfirmation];

export const InspectionStatus = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  CONDITIONAL: 'CONDITIONAL',
} as const;
export type InspectionStatus = (typeof InspectionStatus)[keyof typeof InspectionStatus];

export const ConversationStatus = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
  DELETED: 'DELETED',
} as const;
export type ConversationStatus = (typeof ConversationStatus)[keyof typeof ConversationStatus];

export const AIMessageRole = {
  USER: 'USER',
  ASSISTANT: 'ASSISTANT',
  SYSTEM: 'SYSTEM',
} as const;
export type AIMessageRole = (typeof AIMessageRole)[keyof typeof AIMessageRole];

export const ActionStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  REJECTED: 'REJECTED',
  EXECUTED: 'EXECUTED',
  EXPIRED: 'EXPIRED',
} as const;
export type ActionStatus = (typeof ActionStatus)[keyof typeof ActionStatus];

export const FeedbackRating = {
  HELPFUL: 'HELPFUL',
  NOT_HELPFUL: 'NOT_HELPFUL',
} as const;
export type FeedbackRating = (typeof FeedbackRating)[keyof typeof FeedbackRating];

export const SeasonType = {
  SS: 'SS',
  AW: 'AW',
} as const;
export type SeasonType = (typeof SeasonType)[keyof typeof SeasonType];

export const DocumentStatus = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  CANCELLED: 'CANCELLED',
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const CreditNoteReason = {
  SALES_RETURN: 'SALES_RETURN',
  RATE_DIFFERENCE: 'RATE_DIFFERENCE',
  QUALITY_ISSUE: 'QUALITY_ISSUE',
  QUANTITY_DIFFERENCE: 'QUANTITY_DIFFERENCE',
  OTHER: 'OTHER',
} as const;
export type CreditNoteReason = (typeof CreditNoteReason)[keyof typeof CreditNoteReason];

export const DebitNoteReason = {
  PURCHASE_RETURN: 'PURCHASE_RETURN',
  RATE_DIFFERENCE: 'RATE_DIFFERENCE',
  QUALITY_ISSUE: 'QUALITY_ISSUE',
  QUANTITY_SHORT: 'QUANTITY_SHORT',
  DAMAGED_GOODS: 'DAMAGED_GOODS',
  OTHER: 'OTHER',
} as const;
export type DebitNoteReason = (typeof DebitNoteReason)[keyof typeof DebitNoteReason];

export const SupplyType = {
  DOMESTIC: 'DOMESTIC',
  EXPORT_WITH_PAYMENT: 'EXPORT_WITH_PAYMENT',
  EXPORT_WITHOUT_PAYMENT: 'EXPORT_WITHOUT_PAYMENT',
  SEZ_WITH_PAYMENT: 'SEZ_WITH_PAYMENT',
  SEZ_WITHOUT_PAYMENT: 'SEZ_WITHOUT_PAYMENT',
  DEEMED_EXPORT: 'DEEMED_EXPORT',
} as const;
export type SupplyType = (typeof SupplyType)[keyof typeof SupplyType];

export const TDSStatus = {
  PENDING: 'PENDING',
  CERTIFICATE_RECEIVED: 'CERTIFICATE_RECEIVED',
  VERIFIED: 'VERIFIED',
} as const;
export type TDSStatus = (typeof TDSStatus)[keyof typeof TDSStatus];

export const ExternalProcessType = {
  EMBROIDERY_PIECE: 'EMBROIDERY_PIECE',
  SMOCKING: 'SMOCKING',
  HANDWORK: 'HANDWORK',
} as const;
export type ExternalProcessType = (typeof ExternalProcessType)[keyof typeof ExternalProcessType];

export const ExternalProcessSourceType = {
  CUTTING_BATCH: 'CUTTING_BATCH',
  FABRIC_STOCK: 'FABRIC_STOCK',
  STITCHING_ISSUE: 'STITCHING_ISSUE',
} as const;
export type ExternalProcessSourceType = (typeof ExternalProcessSourceType)[keyof typeof ExternalProcessSourceType];

export const ExternalProcessStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;
export type ExternalProcessStatus = (typeof ExternalProcessStatus)[keyof typeof ExternalProcessStatus];

export const TrfStatus = {
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  SENT_TO_LAB: 'SENT_TO_LAB',
  CLOSED: 'CLOSED',
} as const;
export type TrfStatus = (typeof TrfStatus)[keyof typeof TrfStatus];

export const TrfPackageType = {
  KNIT: 'KNIT',
  WOVEN: 'WOVEN',
  RETEST: 'RETEST',
} as const;
export type TrfPackageType = (typeof TrfPackageType)[keyof typeof TrfPackageType];

export const TrfSampleStage = {
  PP: 'PP',
  SHIPMENT: 'SHIPMENT',
} as const;
export type TrfSampleStage = (typeof TrfSampleStage)[keyof typeof TrfSampleStage];

export const TrfFinishType = {
  REGULAR_FINISH: 'REGULAR_FINISH',
  PEACH_FINISH: 'PEACH_FINISH',
  GARMENT_WASH: 'GARMENT_WASH',
  OTHER_DYE: 'OTHER_DYE',
} as const;
export type TrfFinishType = (typeof TrfFinishType)[keyof typeof TrfFinishType];

export const TrfServiceLevel = {
  REGULAR: 'REGULAR',
  EXPRESS: 'EXPRESS',
  SAME_DAY: 'SAME_DAY',
} as const;
export type TrfServiceLevel = (typeof TrfServiceLevel)[keyof typeof TrfServiceLevel];

export const TrfBuyingDepartment = {
  KIDS_WEAR: 'KIDS_WEAR',
  MENS_WEAR: 'MENS_WEAR',
  WOMENS_WEAR: 'WOMENS_WEAR',
  INDIAN_WEAR: 'INDIAN_WEAR',
  INNER_WEAR: 'INNER_WEAR',
  ACCESSORIES: 'ACCESSORIES',
} as const;
export type TrfBuyingDepartment = (typeof TrfBuyingDepartment)[keyof typeof TrfBuyingDepartment];

export const TrfBuyingSubCategory = {
  KIDS_BOYS: 'KIDS_BOYS',
  KIDS_GIRLS: 'KIDS_GIRLS',
  KIDS_INFANT: 'KIDS_INFANT',
  KIDS_AGE_2_8Y: 'KIDS_AGE_2_8Y',
  KIDS_AGE_8_16Y: 'KIDS_AGE_8_16Y',
  MENS_CASUALS: 'MENS_CASUALS',
  MENS_DENIM: 'MENS_DENIM',
  MENS_POLO_TEES: 'MENS_POLO_TEES',
  MENS_URBAN_UTILITY: 'MENS_URBAN_UTILITY',
  WOMENS_DENIM: 'WOMENS_DENIM',
  WOMENS_NIGHT_WEAR: 'WOMENS_NIGHT_WEAR',
  WOMENS_DRESS: 'WOMENS_DRESS',
  WOMENS_SMART: 'WOMENS_SMART',
} as const;
export type TrfBuyingSubCategory = (typeof TrfBuyingSubCategory)[keyof typeof TrfBuyingSubCategory];

export const TrfTestCode = {
  AFTER_HOME_LAUNDERING_3_WASH: 'AFTER_HOME_LAUNDERING_3_WASH',
  AFTER_DRY_CLEANING_1_CYCLE: 'AFTER_DRY_CLEANING_1_CYCLE',
  DIM_STABILITY_WASHING: 'DIM_STABILITY_WASHING',
  DIM_STABILITY_DRY_CLEANING: 'DIM_STABILITY_DRY_CLEANING',
  COLOR_FASTNESS_WASHING: 'COLOR_FASTNESS_WASHING',
  COLOR_FASTNESS_DRY_CLEANING: 'COLOR_FASTNESS_DRY_CLEANING',
  COLOR_FASTNESS_RUBBING: 'COLOR_FASTNESS_RUBBING',
  COLOR_FASTNESS_LIGHT: 'COLOR_FASTNESS_LIGHT',
  COLOR_FASTNESS_PERSPIRATION: 'COLOR_FASTNESS_PERSPIRATION',
  COLOR_FASTNESS_WATER: 'COLOR_FASTNESS_WATER',
  COLOR_FASTNESS_SALIVA: 'COLOR_FASTNESS_SALIVA',
  SEAM_SLIPPAGE_STRENGTH: 'SEAM_SLIPPAGE_STRENGTH',
  BURSTING_STRENGTH: 'BURSTING_STRENGTH',
  PILLING_RESISTANCE: 'PILLING_RESISTANCE',
  ABRASION_RESISTANCE: 'ABRASION_RESISTANCE',
  STRETCH_AND_RECOVERY: 'STRETCH_AND_RECOVERY',
  FABRIC_WEIGHT: 'FABRIC_WEIGHT',
  YARN_COUNT: 'YARN_COUNT',
  FABRIC_CONSTRUCTION: 'FABRIC_CONSTRUCTION',
  FIBER_CONTENT: 'FIBER_CONTENT',
  TENSILE_STRENGTH: 'TENSILE_STRENGTH',
  TEAR_STRENGTH: 'TEAR_STRENGTH',
  FLAMMABILITY: 'FLAMMABILITY',
  ZIPPER_PULL_STRENGTH: 'ZIPPER_PULL_STRENGTH',
  SLIDER_LOCK_STRENGTH: 'SLIDER_LOCK_STRENGTH',
  BOTTOM_STOP_HOLDING_STRENGTH: 'BOTTOM_STOP_HOLDING_STRENGTH',
  TOP_STOP_HOLDING_STRENGTH: 'TOP_STOP_HOLDING_STRENGTH',
  LATERAL_STRENGTH_TESTING: 'LATERAL_STRENGTH_TESTING',
  PH_VALUE: 'PH_VALUE',
  FORMALDEHYDE_UV_VIS: 'FORMALDEHYDE_UV_VIS',
  ODOUR: 'ODOUR',
  DYE_TRANSFER_STORAGE: 'DYE_TRANSFER_STORAGE',
  CORROSION_RESISTANCE_METAL_PARTS: 'CORROSION_RESISTANCE_METAL_PARTS',
} as const;
export type TrfTestCode = (typeof TrfTestCode)[keyof typeof TrfTestCode];
