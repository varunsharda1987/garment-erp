/**
 * AUTO-GENERATED from prisma/schema.prisma — DO NOT EDIT BY HAND.
 * Regenerate: node scripts/skills/generate-zod-enums.js
 *
 * One Zod enum per Prisma enum, same values, same order. Import these in *.schema.ts files
 * instead of re-typing the values — re-typed copies drift (the enum-drift bug class).
 */

import { z } from 'zod';

export const StyleImageTypeEnum = z.enum([
  'MAIN',
  'SKETCH_FRONT',
  'SKETCH_BACK',
  'SKETCH_SIDE',
  'TECHNICAL_FLAT',
  'DETAIL_VIEW',
  'CONSTRUCTION',
  'OTHER',
]);
export type StyleImageType = z.infer<typeof StyleImageTypeEnum>;

export const LaceLabDipStatusEnum = z.enum([
  'PENDING',
  'SENT_TO_PROCESSOR',
  'SAMPLE_RECEIVED',
  'AWAITING_BUYER_APPROVAL',
  'APPROVED',
  'REJECTED',
]);
export type LaceLabDipStatus = z.infer<typeof LaceLabDipStatusEnum>;

export const AgeGroupEnum = z.enum(['ADULT', 'KIDS_1_3Y', 'KIDS_4_7Y', 'KIDS_8_14Y']);
export type AgeGroup = z.infer<typeof AgeGroupEnum>;

export const CustomerCategoryEnum = z.enum(['DOMESTIC', 'EXPORT', 'WHOLESALER', 'RETAILER']);
export type CustomerCategory = z.infer<typeof CustomerCategoryEnum>;

export const CustomerTypeEnum = z.enum(['BUYER']);
export type CustomerType = z.infer<typeof CustomerTypeEnum>;

export const BusinessTypeEnum = z.enum(['B2B', 'B2C']);
export type BusinessType = z.infer<typeof BusinessTypeEnum>;

export const MarketTypeEnum = z.enum(['INTERNATIONAL', 'DOMESTIC']);
export type MarketType = z.infer<typeof MarketTypeEnum>;

export const CustomerAddressTypeEnum = z.enum(['SHIP_TO', 'COURIER', 'OFFICE']);
export type CustomerAddressType = z.infer<typeof CustomerAddressTypeEnum>;

export const DeliveryStatusEnum = z.enum(['PENDING', 'IN_TRANSIT', 'DELIVERED']);
export type DeliveryStatus = z.infer<typeof DeliveryStatusEnum>;

export const DeliveryLocationTypeEnum = z.enum(['WAREHOUSE', 'PROCESSOR']);
export type DeliveryLocationType = z.infer<typeof DeliveryLocationTypeEnum>;

export const GRNStatusEnum = z.enum(['PENDING_QC', 'ACCEPTED', 'REJECTED', 'PARTIALLY_ACCEPTED', 'REVERSED']);
export type GRNStatus = z.infer<typeof GRNStatusEnum>;

export const GenderEnum = z.enum(['MEN', 'WOMEN', 'KIDS', 'UNISEX']);
export type Gender = z.infer<typeof GenderEnum>;

export const StyleStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']);
export type StyleStatus = z.infer<typeof StyleStatusEnum>;

export const CADStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'APPROVED']);
export type CADStatus = z.infer<typeof CADStatusEnum>;

export const CadPurposeEnum = z.enum(['COSTING', 'RAW_MATERIAL_CALCULATION', 'PRODUCTION']);
export type CadPurpose = z.infer<typeof CadPurposeEnum>;

export const CostSheetApprovalStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type CostSheetApprovalStatus = z.infer<typeof CostSheetApprovalStatusEnum>;

export const CadApprovalStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'ALTERNATE_APPROVED']);
export type CadApprovalStatus = z.infer<typeof CadApprovalStatusEnum>;

export const CostSheetPurposeEnum = z.enum([
  'COSTING',
  'RAW_MATERIAL_CALCULATION',
  'PRODUCTION',
  'PROCUREMENT_PRODUCTION',
]);
export type CostSheetPurpose = z.infer<typeof CostSheetPurposeEnum>;

export const CostSheetVarianceStatusEnum = z.enum([
  'PENDING',
  'WITHIN_BUDGET',
  'REQUIRES_APPROVAL',
  'APPROVED',
  'REJECTED',
]);
export type CostSheetVarianceStatus = z.infer<typeof CostSheetVarianceStatusEnum>;

export const OrderBOMStatusEnum = z.enum(['DRAFT', 'APPROVED', 'LOCKED']);
export type OrderBOMStatus = z.infer<typeof OrderBOMStatusEnum>;

export const VarianceApprovalStatusEnum = z.enum(['NOT_REQUIRED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED']);
export type VarianceApprovalStatus = z.infer<typeof VarianceApprovalStatusEnum>;

export const GreigeRateSourceEnum = z.enum(['PROCUREMENT', 'STOCK_VALUATION', 'GREIGE_MASTER', 'MANUAL_OVERRIDE']);
export type GreigeRateSource = z.infer<typeof GreigeRateSourceEnum>;

export const FabricFinishTypeEnum = z.enum(['DYED', 'PRINTED', 'YARN_DYED', 'RAW']);
export type FabricFinishType = z.infer<typeof FabricFinishTypeEnum>;

export const ProcessTypeEnum = z.enum([
  'PRINTING',
  'DYEING',
  'EMBROIDERY',
  'CUTTING',
  'STITCHING',
  'FINISHING',
  'WASHING',
  'TRANSPORTATION',
  'HANDWORK',
  'SMOCKING',
  'KAAJ_BUTTON',
]);
export type ProcessType = z.infer<typeof ProcessTypeEnum>;

export const PrintingTypeEnum = z.enum(['PIGMENT', 'PROCIAN', 'DISCHARGE', 'PIGMENT_DISCHARGE']);
export type PrintingType = z.infer<typeof PrintingTypeEnum>;

export const PrintDirectionEnum = z.enum(['ONE_WAY', 'TWO_WAY']);
export type PrintDirection = z.infer<typeof PrintDirectionEnum>;

export const InspectionTypeEnum = z.enum(['INLINE', 'FINAL', 'AQL', 'RANDOM', 'MIDLINE']);
export type InspectionType = z.infer<typeof InspectionTypeEnum>;

export const InvoiceStatusEnum = z.enum(['PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE']);
export type InvoiceStatus = z.infer<typeof InvoiceStatusEnum>;

export const LocationTypeEnum = z.enum(['FACTORY', 'WAREHOUSE', 'OFFICE']);
export type LocationType = z.infer<typeof LocationTypeEnum>;

export const NotificationTypeEnum = z.enum(['INFO', 'WARNING', 'ALERT', 'SUCCESS']);
export type NotificationType = z.infer<typeof NotificationTypeEnum>;

export const OrderStatusEnum = z.enum(['PENDING', 'IN_PRODUCTION', 'COMPLETED', 'DISPATCHED', 'CANCELLED', 'SPLIT']);
export type OrderStatus = z.infer<typeof OrderStatusEnum>;

export const StockProductionOrderStatusEnum = z.enum(['DRAFT', 'APPROVED', 'IN_PRODUCTION', 'COMPLETED', 'CANCELLED']);
export type StockProductionOrderStatus = z.infer<typeof StockProductionOrderStatusEnum>;

export const SaleOrderStatusEnum = z.enum([
  'DRAFT',
  'CONFIRMED',
  'PARTIALLY_ALLOCATED',
  'FULLY_ALLOCATED',
  'PARTIALLY_DISPATCHED',
  'DISPATCHED',
  'DELIVERED',
  'CANCELLED',
]);
export type SaleOrderStatus = z.infer<typeof SaleOrderStatusEnum>;

export const PaymentMethodEnum = z.enum(['CASH', 'CHEQUE', 'BANK_TRANSFER', 'UPI']);
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

export const PriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export type Priority = z.infer<typeof PriorityEnum>;

export const ProductionStageEnum = z.enum([
  'CUTTING',
  'STITCHING',
  'FINISHING',
  'CHECKING',
  'PACKING',
  'ORDER_RECEIVED',
  'PENDING_COSTING',
  'PENDING_GREIGE_ORDER',
  'TRIMS_NOT_ORDERED',
  'IN_PRINTING',
  'IN_DYING',
  'IN_EMBROIDERY',
  'IN_HANDWORK',
  'IN_CUTTING',
  'IN_STITCHING',
  'IN_FINISHING',
  'IN_SMOCKING',
  'READY_TO_SHIP',
  'SHIPPED',
  'COMPLETED',
]);
export type ProductionStage = z.infer<typeof ProductionStageEnum>;

export const PurchaseOrderStatusEnum = z.enum([
  'DRAFT',
  'SENT',
  'ACKNOWLEDGED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED',
  'PENDING_GREIGE',
  'READY_FOR_PROCESSING',
]);
export type PurchaseOrderStatus = z.infer<typeof PurchaseOrderStatusEnum>;

export const POCategoryEnum = z.enum([
  'FABRIC',
  'GREIGE',
  'PROCESSING',
  'TRIMS',
  'THREAD',
  'LACE',
  'GREIGE_LACE',
  'LACE_PROCESSING',
  'GENERAL',
  'BUTTON',
  'ZIPPER',
  'ELASTIC',
  'LABEL',
  'PACKAGING',
  'MACHINE_PART',
  'OTHER_MATERIAL',
  'EMBROIDERY_SERVICE',
  'WASHING_SERVICE',
  'FINISHING_SERVICE',
  'CUTTING_SERVICE',
  'STITCHING_SERVICE',
  'HANDWORK_SERVICE',
  'SMOCKING_SERVICE',
  'TRANSPORTATION_SERVICE',
]);
export type POCategory = z.infer<typeof POCategoryEnum>;

export const POSourceEnum = z.enum(['MANUAL', 'COST_SHEET', 'MRP', 'SERVICE_REQUIREMENT', 'PRODUCTION_RUN']);
export type POSource = z.infer<typeof POSourceEnum>;

export const ServiceTypeEnum = z.enum([
  'EMBROIDERY',
  'PRINTING',
  'DYEING',
  'WASHING',
  'FINISHING',
  'CUTTING',
  'STITCHING',
  'HANDWORK',
  'SMOCKING',
  'TRANSPORTATION',
  'OTHER',
]);
export type ServiceType = z.infer<typeof ServiceTypeEnum>;

export const ServiceRequirementStatusEnum = z.enum([
  'PENDING',
  'PO_GENERATED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);
export type ServiceRequirementStatus = z.infer<typeof ServiceRequirementStatusEnum>;

export const ChallanTypeEnum = z.enum(['OUTWARD', 'INWARD', 'INTERNAL']);
export type ChallanType = z.infer<typeof ChallanTypeEnum>;

export const ChallanStatusEnum = z.enum([
  'DRAFT',
  'ISSUED',
  'IN_TRANSIT',
  'RECEIVED',
  'PARTIALLY_RECEIVED',
  'CANCELLED',
]);
export type ChallanStatus = z.infer<typeof ChallanStatusEnum>;

export const DefectDispositionEnum = z.enum([
  'PENDING',
  'SCRAP',
  'REWORK_INITIATED',
  'REWORK_COMPLETED',
  'RETURN_TO_VENDOR',
  'DOWNGRADE',
  'DISPOSED',
]);
export type DefectDisposition = z.infer<typeof DefectDispositionEnum>;

export const QualityStatusEnum = z.enum(['PASS', 'FAIL', 'CONDITIONAL_PASS']);
export type QualityStatus = z.infer<typeof QualityStatusEnum>;

export const QuotationStatusEnum = z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']);
export type QuotationStatus = z.infer<typeof QuotationStatusEnum>;

export const RequisitionStatusEnum = z.enum(['PENDING', 'ISSUED', 'RECEIVED']);
export type RequisitionStatus = z.infer<typeof RequisitionStatusEnum>;

export const SampleStatusEnum = z.enum([
  'REQUESTED',
  'IN_PROGRESS',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'SENT',
  'FEEDBACK_PENDING',
  'REVISION_NEEDED',
  'APPROVED_WITH_COMMENTS',
]);
export type SampleStatus = z.infer<typeof SampleStatusEnum>;

export const SampleTypeEnum = z.enum([
  'FIT_SAMPLE',
  'PHOTO_SAMPLE',
  'PRODUCTION_SAMPLE',
  'PP_SAMPLE',
  'SIZE_SET_SAMPLE',
  'SHIPMENT_SAMPLE',
]);
export type SampleType = z.infer<typeof SampleTypeEnum>;

export const SeverityEnum = z.enum(['MINOR', 'MAJOR', 'CRITICAL']);
export type Severity = z.infer<typeof SeverityEnum>;

export const SupplierCategoryEnum = z.enum([
  'FABRIC_SUPPLIER',
  'GREIGE_SUPPLIER',
  'TRIMS_SUPPLIER',
  'THREAD_SUPPLIER',
  'PACKAGING_SUPPLIER',
  'LACE_SUPPLIER',
  'DYEING_PRINTING',
  'EMBROIDERY',
  'HAND_WORK',
  'SMOCKING',
  'CMT_UNIT',
  'FINISHING_CONTRACTOR',
  'STITCHING_CONTRACTOR',
  'WASHING',
  'DORI_PIPING_CONTRACTOR',
  'MACHINE_PARTS_SUPPLIER',
  'OTHER_SERVICES',
]);
export type SupplierCategory = z.infer<typeof SupplierCategoryEnum>;

export const TransactionTypeEnum = z.enum(['STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'TRANSFER']);
export type TransactionType = z.infer<typeof TransactionTypeEnum>;

export const StockStatusEnum = z.enum(['AVAILABLE', 'RESERVED', 'EXHAUSTED', 'ISSUED', 'PENDING_RETURN']);
export type StockStatus = z.infer<typeof StockStatusEnum>;

export const StockEntryTypeEnum = z.enum([
  'GENERIC',
  'PLANNED_STOCK',
  'EXCESS',
  'EXCESS_MOQ',
  'CROSS_STYLE_REUSE',
  'RETURNED',
  'VARIANCE_UNUSED',
]);
export type StockEntryType = z.infer<typeof StockEntryTypeEnum>;

export const SpecializedStockTransactionTypeEnum = z.enum([
  'STOCK_IN',
  'CONSUMPTION',
  'RETURN',
  'RETURN_TO_SUPPLIER',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'ALLOCATION',
  'TRANSFER',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'ISSUE',
  'RECEIPT',
  'PRICE_CORRECTION',
  'EMBROIDERY_SEND_OUT',
  'EMBROIDERY_RECEIPT',
  'EMBROIDERY_CANCELLED',
  'QUALITY_DOWNGRADE',
]);
export type SpecializedStockTransactionType = z.infer<typeof SpecializedStockTransactionTypeEnum>;

export const TransactionReferenceTypeEnum = z.enum([
  'MANUAL',
  'MANUAL_ADJUSTMENT',
  'CHALLAN',
  'GRN',
  'GRN_REJECTION',
  'PROCESSING_BATCH',
  'ORDER',
  'TRANSFER',
  'ALLOCATION',
  'ISSUE_NOTE',
  'EMBROIDERY_SEND_OUT',
  'MATERIAL_REQUIREMENT',
  'PROCESSING_DELIVERY',
  'PROCUREMENT',
  'ADJUSTMENT',
  'JOB_WORK_ORDER',
  'EXTERNAL_PROCESS',
]);
export type TransactionReferenceType = z.infer<typeof TransactionReferenceTypeEnum>;

export const UnitEnum = z.enum([
  'METER',
  'PIECE',
  'KILOGRAM',
  'SET',
  'YARD',
  'DOZEN',
  'GROSS',
  'TUBE',
  'CONE',
  'SPOOL',
  'BOX',
  'PAIR',
  'PACK',
  'GRAM',
  'LITER',
  'ROLL',
]);
export type Unit = z.infer<typeof UnitEnum>;

export const MaterialTypeEnum = z.enum([
  'GENERIC',
  'TRIMS',
  'LACE',
  'BUTTON',
  'THREAD',
  'ZIPPER',
  'ELASTIC',
  'LABEL',
  'PACKAGING',
  'ACCESSORIES',
  'SERVICE',
  'MACHINE_PART',
  'OTHER',
  'FABRIC',
  'GREIGE',
  'HOOK_EYE',
  'SNAP_BUTTON',
  'BUCKLE',
  'BELT',
  'VELCRO',
  'DRAWSTRING',
  'RIBBON',
  'SEQUIN',
  'BEAD',
  'MOTIF',
  'INTERLINING',
  'PADDING',
  'OTHER_FASTENER',
  'OTHER_TAPE',
  'OTHER_DECORATIVE',
  'OTHER_FUNCTIONAL',
  'OTHER_MATERIAL',
]);
export type MaterialType = z.infer<typeof MaterialTypeEnum>;

export const MaterialUsageCategoryEnum = z.enum(['GARMENT_TRIM', 'VALUE_ADDITION', 'PACKAGING']);
export type MaterialUsageCategory = z.infer<typeof MaterialUsageCategoryEnum>;

export const ThreadPackagingTypeEnum = z.enum(['CONE', 'TUBE', 'SPOOL', 'CONE_5K', 'CONE_10K']);
export type ThreadPackagingType = z.infer<typeof ThreadPackagingTypeEnum>;

export const ThreadPlyEnum = z.enum(['TWO_PLY', 'THREE_PLY']);
export type ThreadPly = z.infer<typeof ThreadPlyEnum>;

export const ThreadMaterialEnum = z.enum(['POLYESTER', 'COTTON']);
export type ThreadMaterial = z.infer<typeof ThreadMaterialEnum>;

export const ThreadQuantityInputEnum = z.enum(['UNITS', 'BOXES']);
export type ThreadQuantityInput = z.infer<typeof ThreadQuantityInputEnum>;

export const ThreadRequirementStatusEnum = z.enum([
  'PENDING',
  'PO_GENERATED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED',
]);
export type ThreadRequirementStatus = z.infer<typeof ThreadRequirementStatusEnum>;

export const LabelCategoryEnum = z.enum(['SEWN_IN', 'HANGTAG', 'PRICE_TAG']);
export type LabelCategory = z.infer<typeof LabelCategoryEnum>;

export const UserRoleEnum = z.enum([
  'ADMIN',
  'PRODUCTION_MANAGER',
  'SALES',
  'INVENTORY',
  'ACCOUNTS',
  'QUALITY',
  'PURCHASE',
  'FACTORY_SUPERVISOR',
  'MERCHANDISER',
]);
export type UserRole = z.infer<typeof UserRoleEnum>;

export const TestTemplateTypeEnum = z.enum(['FPT', 'GPT']);
export type TestTemplateType = z.infer<typeof TestTemplateTypeEnum>;

export const TestResultEnum = z.enum(['PENDING', 'PASS', 'FAIL', 'RETEST_REQUIRED', 'CONDITIONAL_PASS']);
export type TestResult = z.infer<typeof TestResultEnum>;

export const WarehouseTypeEnum = z.enum([
  'RAW_MATERIAL',
  'FINISHED_GOODS',
  'WORK_IN_PROGRESS',
  'GENERAL',
  'TRANSIT',
  'JOB_WORK',
]);
export type WarehouseType = z.infer<typeof WarehouseTypeEnum>;

export const GreigeQualityEnum = z.enum(['PRINTING', 'DYEING', 'SUPER_DYEING']);
export type GreigeQuality = z.infer<typeof GreigeQualityEnum>;

export const MovementTypeEnum = z.enum([
  'STOCK_IN',
  'STOCK_OUT',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
]);
export type MovementType = z.infer<typeof MovementTypeEnum>;

export const StateTypeEnum = z.enum(['STATE', 'UNION_TERRITORY']);
export type StateType = z.infer<typeof StateTypeEnum>;

export const CityTierEnum = z.enum(['TIER_1', 'TIER_2', 'TIER_3']);
export type CityTier = z.infer<typeof CityTierEnum>;

export const ReservationTypeEnum = z.enum(['ORDER', 'WORK_ORDER', 'MATERIAL_REQUISITION']);
export type ReservationType = z.infer<typeof ReservationTypeEnum>;

export const ReservationStatusEnum = z.enum(['ACTIVE', 'CONSUMED', 'CANCELLED', 'EXPIRED']);
export type ReservationStatus = z.infer<typeof ReservationStatusEnum>;

export const CountTypeEnum = z.enum(['FULL', 'PARTIAL', 'CYCLE', 'SPOT_CHECK']);
export type CountType = z.infer<typeof CountTypeEnum>;

export const CountStatusEnum = z.enum(['DRAFT', 'IN_PROGRESS', 'COUNTED', 'VERIFIED', 'APPROVED', 'CANCELLED']);
export type CountStatus = z.infer<typeof CountStatusEnum>;

export const StockTransactionTypeEnum = z.enum(['IN', 'OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT']);
export type StockTransactionType = z.infer<typeof StockTransactionTypeEnum>;

export const AccountTypeEnum = z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']);
export type AccountType = z.infer<typeof AccountTypeEnum>;

export const AccountGroupEnum = z.enum([
  'CURRENT_ASSET',
  'FIXED_ASSET',
  'CURRENT_LIABILITY',
  'LONG_TERM_LIABILITY',
  'EQUITY',
  'DIRECT_REVENUE',
  'INDIRECT_REVENUE',
  'DIRECT_EXPENSE',
  'INDIRECT_EXPENSE',
  'OVERHEAD',
]);
export type AccountGroup = z.infer<typeof AccountGroupEnum>;

export const TaxTypeEnum = z.enum(['GST', 'IGST', 'SGST', 'CGST', 'VAT', 'CUSTOMS_DUTY', 'EXCISE_DUTY', 'SERVICE_TAX']);
export type TaxType = z.infer<typeof TaxTypeEnum>;

export const HSNSACTypeEnum = z.enum(['HSN', 'SAC']);
export type HSNSACType = z.infer<typeof HSNSACTypeEnum>;

export const ExpenseCategoryEnum = z.enum(['DIRECT', 'INDIRECT', 'OVERHEAD', 'ADMINISTRATIVE', 'MARKETING']);
export type ExpenseCategory = z.infer<typeof ExpenseCategoryEnum>;

export const BankAccountTypeEnum = z.enum(['CURRENT', 'SAVINGS', 'OD', 'CC']);
export type BankAccountType = z.infer<typeof BankAccountTypeEnum>;

export const RateTypeEnum = z.enum(['BUYING', 'SELLING', 'AVERAGE']);
export type RateType = z.infer<typeof RateTypeEnum>;

export const MaterialRequirementStatusEnum = z.enum([
  'PENDING',
  'FULFILLED_STOCK',
  'PARTIAL_STOCK',
  'PO_REQUIRED',
  'PO_GENERATED',
  'PO_SENT',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED',
  'CONVERTED',
]);
export type MaterialRequirementStatus = z.infer<typeof MaterialRequirementStatusEnum>;

export const RequirementSourceEnum = z.enum(['SALES_ORDER', 'WORK_ORDER', 'MANUAL']);
export type RequirementSource = z.infer<typeof RequirementSourceEnum>;

export const CuttingBatchStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD']);
export type CuttingBatchStatus = z.infer<typeof CuttingBatchStatusEnum>;

export const StitchingIssueStatusEnum = z.enum(['PENDING_RECEIPT', 'RECEIVED', 'IN_PROGRESS', 'COMPLETED']);
export type StitchingIssueStatus = z.infer<typeof StitchingIssueStatusEnum>;

export const FinishingStatusEnum = z.enum(['PENDING_RECEIPT', 'RECEIVED', 'IN_PROGRESS', 'PACKING', 'COMPLETED']);
export type FinishingStatus = z.infer<typeof FinishingStatusEnum>;

export const TransferSlipStatusEnum = z.enum(['CREATED', 'PRINTED', 'CONFIRMED', 'RECEIVED', 'DEVIATION_RECORDED']);
export type TransferSlipStatus = z.infer<typeof TransferSlipStatusEnum>;

export const PackingTypeEnum = z.enum(['SOLID', 'ASSORTED']);
export type PackingType = z.infer<typeof PackingTypeEnum>;

export const LabDipStatusEnum = z.enum(['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RESUBMIT']);
export type LabDipStatus = z.infer<typeof LabDipStatusEnum>;

export const BuyerApprovalStatusEnum = z.enum(['NOT_SENT', 'PENDING', 'APPROVED', 'REJECTED', 'RESUBMIT_REQUIRED']);
export type BuyerApprovalStatus = z.infer<typeof BuyerApprovalStatusEnum>;

export const JobWorkStatusEnum = z.enum([
  'LAB_DIP_PENDING',
  'LAB_DIP_SUBMITTED',
  'LAB_DIP_APPROVED',
  'READY_TO_SEND',
  'SENT_TO_MILL',
  'AT_MILL',
  'RECEIVED',
  'QUALITY_CHECKED',
  'STOCK_UPDATED',
  'CANCELLED',
]);
export type JobWorkStatus = z.infer<typeof JobWorkStatusEnum>;

export const JobWorkOrderStatusEnum = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'ISSUED',
  'IN_TRANSIT',
  'AT_PROCESSOR',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'QUALITY_CHECKED',
  'STOCK_UPDATED',
  'CLOSED',
  'CANCELLED',
]);
export type JobWorkOrderStatus = z.infer<typeof JobWorkOrderStatusEnum>;

export const PrintMethodEnum = z.enum(['SCREEN_MACHINE', 'SCREEN_HAND', 'ROTARY', 'BLOCK']);
export type PrintMethod = z.infer<typeof PrintMethodEnum>;

export const PrintChemistryEnum = z.enum(['PIGMENT', 'PROCIAN', 'DISCHARGE']);
export type PrintChemistry = z.infer<typeof PrintChemistryEnum>;

export const ASNStatusEnum = z.enum(['PENDING', 'APPLIED', 'APPROVED', 'REJECTED', 'RESCHEDULE']);
export type ASNStatus = z.infer<typeof ASNStatusEnum>;

export const DeliveryConfirmationEnum = z.enum(['DELIVERED', 'PARTIAL', 'REJECTED']);
export type DeliveryConfirmation = z.infer<typeof DeliveryConfirmationEnum>;

export const InspectionStatusEnum = z.enum(['PASS', 'FAIL', 'CONDITIONAL']);
export type InspectionStatus = z.infer<typeof InspectionStatusEnum>;

export const ConversationStatusEnum = z.enum(['ACTIVE', 'ARCHIVED', 'DELETED']);
export type ConversationStatus = z.infer<typeof ConversationStatusEnum>;

export const AIMessageRoleEnum = z.enum(['USER', 'ASSISTANT', 'SYSTEM']);
export type AIMessageRole = z.infer<typeof AIMessageRoleEnum>;

export const ActionStatusEnum = z.enum(['PENDING', 'CONFIRMED', 'REJECTED', 'EXECUTED', 'EXPIRED']);
export type ActionStatus = z.infer<typeof ActionStatusEnum>;

export const FeedbackRatingEnum = z.enum(['HELPFUL', 'NOT_HELPFUL']);
export type FeedbackRating = z.infer<typeof FeedbackRatingEnum>;

export const SeasonTypeEnum = z.enum(['SS', 'AW']);
export type SeasonType = z.infer<typeof SeasonTypeEnum>;

export const DocumentStatusEnum = z.enum(['DRAFT', 'APPROVED', 'CANCELLED']);
export type DocumentStatus = z.infer<typeof DocumentStatusEnum>;

export const CreditNoteReasonEnum = z.enum([
  'SALES_RETURN',
  'RATE_DIFFERENCE',
  'QUALITY_ISSUE',
  'QUANTITY_DIFFERENCE',
  'OTHER',
]);
export type CreditNoteReason = z.infer<typeof CreditNoteReasonEnum>;

export const DebitNoteReasonEnum = z.enum([
  'PURCHASE_RETURN',
  'RATE_DIFFERENCE',
  'QUALITY_ISSUE',
  'QUANTITY_SHORT',
  'DAMAGED_GOODS',
  'OTHER',
]);
export type DebitNoteReason = z.infer<typeof DebitNoteReasonEnum>;

export const SupplyTypeEnum = z.enum([
  'DOMESTIC',
  'EXPORT_WITH_PAYMENT',
  'EXPORT_WITHOUT_PAYMENT',
  'SEZ_WITH_PAYMENT',
  'SEZ_WITHOUT_PAYMENT',
  'DEEMED_EXPORT',
]);
export type SupplyType = z.infer<typeof SupplyTypeEnum>;

export const TDSStatusEnum = z.enum(['PENDING', 'CERTIFICATE_RECEIVED', 'VERIFIED']);
export type TDSStatus = z.infer<typeof TDSStatusEnum>;

export const ExternalProcessTypeEnum = z.enum(['EMBROIDERY_PIECE', 'SMOCKING', 'HANDWORK']);
export type ExternalProcessType = z.infer<typeof ExternalProcessTypeEnum>;

export const ExternalProcessSourceTypeEnum = z.enum(['CUTTING_BATCH', 'FABRIC_STOCK', 'STITCHING_ISSUE']);
export type ExternalProcessSourceType = z.infer<typeof ExternalProcessSourceTypeEnum>;

export const ExternalProcessStatusEnum = z.enum(['DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']);
export type ExternalProcessStatus = z.infer<typeof ExternalProcessStatusEnum>;
