-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AIMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."ASNStatus" AS ENUM ('PENDING', 'APPLIED', 'APPROVED', 'REJECTED', 'RESCHEDULE');

-- CreateEnum
CREATE TYPE "public"."AccountGroup" AS ENUM ('CURRENT_ASSET', 'FIXED_ASSET', 'CURRENT_LIABILITY', 'LONG_TERM_LIABILITY', 'EQUITY', 'DIRECT_REVENUE', 'INDIRECT_REVENUE', 'DIRECT_EXPENSE', 'INDIRECT_EXPENSE', 'OVERHEAD');

-- CreateEnum
CREATE TYPE "public"."AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "public"."ActionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'EXECUTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."AgeGroup" AS ENUM ('ADULT', 'KIDS_1_3Y', 'KIDS_4_7Y', 'KIDS_8_14Y');

-- CreateEnum
CREATE TYPE "public"."BankAccountType" AS ENUM ('CURRENT', 'SAVINGS', 'OD', 'CC');

-- CreateEnum
CREATE TYPE "public"."BusinessType" AS ENUM ('B2B', 'B2C');

-- CreateEnum
CREATE TYPE "public"."CADStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'APPROVED');

-- CreateEnum
CREATE TYPE "public"."CadPurpose" AS ENUM ('COSTING', 'RAW_MATERIAL_CALCULATION', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "public"."ChallanStatus" AS ENUM ('DRAFT', 'ISSUED', 'IN_TRANSIT', 'RECEIVED', 'PARTIALLY_RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ChallanType" AS ENUM ('OUTWARD', 'INWARD', 'INTERNAL');

-- CreateEnum
CREATE TYPE "public"."CityTier" AS ENUM ('TIER_1', 'TIER_2', 'TIER_3');

-- CreateEnum
CREATE TYPE "public"."ConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."CostSheetApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."CostSheetPurpose" AS ENUM ('COSTING', 'PROCUREMENT_PRODUCTION', 'RAW_MATERIAL_CALCULATION', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "public"."CostSheetVarianceStatus" AS ENUM ('PENDING', 'WITHIN_BUDGET', 'REQUIRES_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."CountStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COUNTED', 'VERIFIED', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."CountType" AS ENUM ('FULL', 'PARTIAL', 'CYCLE', 'SPOT_CHECK');

-- CreateEnum
CREATE TYPE "public"."CreditNoteReason" AS ENUM ('SALES_RETURN', 'RATE_DIFFERENCE', 'QUALITY_ISSUE', 'QUANTITY_DIFFERENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."CustomerCategory" AS ENUM ('DOMESTIC', 'EXPORT', 'WHOLESALER', 'RETAILER');

-- CreateEnum
CREATE TYPE "public"."CustomerType" AS ENUM ('BUYER');

-- CreateEnum
CREATE TYPE "public"."CuttingBatchStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "public"."DebitNoteReason" AS ENUM ('PURCHASE_RETURN', 'RATE_DIFFERENCE', 'QUALITY_ISSUE', 'QUANTITY_SHORT', 'DAMAGED_GOODS', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."DeliveryConfirmation" AS ENUM ('DELIVERED', 'PARTIAL', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."DeliveryStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'DELIVERED');

-- CreateEnum
CREATE TYPE "public"."DocumentStatus" AS ENUM ('DRAFT', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ExpenseCategory" AS ENUM ('DIRECT', 'INDIRECT', 'OVERHEAD', 'ADMINISTRATIVE', 'MARKETING');

-- CreateEnum
CREATE TYPE "public"."FabricFinishType" AS ENUM ('DYED', 'PRINTED', 'YARN_DYED', 'RAW');

-- CreateEnum
CREATE TYPE "public"."FeedbackRating" AS ENUM ('HELPFUL', 'NOT_HELPFUL');

-- CreateEnum
CREATE TYPE "public"."FinishingStatus" AS ENUM ('PENDING_RECEIPT', 'RECEIVED', 'IN_PROGRESS', 'PACKING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."GRNStatus" AS ENUM ('PENDING_QC', 'ACCEPTED', 'REJECTED', 'PARTIALLY_ACCEPTED');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('MEN', 'WOMEN', 'KIDS', 'UNISEX');

-- CreateEnum
CREATE TYPE "public"."GreigeRateSource" AS ENUM ('PROCUREMENT', 'STOCK_VALUATION', 'GREIGE_MASTER', 'MANUAL_OVERRIDE');

-- CreateEnum
CREATE TYPE "public"."HSNSACType" AS ENUM ('HSN', 'SAC');

-- CreateEnum
CREATE TYPE "public"."InspectionStatus" AS ENUM ('PASS', 'FAIL', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "public"."InspectionType" AS ENUM ('INLINE', 'FINAL', 'AQL', 'RANDOM', 'MIDLINE');

-- CreateEnum
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "public"."JobWorkStatus" AS ENUM ('LAB_DIP_PENDING', 'LAB_DIP_SUBMITTED', 'LAB_DIP_APPROVED', 'READY_TO_SEND', 'SENT_TO_MILL', 'AT_MILL', 'RECEIVED', 'QUALITY_CHECKED', 'STOCK_UPDATED');

-- CreateEnum
CREATE TYPE "public"."LabDipStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RESUBMIT');

-- CreateEnum
CREATE TYPE "public"."LabelCategory" AS ENUM ('SEWN_IN', 'HANGTAG', 'PRICE_TAG');

-- CreateEnum
CREATE TYPE "public"."LaceLabDipStatus" AS ENUM ('PENDING', 'SENT_TO_PROCESSOR', 'SAMPLE_RECEIVED', 'AWAITING_BUYER_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."LocationType" AS ENUM ('FACTORY', 'WAREHOUSE', 'OFFICE');

-- CreateEnum
CREATE TYPE "public"."MarketType" AS ENUM ('INTERNATIONAL', 'DOMESTIC');

-- CreateEnum
CREATE TYPE "public"."MaterialRequirementStatus" AS ENUM ('PENDING', 'FULFILLED_STOCK', 'PARTIAL_STOCK', 'PO_REQUIRED', 'PO_GENERATED', 'PO_SENT', 'RECEIVED', 'CANCELLED', 'PARTIALLY_RECEIVED');

-- CreateEnum
CREATE TYPE "public"."MaterialType" AS ENUM ('GENERIC', 'GREIGE_FABRIC', 'FINISHED_FABRIC', 'TRIMS', 'LACE', 'BUTTON', 'THREAD', 'ZIPPER', 'ELASTIC', 'LABEL', 'PACKAGING', 'ACCESSORIES', 'SERVICE', 'MACHINE_PART', 'OTHER', 'FABRIC', 'GREIGE', 'HOOK_EYE', 'SNAP_BUTTON', 'BUCKLE', 'BELT', 'VELCRO', 'DRAWSTRING', 'RIBBON', 'SEQUIN', 'BEAD', 'MOTIF', 'INTERLINING', 'PADDING', 'OTHER_FASTENER', 'OTHER_TAPE', 'OTHER_DECORATIVE', 'OTHER_FUNCTIONAL', 'OTHER_MATERIAL');

-- CreateEnum
CREATE TYPE "public"."MaterialUsageCategory" AS ENUM ('GARMENT_TRIM', 'VALUE_ADDITION', 'PACKAGING');

-- CreateEnum
CREATE TYPE "public"."MovementType" AS ENUM ('STOCK_IN', 'STOCK_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('INFO', 'WARNING', 'ALERT', 'SUCCESS');

-- CreateEnum
CREATE TYPE "public"."OrderBOMStatus" AS ENUM ('DRAFT', 'APPROVED', 'LOCKED');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING', 'IN_PRODUCTION', 'COMPLETED', 'DISPATCHED', 'CANCELLED', 'SPLIT');

-- CreateEnum
CREATE TYPE "public"."POCategory" AS ENUM ('FABRIC', 'GREIGE', 'PROCESSING', 'TRIMS', 'LACE', 'GREIGE_LACE', 'LACE_PROCESSING', 'GENERAL', 'EMBROIDERY_SERVICE', 'WASHING_SERVICE', 'FINISHING_SERVICE', 'CUTTING_SERVICE', 'STITCHING_SERVICE', 'HANDWORK_SERVICE', 'SMOCKING_SERVICE', 'TRANSPORTATION_SERVICE');

-- CreateEnum
CREATE TYPE "public"."POSource" AS ENUM ('MANUAL', 'COST_SHEET', 'MRP', 'SERVICE_REQUIREMENT', 'PRODUCTION_RUN');

-- CreateEnum
CREATE TYPE "public"."PackingType" AS ENUM ('SOLID', 'ASSORTED');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CASH', 'CHEQUE', 'BANK_TRANSFER', 'UPI');

-- CreateEnum
CREATE TYPE "public"."PrintChemistry" AS ENUM ('PIGMENT', 'PROCIAN', 'DISCHARGE');

-- CreateEnum
CREATE TYPE "public"."PrintDirection" AS ENUM ('ONE_WAY', 'TWO_WAY');

-- CreateEnum
CREATE TYPE "public"."PrintMethod" AS ENUM ('SCREEN_MACHINE', 'SCREEN_HAND', 'ROTARY', 'BLOCK');

-- CreateEnum
CREATE TYPE "public"."PrintingType" AS ENUM ('PIGMENT', 'PROCIAN', 'DISCHARGE', 'PIGMENT_DISCHARGE');

-- CreateEnum
CREATE TYPE "public"."Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "public"."ProcessType" AS ENUM ('PRINTING', 'DYEING', 'EMBROIDERY', 'CUTTING', 'STITCHING', 'FINISHING', 'WASHING', 'TRANSPORTATION', 'HANDWORK', 'SMOCKING');

-- CreateEnum
CREATE TYPE "public"."ProductionStage" AS ENUM ('CUTTING', 'STITCHING', 'FINISHING', 'CHECKING', 'PACKING', 'ORDER_RECEIVED', 'PENDING_COSTING', 'PENDING_GREIGE_ORDER', 'TRIMS_NOT_ORDERED', 'IN_PRINTING', 'IN_DYING', 'IN_EMBROIDERY', 'IN_HANDWORK', 'IN_CUTTING', 'IN_STITCHING', 'IN_FINISHING', 'READY_TO_SHIP', 'SHIPPED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."PurchaseOrderStatus" AS ENUM ('DRAFT', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED', 'PENDING_GREIGE', 'READY_FOR_PROCESSING');

-- CreateEnum
CREATE TYPE "public"."QualityStatus" AS ENUM ('PASS', 'FAIL', 'CONDITIONAL_PASS');

-- CreateEnum
CREATE TYPE "public"."QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."RateType" AS ENUM ('BUYING', 'SELLING', 'AVERAGE');

-- CreateEnum
CREATE TYPE "public"."RequirementSource" AS ENUM ('SALES_ORDER', 'WORK_ORDER', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."RequisitionStatus" AS ENUM ('PENDING', 'ISSUED', 'RECEIVED');

-- CreateEnum
CREATE TYPE "public"."ReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."ReservationType" AS ENUM ('ORDER', 'WORK_ORDER', 'MATERIAL_REQUISITION');

-- CreateEnum
CREATE TYPE "public"."SampleStatus" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'SENT', 'FEEDBACK_PENDING', 'REVISION_NEEDED', 'APPROVED_WITH_COMMENTS');

-- CreateEnum
CREATE TYPE "public"."SampleType" AS ENUM ('FIT_SAMPLE', 'PHOTO_SAMPLE', 'PRODUCTION_SAMPLE', 'PP_SAMPLE', 'SIZE_SET_SAMPLE', 'SHIPMENT_SAMPLE');

-- CreateEnum
CREATE TYPE "public"."SeasonType" AS ENUM ('SS', 'AW');

-- CreateEnum
CREATE TYPE "public"."ServiceRequirementStatus" AS ENUM ('PENDING', 'PO_GENERATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ServiceType" AS ENUM ('EMBROIDERY', 'PRINTING', 'DYEING', 'WASHING', 'FINISHING', 'CUTTING', 'STITCHING', 'HANDWORK', 'SMOCKING', 'TRANSPORTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."Severity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."StateType" AS ENUM ('STATE', 'UNION_TERRITORY');

-- CreateEnum
CREATE TYPE "public"."StitchingIssueStatus" AS ENUM ('PENDING_RECEIPT', 'RECEIVED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."StockTransactionType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT');

-- CreateEnum
CREATE TYPE "public"."StyleImageType" AS ENUM ('MAIN', 'SKETCH_FRONT', 'SKETCH_BACK', 'SKETCH_SIDE', 'TECHNICAL_FLAT', 'DETAIL_VIEW', 'CONSTRUCTION', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."StyleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."SupplierCategory" AS ENUM ('FABRIC_SUPPLIER', 'TRIMS_SUPPLIER', 'THREAD_SUPPLIER', 'PACKAGING_SUPPLIER', 'LACE_SUPPLIER', 'DYEING_PRINTING', 'EMBROIDERY', 'HAND_WORK', 'SMOCKING', 'CMT_UNIT', 'FINISHING_CONTRACTOR', 'STITCHING_CONTRACTOR', 'WASHING', 'DORI_PIPING_CONTRACTOR', 'MACHINE_PARTS_SUPPLIER', 'OTHER_SERVICES', 'GREIGE_SUPPLIER');

-- CreateEnum
CREATE TYPE "public"."SupplyType" AS ENUM ('DOMESTIC', 'EXPORT_WITH_PAYMENT', 'EXPORT_WITHOUT_PAYMENT', 'SEZ_WITH_PAYMENT', 'SEZ_WITHOUT_PAYMENT', 'DEEMED_EXPORT');

-- CreateEnum
CREATE TYPE "public"."TDSStatus" AS ENUM ('PENDING', 'CERTIFICATE_RECEIVED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "public"."TaxType" AS ENUM ('GST', 'IGST', 'SGST', 'CGST', 'VAT', 'CUSTOMS_DUTY', 'EXCISE_DUTY', 'SERVICE_TAX');

-- CreateEnum
CREATE TYPE "public"."TestResult" AS ENUM ('PENDING', 'PASS', 'FAIL', 'RETEST_REQUIRED', 'CONDITIONAL_PASS');

-- CreateEnum
CREATE TYPE "public"."TestTemplateType" AS ENUM ('FPT', 'GPT');

-- CreateEnum
CREATE TYPE "public"."ThreadMaterial" AS ENUM ('POLYESTER', 'COTTON');

-- CreateEnum
CREATE TYPE "public"."ThreadPackagingType" AS ENUM ('CONE', 'TUBE', 'SPOOL', 'CONE_5K', 'CONE_10K');

-- CreateEnum
CREATE TYPE "public"."ThreadPly" AS ENUM ('TWO_PLY', 'THREE_PLY');

-- CreateEnum
CREATE TYPE "public"."ThreadQuantityInput" AS ENUM ('UNITS', 'BOXES');

-- CreateEnum
CREATE TYPE "public"."TransactionType" AS ENUM ('STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "public"."TransferSlipStatus" AS ENUM ('CREATED', 'PRINTED', 'CONFIRMED', 'RECEIVED', 'DEVIATION_RECORDED');

-- CreateEnum
CREATE TYPE "public"."Unit" AS ENUM ('METER', 'PIECE', 'KILOGRAM', 'SET', 'YARD', 'DOZEN', 'GROSS', 'TUBE', 'CONE', 'SPOOL', 'BOX');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'PRODUCTION_MANAGER', 'SALES', 'INVENTORY', 'ACCOUNTS', 'QUALITY', 'PURCHASE', 'FACTORY_SUPERVISOR', 'MERCHANDISER');

-- CreateEnum
CREATE TYPE "public"."VarianceApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."WarehouseType" AS ENUM ('RAW_MATERIAL', 'FINISHED_GOODS', 'WORK_IN_PROGRESS', 'GENERAL', 'TRANSIT', 'JOB_WORK');

-- CreateTable
CREATE TABLE "public"."agencies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."agents" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "agencyId" TEXT,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "status" "public"."ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_feedback" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" "public"."FeedbackRating" NOT NULL,
    "issueType" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "public"."AIMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "tokensUsed" INTEGER,
    "latencyMs" INTEGER,
    "actionType" TEXT,
    "actionEntity" TEXT,
    "actionPayload" JSONB,
    "actionStatus" "public"."ActionStatus",
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."asn_applications" (
    "id" TEXT NOT NULL,
    "asnNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "plannedDispatchQty" INTEGER NOT NULL,
    "cartonsPlanned" INTEGER NOT NULL,
    "requestedShipDate" TIMESTAMP(3) NOT NULL,
    "applicationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."ASNStatus" NOT NULL DEFAULT 'PENDING',
    "appointmentDate" TIMESTAMP(3),
    "appointmentTime" TEXT,
    "buyerRefNumber" TEXT,
    "approvedQty" INTEGER,
    "rejectionReason" TEXT,
    "rescheduleDate" TIMESTAMP(3),
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "asn_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."asn_skus" (
    "id" TEXT NOT NULL,
    "asnId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "plannedQty" INTEGER NOT NULL,

    CONSTRAINT "asn_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bank_accounts" (
    "id" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "ifscCode" TEXT,
    "swiftCode" TEXT,
    "accountType" "public"."BankAccountType" NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "openingBalance" DECIMAL(12,2) NOT NULL,
    "currentBalance" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPrimaryAccount" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bead_master" (
    "id" TEXT NOT NULL,
    "beadCode" TEXT NOT NULL,
    "beadName" TEXT NOT NULL,
    "size" TEXT,
    "shape" TEXT,
    "material" TEXT,
    "color" TEXT,
    "pricePerPack" DECIMAL(10,2),
    "packSize" INTEGER,
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "bead_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."belt_master" (
    "id" TEXT NOT NULL,
    "beltCode" TEXT NOT NULL,
    "beltName" TEXT NOT NULL,
    "width" TEXT,
    "type" TEXT,
    "material" TEXT,
    "color" TEXT,
    "buckleType" TEXT,
    "pricePerPiece" DECIMAL(10,2),
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "belt_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."brand_categories" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subCategory" TEXT,
    "subSubCategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productCategoryId" TEXT,

    CONSTRAINT "brand_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."buckle_master" (
    "id" TEXT NOT NULL,
    "buckleCode" TEXT NOT NULL,
    "buckleName" TEXT NOT NULL,
    "width" TEXT,
    "type" TEXT,
    "material" TEXT,
    "color" TEXT,
    "finish" TEXT,
    "pricePerPiece" DECIMAL(10,2),
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "buckle_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."button_master" (
    "id" TEXT NOT NULL,
    "buttonCode" TEXT NOT NULL,
    "buttonName" TEXT NOT NULL,
    "supplierCode" TEXT,
    "buyerCode" TEXT,
    "size" TEXT,
    "holes" INTEGER,
    "color" TEXT,
    "material" TEXT,
    "shape" TEXT,
    "pricePerPiece" DECIMAL(10,2),
    "pricePerGross" DECIMAL(10,2),
    "image" TEXT,
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "button_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."button_style_associations" (
    "id" TEXT NOT NULL,
    "buttonId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "button_style_associations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."button_suppliers" (
    "id" TEXT NOT NULL,
    "buttonId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "pricePerPiece" DECIMAL(10,2),
    "pricePerGross" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "button_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cad_size_breakdown" (
    "id" TEXT NOT NULL,
    "cadId" TEXT NOT NULL,
    "sizeName" TEXT NOT NULL,
    "sizeId" TEXT,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cad_size_breakdown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."carton_packings" (
    "id" TEXT NOT NULL,
    "cartonNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "finishingIssueId" TEXT,
    "componentId" TEXT,
    "cartonDate" TIMESTAMP(3) NOT NULL,
    "packingType" "public"."PackingType" NOT NULL,
    "pcsPerCarton" INTEGER NOT NULL,
    "cartonDimensions" TEXT,
    "grossWeight" DECIMAL(10,2),
    "netWeight" DECIMAL(10,2),
    "status" TEXT NOT NULL DEFAULT 'PACKED',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "carton_packings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."carton_skus" (
    "id" TEXT NOT NULL,
    "cartonId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "carton_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."category_component_defaults" (
    "id" TEXT NOT NULL,
    "product_category_id" TEXT NOT NULL,
    "component_master_id" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "defaultCount" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_component_defaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."challan_items" (
    "id" TEXT NOT NULL,
    "challanId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "materialId" TEXT,
    "fabricId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "receivedQty" DECIMAL(12,3),
    "damagedQty" DECIMAL(12,3),
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "colorId" TEXT,
    "sizeId" TEXT,
    "rate" DECIMAL(10,2),
    "remarks" TEXT,
    "greigeStockId" VARCHAR(50),
    "materialRequirementId" TEXT,
    "fabricStockId" VARCHAR(255),
    "laceStockId" VARCHAR(255),
    "serviceRequirementId" VARCHAR(255),

    CONSTRAINT "challan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."challans" (
    "id" TEXT NOT NULL,
    "challanNumber" TEXT NOT NULL,
    "challanType" "public"."ChallanType" NOT NULL,
    "challanDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderId" TEXT,
    "productionRunId" TEXT,
    "purchaseOrderId" TEXT,
    "fromType" TEXT NOT NULL,
    "fromId" TEXT,
    "fromName" TEXT NOT NULL,
    "toType" TEXT NOT NULL,
    "toId" TEXT,
    "toName" TEXT NOT NULL,
    "vehicleNumber" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "lrNumber" TEXT,
    "status" "public"."ChallanStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedDate" TIMESTAMP(3),
    "expectedDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "totalQuantity" DECIMAL(12,3) NOT NULL,
    "receivedQuantity" DECIMAL(12,3),
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "remarks" TEXT,
    "issuedById" TEXT NOT NULL,
    "receivedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fabricProcessingId" TEXT,

    CONSTRAINT "challans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."chart_of_accounts" (
    "id" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountType" "public"."AccountType" NOT NULL,
    "accountGroup" "public"."AccountGroup" NOT NULL,
    "parentAccountId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."color_master" (
    "id" TEXT NOT NULL,
    "colorCode" TEXT NOT NULL,
    "colorName" TEXT NOT NULL,
    "hexCode" TEXT,
    "colorFamily" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "color_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."color_options" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "colorName" TEXT NOT NULL,
    "colorCode" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "colorMasterId" TEXT,

    CONSTRAINT "color_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."component_group_master" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "component_group_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."component_masters" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "componentCategory" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "component_group_id" TEXT,

    CONSTRAINT "component_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."component_pattern_parts" (
    "id" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    "pattern_part_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "component_pattern_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cost_centers" (
    "id" TEXT NOT NULL,
    "costCenterCode" TEXT NOT NULL,
    "costCenterName" TEXT NOT NULL,
    "costCenterType" TEXT NOT NULL,
    "departmentId" TEXT,
    "locationId" TEXT,
    "budgetAmount" DECIMAL(12,2),
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cost_sheet_po_generation" (
    "id" TEXT NOT NULL,
    "costSheetId" TEXT NOT NULL,
    "totalOrderQuantity" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT NOT NULL,
    "fabricPOId" TEXT,
    "greigePOId" TEXT,
    "processingPOId" TEXT,
    "trimsPOId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "greigeLacePOId" TEXT,
    "lacePOId" TEXT,
    "laceProcessingPOId" TEXT,

    CONSTRAINT "cost_sheet_po_generation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."credit_note_items" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "creditNoteId" TEXT NOT NULL,
    "invoiceItemId" TEXT,
    "description" TEXT NOT NULL,
    "hsnCode" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "gstRate" DECIMAL(5,2),
    "cgstAmount" DECIMAL(12,2),
    "sgstAmount" DECIMAL(12,2),
    "igstAmount" DECIMAL(12,2),
    "taxAmount" DECIMAL(12,2),

    CONSTRAINT "credit_note_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."credit_notes" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "creditNoteNumber" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "creditNoteDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" "public"."CreditNoteReason" NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "cgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalTax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "isInterstate" BOOLEAN NOT NULL DEFAULT false,
    "status" "public"."DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."currencies" (
    "id" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "currencyName" TEXT NOT NULL,
    "currencySymbol" TEXT NOT NULL,
    "isBaseCurrency" BOOLEAN NOT NULL DEFAULT false,
    "decimalPlaces" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customer_accessories_preset_items" (
    "id" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "materialType" "public"."MaterialType" NOT NULL,
    "materialId" TEXT,
    "quantity" DECIMAL(10,3),
    "usageCategory" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "componentName" TEXT,
    "extraPercentage" DECIMAL(5,2) DEFAULT 5,
    "labelId" TEXT,

    CONSTRAINT "customer_accessories_preset_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customer_accessories_presets" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "presetName" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_accessories_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customer_gst_numbers" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "gstNumber" TEXT NOT NULL,
    "billingAddress" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stateId" TEXT,
    "billingCityId" TEXT,
    "billingPincode" TEXT,

    CONSTRAINT "customer_gst_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customer_size_category_presets" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "presetName" TEXT NOT NULL,
    "description" TEXT,
    "sizeCategoryId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_size_category_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."CustomerType" NOT NULL,
    "category" "public"."CustomerCategory" NOT NULL,
    "businessType" "public"."BusinessType" NOT NULL DEFAULT 'B2B',
    "market" "public"."MarketType" NOT NULL DEFAULT 'DOMESTIC',
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "billingAddress" TEXT,
    "shippingAddress" TEXT,
    "gstNumber" TEXT,
    "creditLimit" DECIMAL(10,2),
    "creditDays" INTEGER,
    "paymentTermsId" TEXT,
    "currencyCode" TEXT,
    "defaultAccessoriesConfig" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "brandNames" TEXT,
    "categories" TEXT,
    "buyerApprovesGPT" BOOLEAN NOT NULL DEFAULT false,
    "defaultTestingLabId" TEXT,
    "fptBlocksProduction" BOOLEAN NOT NULL DEFAULT false,
    "fptTemplateId" TEXT,
    "gptBlocksShipment" BOOLEAN NOT NULL DEFAULT true,
    "gptTemplateId" TEXT,
    "requiresFPT" BOOLEAN NOT NULL DEFAULT false,
    "requiresGPT" BOOLEAN NOT NULL DEFAULT false,
    "buyerApprovesFPT" BOOLEAN NOT NULL DEFAULT false,
    "billingName" TEXT,
    "billingCityId" TEXT,
    "billingPincode" TEXT,
    "billingStateId" TEXT,
    "shippingCityId" TEXT,
    "shippingPincode" TEXT,
    "shippingStateId" TEXT,
    "agentCommissionPercent" DECIMAL(5,2),
    "agentId" TEXT,
    "agencyId" TEXT,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cutting_batch_defects" (
    "id" TEXT NOT NULL,
    "cuttingBatchId" TEXT NOT NULL,
    "colorId" TEXT,
    "sizeId" TEXT NOT NULL,
    "defectType" TEXT NOT NULL,
    "defectQty" INTEGER NOT NULL,
    "remarks" TEXT,

    CONSTRAINT "cutting_batch_defects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cutting_batch_fabrics" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "fabricStockId" TEXT NOT NULL,
    "cadAvgUsed" DECIMAL(10,4),
    "cadWidthUsed" DECIMAL(10,2),
    "actualWidth" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cutting_batch_fabrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cutting_batch_skus" (
    "id" TEXT NOT NULL,
    "cuttingBatchId" TEXT NOT NULL,
    "colorId" TEXT,
    "sizeId" TEXT NOT NULL,
    "orderQty" INTEGER NOT NULL,
    "extraAllowed" INTEGER NOT NULL DEFAULT 0,
    "maxCuttable" INTEGER NOT NULL,
    "toCut" INTEGER NOT NULL,
    "cutQty" INTEGER NOT NULL DEFAULT 0,
    "rejectedQty" INTEGER NOT NULL DEFAULT 0,
    "goodPcs" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cutting_batch_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cutting_batches" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "componentId" TEXT,
    "cuttingDate" TIMESTAMP(3) NOT NULL,
    "fabricStockId" TEXT NOT NULL,
    "actualFabricWidth" DECIMAL(10,2) NOT NULL,
    "cadAverageUsed" DECIMAL(10,4) NOT NULL,
    "cadWidthUsed" DECIMAL(10,2) NOT NULL,
    "layersPerLay" INTEGER NOT NULL,
    "numberOfLays" INTEGER NOT NULL,
    "fabricConsumed" DECIMAL(10,2) NOT NULL,
    "cuttingTableId" TEXT,
    "cuttingOperatorId" TEXT,
    "status" "public"."CuttingBatchStatus" NOT NULL DEFAULT 'PENDING',
    "actualAverage" DECIMAL(10,4),
    "varianceFromCad" DECIMAL(10,4),
    "variancePercent" DECIMAL(5,2),
    "wastageMeters" DECIMAL(10,2),
    "wastagePercent" DECIMAL(5,2),
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cutting_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cutting_lay_skus" (
    "id" TEXT NOT NULL,
    "cuttingLayId" TEXT NOT NULL,
    "colorId" TEXT,
    "sizeId" TEXT NOT NULL,
    "pieces" INTEGER NOT NULL,

    CONSTRAINT "cutting_lay_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cutting_lays" (
    "id" TEXT NOT NULL,
    "cuttingBatchId" TEXT NOT NULL,
    "layDate" TIMESTAMP(3) NOT NULL,
    "layNumber" INTEGER NOT NULL,
    "layerLength" DECIMAL(10,2) NOT NULL,
    "totalPieces" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cuttingBatchFabricId" TEXT,

    CONSTRAINT "cutting_lays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."debit_note_items" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "debitNoteId" TEXT NOT NULL,
    "poItemId" TEXT,
    "description" TEXT NOT NULL,
    "hsnCode" TEXT,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "gstRate" DECIMAL(5,2),
    "cgstAmount" DECIMAL(12,2),
    "sgstAmount" DECIMAL(12,2),
    "igstAmount" DECIMAL(12,2),
    "taxAmount" DECIMAL(12,2),

    CONSTRAINT "debit_note_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."debit_notes" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "debitNoteNumber" TEXT NOT NULL,
    "poId" TEXT,
    "supplierId" TEXT NOT NULL,
    "debitNoteDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" "public"."DebitNoteReason" NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "cgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalTax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "isInterstate" BOOLEAN NOT NULL DEFAULT false,
    "status" "public"."DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."delivery_note_items" (
    "id" TEXT NOT NULL,
    "deliveryNoteId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "cartons" INTEGER,
    "remarks" TEXT,

    CONSTRAINT "delivery_note_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."delivery_notes" (
    "id" TEXT NOT NULL,
    "deliveryNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vehicleNumber" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "status" "public"."DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "delivery_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."delivery_notes_ext" (
    "id" TEXT NOT NULL,
    "deliveryNoteId" TEXT NOT NULL,
    "asnId" TEXT,
    "appointmentDate" TIMESTAMP(3),
    "shipFrom" TEXT,
    "billingAddress" TEXT,
    "totalCartons" INTEGER,
    "totalPieces" INTEGER,

    CONSTRAINT "delivery_notes_ext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dispatch_cartons" (
    "id" TEXT NOT NULL,
    "deliveryNoteExtId" TEXT NOT NULL,
    "cartonId" TEXT NOT NULL,

    CONSTRAINT "dispatch_cartons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dispatch_documents" (
    "id" TEXT NOT NULL,
    "deliveryNoteExtId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "documentDate" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "distanceKm" INTEGER,
    "transportMode" TEXT,
    "vehicleType" TEXT,
    "subtotal" DECIMAL(12,2),
    "cgst" DECIMAL(10,2),
    "sgst" DECIMAL(10,2),
    "igst" DECIMAL(10,2),
    "grandTotal" DECIMAL(12,2),
    "documentUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispatch_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dispatch_pods" (
    "id" TEXT NOT NULL,
    "deliveryNoteExtId" TEXT NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "deliveryTime" TEXT,
    "receivedBy" TEXT NOT NULL,
    "designation" TEXT,
    "customerSignOff" BOOLEAN NOT NULL DEFAULT false,
    "podDocumentUrl" TEXT,
    "deliveryStatus" "public"."DeliveryConfirmation" NOT NULL,
    "shortageQty" INTEGER,
    "rejectionReason" TEXT,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerGrnDate" TIMESTAMP(3),
    "customerGrnNumber" TEXT,

    CONSTRAINT "dispatch_pods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dispatch_transports" (
    "id" TEXT NOT NULL,
    "deliveryNoteExtId" TEXT NOT NULL,
    "transporterName" TEXT NOT NULL,
    "transporterGstin" TEXT,
    "vehicleNumber" TEXT NOT NULL,
    "vehicleType" TEXT,
    "driverName" TEXT NOT NULL,
    "driverPhone" TEXT,
    "driverLicense" TEXT,
    "lrNumber" TEXT,
    "lrDate" TIMESTAMP(3),
    "freightCharges" DECIMAL(10,2),
    "freightPaidBy" TEXT,
    "dispatchDate" TIMESTAMP(3),
    "expectedDeliveryDate" TIMESTAMP(3),
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatch_transports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."drawstring_master" (
    "id" TEXT NOT NULL,
    "drawstringCode" TEXT NOT NULL,
    "drawstringName" TEXT NOT NULL,
    "width" TEXT,
    "material" TEXT,
    "color" TEXT,
    "hasAglets" BOOLEAN NOT NULL DEFAULT false,
    "pricePerMeter" DECIMAL(10,2),
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "drawstring_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."elastic_master" (
    "id" TEXT NOT NULL,
    "elasticCode" TEXT NOT NULL,
    "elasticName" TEXT NOT NULL,
    "supplierCode" TEXT,
    "buyerCode" TEXT,
    "width" DECIMAL(10,2),
    "stretchPercent" DECIMAL(5,2),
    "color" TEXT,
    "composition" TEXT,
    "elasticType" TEXT,
    "pricePerMeter" DECIMAL(10,2),
    "image" TEXT,
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "elastic_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."elastic_suppliers" (
    "id" TEXT NOT NULL,
    "elasticId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "pricePerMeter" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "elastic_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."embroidery_cad_size_breakdown" (
    "id" TEXT NOT NULL,
    "embroidery_cad_id" TEXT NOT NULL,
    "sizeName" TEXT NOT NULL,
    "size_id" TEXT,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "embroidery_cad_size_breakdown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."embroidery_master" (
    "id" TEXT NOT NULL,
    "embroideryCode" TEXT NOT NULL,
    "designName" TEXT NOT NULL,
    "description" TEXT,
    "designFile" TEXT,
    "designImage" TEXT,
    "stitchCount" INTEGER,
    "threadColors" INTEGER,
    "repeatWidth" DECIMAL(10,2),
    "repeatHeight" DECIMAL(10,2),
    "cutableWidth" DECIMAL(10,2) NOT NULL,
    "costPerMeter" DECIMAL(10,2),
    "supplierId" TEXT,
    "leadTimeDays" INTEGER,
    "originalStyleId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "embroidery_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."embroidery_part_cad" (
    "id" TEXT NOT NULL,
    "style_fabric_id" TEXT NOT NULL,
    "fabric_width_cad_id" TEXT,
    "embroidery_id" TEXT,
    "cadMeters" DECIMAL(10,4),
    "cadYards" DECIMAL(10,4),
    "cadWastagePercent" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "layerMarginMeters" DECIMAL(10,4),
    "piecesPerMarker" INTEGER,
    "markerEfficiency" DECIMAL(5,2),
    "printDirection" "public"."PrintDirection" NOT NULL DEFAULT 'TWO_WAY',
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "embroidery_part_cad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."embroidery_send_out" (
    "id" TEXT NOT NULL,
    "sourceFabricStockId" TEXT NOT NULL,
    "embroideryId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "quantitySent" DECIMAL(10,2) NOT NULL,
    "quantityReceived" DECIMAL(10,2),
    "quantityDamaged" DECIMAL(10,2),
    "unit" TEXT NOT NULL DEFAULT 'meters',
    "sentFinishedWidth" DECIMAL(10,2) NOT NULL,
    "receivedCutableWidth" DECIMAL(10,2),
    "sendDate" TIMESTAMP(3) NOT NULL,
    "expectedReturnDate" TIMESTAMP(3),
    "actualReturnDate" TIMESTAMP(3),
    "agreedRate" DECIMAL(10,2) NOT NULL,
    "actualCost" DECIMAL(10,2),
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "remarks" TEXT,
    "resultFabricStockId" TEXT,
    "forStyleId" TEXT,
    "forOrderId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workOrderId" TEXT,

    CONSTRAINT "embroidery_send_out_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."exchange_rates" (
    "id" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "rateType" "public"."RateType" NOT NULL,
    "exchangeRate" DECIMAL(10,4) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."expense_types" (
    "id" TEXT NOT NULL,
    "expenseCode" TEXT NOT NULL,
    "expenseName" TEXT NOT NULL,
    "expenseCategory" "public"."ExpenseCategory" NOT NULL,
    "accountId" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."export_templates" (
    "id" TEXT NOT NULL,
    "moduleName" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "description" TEXT,
    "columnConfig" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fabric_costing_run" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "purpose" "public"."CadPurpose" NOT NULL,
    "runNumber" INTEGER NOT NULL,
    "runName" TEXT NOT NULL,
    "totalFabricCost" DECIMAL(15,2),
    "fabricCount" INTEGER NOT NULL DEFAULT 0,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fabric_costing_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fabric_master" (
    "id" TEXT NOT NULL,
    "fabricCode" TEXT NOT NULL,
    "fabricName" TEXT NOT NULL,
    "greigeId" TEXT,
    "genericGreigeName" TEXT,
    "colorName" TEXT,
    "colorCode" TEXT,
    "finishType" TEXT,
    "printDesign" TEXT,
    "actualWidth" DECIMAL(10,2),
    "cutableWidth" DECIMAL(10,2),
    "finishedConstruction" TEXT,
    "actualGSM" INTEGER,
    "valueAddition" TEXT,
    "valueAdditionCost" DECIMAL(10,2),
    "costPerMeter" DECIMAL(10,2),
    "moq" INTEGER,
    "leadTimeDays" INTEGER,
    "supplierId" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "imageUrl" TEXT,
    "styleReference" TEXT,
    "isGeneric" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "colorMasterId" TEXT,
    "composition" TEXT,
    "yarnCount" TEXT,
    "greigeName" TEXT,
    "source" TEXT,

    CONSTRAINT "fabric_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fabric_physical_tests" (
    "id" TEXT NOT NULL,
    "testNumber" TEXT NOT NULL,
    "fabricId" TEXT,
    "fabricProcurementId" TEXT,
    "fabricStockLotId" TEXT,
    "styleId" TEXT,
    "customerId" TEXT,
    "sentToLabDate" TIMESTAMP(3),
    "testingLabId" TEXT,
    "sampleQuantity" DECIMAL(10,2),
    "batchNumber" TEXT,
    "expectedGSM" INTEGER,
    "expectedConstruction" TEXT,
    "expectedCount" TEXT,
    "toleranceGSM" DECIMAL(5,2),
    "testReportNumber" TEXT,
    "testResultReceivedDate" TIMESTAMP(3),
    "testedGSM" INTEGER,
    "gsmTestResult" "public"."TestResult" DEFAULT 'PENDING',
    "gsmVariance" DECIMAL(5,2),
    "testedConstruction" TEXT,
    "constructionTestResult" "public"."TestResult" DEFAULT 'PENDING',
    "testedCount" TEXT,
    "countTestResult" "public"."TestResult" DEFAULT 'PENDING',
    "tensileStrengthWarp" DECIMAL(10,2),
    "tensileStrengthWeft" DECIMAL(10,2),
    "tearStrengthWarp" DECIMAL(10,2),
    "tearStrengthWeft" DECIMAL(10,2),
    "shrinkageLength" DECIMAL(5,2),
    "shrinkageWidth" DECIMAL(5,2),
    "colorFastness" TEXT,
    "pilling" TEXT,
    "spirality" DECIMAL(5,2),
    "testReportUrl" TEXT,
    "overallTestResult" "public"."TestResult" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "remarks" TEXT,
    "isRetest" BOOLEAN NOT NULL DEFAULT false,
    "originalTestId" TEXT,
    "retestReason" TEXT,
    "retestCount" INTEGER NOT NULL DEFAULT 0,
    "approvedById" TEXT,
    "approvedDate" TIMESTAMP(3),
    "adminOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "fabric_physical_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fabric_processing" (
    "id" TEXT NOT NULL,
    "procurementId" TEXT,
    "processingMillId" TEXT NOT NULL,
    "processingType" TEXT NOT NULL,
    "batchNumber" TEXT,
    "processSpecifications" TEXT,
    "greigeId" TEXT NOT NULL,
    "greigeQuantitySent" DECIMAL(10,2) NOT NULL,
    "greigeWidth" DECIMAL(10,2),
    "expectedFinishedWidthMin" DECIMAL(10,2),
    "expectedFinishedWidthMax" DECIMAL(10,2),
    "expectedShrinkagePercent" DECIMAL(5,2),
    "actualFinishedWidth" DECIMAL(10,2),
    "actualQuantityReceived" DECIMAL(10,2),
    "actualShrinkagePercent" DECIMAL(5,2),
    "processingLossMeters" DECIMAL(10,2),
    "widthVarianceInches" DECIMAL(10,2),
    "shrinkageVariancePercent" DECIMAL(5,2),
    "millAvgShrinkage" DECIMAL(5,2),
    "varianceFromMillAvg" DECIMAL(5,2),
    "greigeCost" DECIMAL(10,2),
    "processingCost" DECIMAL(10,2),
    "totalFinishedCost" DECIMAL(10,2),
    "costPerMeter" DECIMAL(10,2),
    "finishedFabricId" TEXT,
    "sentDate" TIMESTAMP(3),
    "expectedReturnDate" TIMESTAMP(3),
    "actualReturnDate" TIMESTAMP(3),
    "processingStatus" TEXT NOT NULL DEFAULT 'SENT',
    "qualityNotes" TEXT,
    "rejectionReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fabric_processing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fabric_procurement" (
    "id" TEXT NOT NULL,
    "procurementType" TEXT NOT NULL,
    "purchaseOrderNumber" TEXT,
    "supplierId" TEXT NOT NULL,
    "greigeId" TEXT,
    "fabricId" TEXT,
    "quantityPurchased" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'meters',
    "width" DECIMAL(10,2) NOT NULL,
    "ratePerUnit" DECIMAL(10,2) NOT NULL,
    "totalCost" DECIMAL(10,2) NOT NULL,
    "orderedForStyleId" TEXT,
    "orderedForOrderId" TEXT,
    "isStockPurchase" BOOLEAN NOT NULL DEFAULT false,
    "processingRequired" BOOLEAN NOT NULL DEFAULT false,
    "processingType" TEXT,
    "processingColor" TEXT,
    "processingDesign" TEXT,
    "processedFabricId" TEXT,
    "processingMoq" DECIMAL(10,2),
    "status" TEXT NOT NULL DEFAULT 'ORDERED',
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDelivery" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fabric_procurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fabric_stock" (
    "id" TEXT NOT NULL,
    "fabricId" TEXT NOT NULL,
    "finishedWidth" DECIMAL(10,2) NOT NULL,
    "quantityAvailable" DECIMAL(10,2) NOT NULL,
    "quantityReserved" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quantityConsumed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'meters',
    "procurementId" TEXT,
    "originStyleId" TEXT,
    "originOrderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "stockType" TEXT NOT NULL DEFAULT 'EXCESS',
    "plannedCad" DECIMAL(10,4),
    "actualCad" DECIMAL(10,4),
    "varianceReason" TEXT,
    "weightedAvgCost" DECIMAL(10,2) NOT NULL,
    "purchaseCost" DECIMAL(10,2) NOT NULL,
    "qualityGrade" TEXT NOT NULL DEFAULT 'A',
    "defectMeters" DECIMAL(10,2),
    "defectValue" DECIMAL(10,2),
    "warehouseLocation" TEXT,
    "rackNumber" TEXT,
    "rollNumbers" TEXT,
    "receivedDate" TIMESTAMP(3) NOT NULL,
    "lastConsumedDate" TIMESTAMP(3),
    "agingAlertSent" BOOLEAN NOT NULL DEFAULT false,
    "agingDays" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "embroideryId" TEXT,
    "cutableWidth" DECIMAL(10,2) NOT NULL,
    "pattern_part_id" TEXT,
    "fabricFinishType" "public"."FabricFinishType",

    CONSTRAINT "fabric_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fabric_stock_allocation" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "quantityAllocated" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'meters',
    "quantityConsumed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quantityReturned" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "plannedCad" DECIMAL(10,4) NOT NULL,
    "actualCad" DECIMAL(10,4),
    "cadVariance" DECIMAL(10,4),
    "varianceReason" TEXT,
    "originalStyleId" TEXT,
    "allocationType" TEXT NOT NULL DEFAULT 'SAME_STYLE',
    "allocationStatus" TEXT NOT NULL DEFAULT 'RESERVED',
    "allocatedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumptionDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "production_cad_id" TEXT,

    CONSTRAINT "fabric_stock_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fabric_stock_transaction" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'meters',
    "referenceType" TEXT,
    "referenceId" TEXT,
    "costPerUnit" DECIMAL(10,2) NOT NULL,
    "weightedAvgCost" DECIMAL(10,2) NOT NULL,
    "totalValue" DECIMAL(10,2) NOT NULL,
    "plannedCad" DECIMAL(10,4),
    "actualCad" DECIMAL(10,4),
    "piecesProduced" INTEGER,
    "qualityGradeFrom" TEXT,
    "qualityGradeTo" TEXT,
    "defectType" TEXT,
    "balanceAfter" DECIMAL(10,2) NOT NULL,
    "valueAfter" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fabric_stock_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fabric_suppliers" (
    "id" TEXT NOT NULL,
    "fabricId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fabric_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fabric_width_cad" (
    "id" TEXT NOT NULL,
    "fabricId" TEXT,
    "cutableWidth" DECIMAL(10,2) NOT NULL,
    "widthUnit" TEXT NOT NULL DEFAULT 'inches',
    "cadMeters" DECIMAL(10,4),
    "cadYards" DECIMAL(10,4),
    "cadWastagePercent" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "markerEfficiency" DECIMAL(5,2),
    "actualCad" DECIMAL(10,4),
    "cadVariancePercent" DECIMAL(5,2),
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "supplierAvailability" TEXT,
    "priceDifferential" DECIMAL(10,2),
    "markerPlanFile" TEXT,
    "markerLengthMeters" DECIMAL(10,2),
    "piecesPerMarker" INTEGER,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "layerMarginMeters" DECIMAL(10,4),
    "greigeId" TEXT,
    "processingPricePerMeter" DECIMAL(10,2),
    "componentName" TEXT,
    "costInputMode" TEXT,
    "costingStyleId" TEXT,
    "greigeCostPerMeter" DECIMAL(10,2),
    "numberOfColors" INTEGER,
    "processorId" TEXT,
    "screenCostPerMeter" DECIMAL(10,2),
    "shrinkageCostPerMeter" DECIMAL(10,2),
    "shrinkagePercent" DECIMAL(5,2),
    "totalCostPerMeter" DECIMAL(10,2),
    "transportCostPerMeter" DECIMAL(10,2),
    "screenType" TEXT,
    "printDirection" "public"."PrintDirection" NOT NULL DEFAULT 'TWO_WAY',
    "isEmbroidery" BOOLEAN NOT NULL DEFAULT false,
    "pattern_part_id" TEXT,
    "purpose" TEXT,
    "style_fabric_id" TEXT,
    "approval_notes" TEXT,
    "approval_status" TEXT,
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "auto_approved_from" TEXT,
    "fabric_stock_id" TEXT,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_at" TIMESTAMP(3),
    "locked_reason" TEXT,
    "planning_cad_width" DECIMAL(10,2),
    "procurement_id" TEXT,
    "style_costing_id" TEXT,
    "superseded_by_id" TEXT,
    "variance_percent" DECIMAL(5,2),
    "version" INTEGER NOT NULL DEFAULT 1,
    "width_variance" DECIMAL(10,2),
    "combined_components" TEXT,
    "combined_fabric_ids" TEXT,
    "is_combined_cutting" BOOLEAN NOT NULL DEFAULT false,
    "orderQuantityPcs" INTEGER,
    "cadAverage" DECIMAL(10,4),
    "cloned_from_cad_id" TEXT,
    "cloned_from_order_id" TEXT,
    "greige_rate_manual_override" DECIMAL(10,2),
    "greige_rate_override_reason" TEXT,
    "greige_rate_source" "public"."GreigeRateSource",
    "greige_rate_source_date" TIMESTAMP(3),
    "purpose_enum" "public"."CadPurpose",
    "variance_approval_notes" TEXT,
    "variance_approval_status" "public"."VarianceApprovalStatus" DEFAULT 'NOT_REQUIRED',
    "variance_approved_at" TIMESTAMP(3),
    "variance_approved_by" TEXT,
    "processing_batch_group_color_id" TEXT,
    "copied_from_id" TEXT,
    "costing_run_id" TEXT,

    CONSTRAINT "fabric_width_cad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."finished_goods_stock" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "locationId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finished_goods_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."finishing_daily_outputs" (
    "id" TEXT NOT NULL,
    "finishingIssueId" TEXT NOT NULL,
    "componentId" TEXT,
    "outputDate" TIMESTAMP(3) NOT NULL,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finishing_daily_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."finishing_issue_components" (
    "id" TEXT NOT NULL,
    "finishingIssueId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,

    CONSTRAINT "finishing_issue_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."finishing_issue_skus" (
    "id" TEXT NOT NULL,
    "finishingIssueId" TEXT NOT NULL,
    "colorId" TEXT,
    "sizeId" TEXT NOT NULL,
    "availableQty" INTEGER NOT NULL,
    "issuedQty" INTEGER NOT NULL,

    CONSTRAINT "finishing_issue_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."finishing_issues" (
    "id" TEXT NOT NULL,
    "issueNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "managerId" TEXT,
    "expectedCompletionDate" TIMESTAMP(3),
    "status" "public"."FinishingStatus" NOT NULL DEFAULT 'PENDING_RECEIPT',
    "remarks" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "contractorId" TEXT,

    CONSTRAINT "finishing_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."finishing_output_skus" (
    "id" TEXT NOT NULL,
    "dailyOutputId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "finishedQty" INTEGER NOT NULL DEFAULT 0,
    "defectQty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "finishing_output_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."garment_physical_tests" (
    "id" TEXT NOT NULL,
    "testNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "customerId" TEXT,
    "sizeId" TEXT,
    "colorId" TEXT,
    "sentToLabDate" TIMESTAMP(3),
    "testingLabId" TEXT,
    "sampleQuantity" INTEGER,
    "testReportNumber" TEXT,
    "testResultReceivedDate" TIMESTAMP(3),
    "prewashLength" DECIMAL(10,2),
    "prewashWidth" DECIMAL(10,2),
    "prewashChest" DECIMAL(10,2),
    "postwashLength" DECIMAL(10,2),
    "postwashWidth" DECIMAL(10,2),
    "postwashChest" DECIMAL(10,2),
    "lengthShrinkage" DECIMAL(5,2),
    "widthShrinkage" DECIMAL(5,2),
    "shrinkageTestResult" "public"."TestResult" DEFAULT 'PENDING',
    "seamStrength" DECIMAL(10,2),
    "seamTestResult" "public"."TestResult" DEFAULT 'PENDING',
    "colorFastnessWash" TEXT,
    "colorFastnessRub" TEXT,
    "colorFastnessLight" TEXT,
    "colorTestResult" "public"."TestResult" DEFAULT 'PENDING',
    "pilling" TEXT,
    "spirality" DECIMAL(5,2),
    "apparenceAfterWash" TEXT,
    "testReportUrl" TEXT,
    "overallTestResult" "public"."TestResult" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "remarks" TEXT,
    "isRetest" BOOLEAN NOT NULL DEFAULT false,
    "originalTestId" TEXT,
    "retestReason" TEXT,
    "retestCount" INTEGER NOT NULL DEFAULT 0,
    "approvedById" TEXT,
    "approvedDate" TIMESTAMP(3),
    "adminOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "buyerApprovalRequired" BOOLEAN NOT NULL DEFAULT false,
    "buyerApprovedDate" TIMESTAMP(3),
    "buyerApprovedBy" TEXT,
    "buyerRemarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "garment_physical_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."goods_receiving_notes" (
    "id" TEXT NOT NULL,
    "grnNumber" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "receivingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "status" "public"."GRNStatus" NOT NULL DEFAULT 'PENDING_QC',
    "remarks" TEXT,
    "receivedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receiving_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."greige_master" (
    "id" TEXT NOT NULL,
    "greigeCode" TEXT NOT NULL,
    "greigeName" TEXT NOT NULL,
    "yarnCount" TEXT,
    "construction" TEXT,
    "composition" TEXT NOT NULL,
    "weaveType" TEXT,
    "greigeWidth" DECIMAL(10,2) NOT NULL,
    "expectedFinishedWidthMin" DECIMAL(10,2),
    "expectedFinishedWidthMax" DECIMAL(10,2),
    "averageShrinkagePercent" DECIMAL(5,2) DEFAULT 8,
    "gsmRange" TEXT,
    "costPerMeter" DECIMAL(10,2),
    "moq" INTEGER,
    "leadTimeDays" INTEGER,
    "supplierId" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "genericGreigeName" TEXT,
    "defaultCutableWidth" DECIMAL(10,2),

    CONSTRAINT "greige_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."greige_stock" (
    "id" VARCHAR(50) NOT NULL,
    "greigeId" VARCHAR(50) NOT NULL,
    "quantityAvailable" DECIMAL(10,2) NOT NULL,
    "quantityReserved" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quantityConsumed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "unit" VARCHAR(20) NOT NULL DEFAULT 'meters',
    "greigeWidth" DECIMAL(10,2) NOT NULL,
    "cutableWidth" DECIMAL(10,2),
    "purchaseCost" DECIMAL(10,2),
    "weightedAvgCost" DECIMAL(10,2),
    "procurementId" VARCHAR(50),
    "supplierId" VARCHAR(50),
    "warehouseLocation" VARCHAR(100),
    "rollNumbers" TEXT,
    "qualityGrade" VARCHAR(10) NOT NULL DEFAULT 'A',
    "receivedDate" DATE NOT NULL,
    "lastConsumedDate" DATE,
    "agingDays" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    "stockType" VARCHAR(20) NOT NULL DEFAULT 'GENERIC',
    "createdById" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "greige_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."greige_suppliers" (
    "id" TEXT NOT NULL,
    "greigeId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "greige_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."grn_items" (
    "id" TEXT NOT NULL,
    "grnId" TEXT NOT NULL,
    "poItemId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "orderedQuantity" DECIMAL(10,3) NOT NULL,
    "receivedQuantity" DECIMAL(10,3) NOT NULL,
    "acceptedQuantity" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "rejectedQuantity" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "unit" "public"."Unit" NOT NULL,
    "remarks" TEXT,

    CONSTRAINT "grn_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."hook_eye_master" (
    "id" TEXT NOT NULL,
    "hookEyeCode" TEXT NOT NULL,
    "hookEyeName" TEXT NOT NULL,
    "size" TEXT,
    "material" TEXT,
    "color" TEXT,
    "finish" TEXT,
    "pricePerPair" DECIMAL(10,2),
    "pricePerGross" DECIMAL(10,2),
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "hook_eye_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."hsn_sac_masters" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "public"."HSNSACType" NOT NULL,
    "description" TEXT NOT NULL,
    "chapter" TEXT,
    "section" TEXT,
    "defaultGstRate" DECIMAL(5,2) NOT NULL,
    "unit" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hsn_sac_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."indian_cities" (
    "id" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "tier" "public"."CityTier" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indian_cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."indian_states" (
    "id" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "stateType" "public"."StateType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indian_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."interlining_master" (
    "id" TEXT NOT NULL,
    "interliningCode" TEXT NOT NULL,
    "interliningName" TEXT NOT NULL,
    "weight" TEXT,
    "type" TEXT,
    "fusible" BOOLEAN NOT NULL DEFAULT true,
    "width" TEXT,
    "color" TEXT,
    "pricePerMeter" DECIMAL(10,2),
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "interlining_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inventory_stock" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" "public"."Unit" NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invoice_items" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "invoiceId" TEXT NOT NULL,
    "styleId" TEXT,
    "description" TEXT NOT NULL,
    "hsnCode" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "gstRate" DECIMAL(5,2),
    "cgstRate" DECIMAL(5,2),
    "cgstAmount" DECIMAL(12,2),
    "sgstRate" DECIMAL(5,2),
    "sgstAmount" DECIMAL(12,2),
    "igstRate" DECIMAL(5,2),
    "igstAmount" DECIMAL(12,2),
    "taxAmount" DECIMAL(12,2),
    "remarks" TEXT,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "public"."InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balanceAmount" DECIMAL(12,2) NOT NULL,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cgstRate" DECIMAL(5,2),
    "igstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "igstRate" DECIMAL(5,2),
    "isInterstate" BOOLEAN NOT NULL DEFAULT false,
    "placeOfSupplyId" TEXT,
    "sgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sgstRate" DECIMAL(5,2),
    "eInvoiceIrn" TEXT,
    "eInvoiceAckNo" TEXT,
    "eInvoiceAckDate" TIMESTAMP(3),
    "eInvoiceQrCode" TEXT,
    "eInvoiceStatus" TEXT,
    "ewayBillNumber" TEXT,
    "ewayBillDate" TIMESTAMP(3),
    "ewayBillValidTo" TIMESTAMP(3),
    "vehicleNumber" TEXT,
    "transporterId" TEXT,
    "transporterGstin" TEXT,
    "supplyType" "public"."SupplyType",

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."job_work_orders" (
    "id" TEXT NOT NULL,
    "jobWorkNumber" TEXT NOT NULL,
    "processType" TEXT NOT NULL,
    "labDipId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "fabricId" TEXT NOT NULL,
    "millId" TEXT NOT NULL,
    "fabricStockLotId" TEXT NOT NULL,
    "fabricType" TEXT NOT NULL,
    "reprocessReason" TEXT,
    "qtySentMeters" DECIMAL(10,2) NOT NULL,
    "sentWidthInches" DECIMAL(10,2) NOT NULL,
    "sentDate" TIMESTAMP(3),
    "challanNumber" TEXT,
    "vehicleNumber" TEXT,
    "expectedReturnDate" TIMESTAMP(3),
    "expectedShrinkage" DECIMAL(5,2),
    "agreedRatePerMeter" DECIMAL(10,2) NOT NULL,
    "qtyReceivedMeters" DECIMAL(10,2),
    "receivedWidthInches" DECIMAL(10,2),
    "receivedDate" TIMESTAMP(3),
    "receivedChallan" TEXT,
    "invoiceNumber" TEXT,
    "actualShrinkage" DECIMAL(5,2),
    "widthVariance" DECIMAL(10,2),
    "qualityGrade" TEXT,
    "colorMatchStatus" TEXT,
    "defectMeters" DECIMAL(10,2),
    "defectType" TEXT,
    "actualRate" DECIMAL(10,2),
    "status" "public"."JobWorkStatus" NOT NULL DEFAULT 'READY_TO_SEND',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "workOrderId" TEXT,
    "inwardChallanId" TEXT,
    "outwardChallanId" TEXT,
    "finishedFabricId" TEXT,
    "thanCount" INTEGER,
    "foldLengthCm" DECIMAL(5,2),
    "calculatedActualMeters" DECIMAL(10,2),
    "purchaseOrderId" VARCHAR(50),
    "greigeStockLotId" VARCHAR(50),
    "grnId" VARCHAR(50),

    CONSTRAINT "job_work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lab_dips" (
    "id" TEXT NOT NULL,
    "labDipNumber" TEXT NOT NULL,
    "processType" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "fabricId" TEXT NOT NULL,
    "designArtwork" TEXT,
    "printMethod" "public"."PrintMethod",
    "printChemistry" "public"."PrintChemistry",
    "targetColorId" TEXT,
    "colorReference" TEXT,
    "millId" TEXT NOT NULL,
    "submissionDate" TIMESTAMP(3) NOT NULL,
    "expectedDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "status" "public"."LabDipStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvalDate" TIMESTAMP(3),
    "approvedSampleNo" TEXT,
    "rejectionReason" TEXT,
    "colorMatchRating" TEXT,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "lab_dips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."label_master" (
    "id" TEXT NOT NULL,
    "labelCode" TEXT NOT NULL,
    "labelName" TEXT NOT NULL,
    "supplierCode" TEXT,
    "buyerCode" TEXT,
    "labelType" TEXT,
    "size" TEXT,
    "content" TEXT,
    "printMethod" TEXT,
    "material" TEXT,
    "color" TEXT,
    "pricePerPiece" DECIMAL(10,2),
    "pricePerHundred" DECIMAL(10,2),
    "image" TEXT,
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "labelCategory" "public"."LabelCategory" NOT NULL DEFAULT 'SEWN_IN',
    "customerId" TEXT,
    "fabricContent" TEXT,
    "washcareInstructions" TEXT,
    "brandCategoryId" TEXT,

    CONSTRAINT "label_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."label_size_variants" (
    "id" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "sizeCategoryId" TEXT,
    "size" TEXT NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "label_size_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."label_suppliers" (
    "id" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "pricePerPiece" DECIMAL(10,2),
    "pricePerHundred" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "label_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lace_defect_log" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "laceId" TEXT NOT NULL,
    "orderId" TEXT,
    "styleId" TEXT,
    "defectType" TEXT NOT NULL,
    "defectQuantity" DECIMAL(10,2) NOT NULL,
    "defectDescription" TEXT,
    "discoveredAt" TEXT NOT NULL,
    "discoveredDate" TIMESTAMP(3) NOT NULL,
    "discoveredById" TEXT NOT NULL,
    "photos" TEXT,
    "claimStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "claimSubmittedDate" TIMESTAMP(3),
    "claimReference" TEXT,
    "claimAmount" DECIMAL(10,2),
    "claimResolvedDate" TIMESTAMP(3),
    "claimResolution" TEXT,
    "replacementRequired" BOOLEAN NOT NULL DEFAULT false,
    "replacementStockId" TEXT,
    "replacementQuantity" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lace_defect_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lace_issue_note" (
    "id" TEXT NOT NULL,
    "issueNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "cuttingBatchId" TEXT,
    "stockId" TEXT NOT NULL,
    "laceId" TEXT NOT NULL,
    "issuedQuantity" DECIMAL(10,2) NOT NULL,
    "consumedQuantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "returnedQuantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "issuedById" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lace_issue_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lace_lab_dip" (
    "id" TEXT NOT NULL,
    "labDipNumber" TEXT NOT NULL,
    "greigeLaceId" TEXT NOT NULL,
    "targetColor" TEXT NOT NULL,
    "colorRecipe" TEXT,
    "processorId" TEXT NOT NULL,
    "sampleQuantity" DECIMAL(10,2) NOT NULL,
    "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentToProcessorDate" TIMESTAMP(3),
    "sampleReceivedDate" TIMESTAMP(3),
    "sentToBuyerDate" TIMESTAMP(3),
    "buyerDecisionDate" TIMESTAMP(3),
    "status" "public"."LaceLabDipStatus" NOT NULL DEFAULT 'PENDING',
    "buyerRemarks" TEXT,
    "rejectionReason" TEXT,
    "approvalReference" TEXT,
    "labDipCost" DECIMAL(10,2),
    "costSheetId" TEXT,
    "styleId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lace_lab_dip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lace_master" (
    "id" TEXT NOT NULL,
    "laceCode" TEXT NOT NULL,
    "laceName" TEXT NOT NULL,
    "supplierCode" TEXT,
    "buyerCode" TEXT,
    "width" DECIMAL(10,2),
    "design" TEXT,
    "color" TEXT,
    "composition" TEXT,
    "image" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "laceType" TEXT,
    "pricePerMeter" DECIMAL(10,2),
    "supplierId" TEXT,
    "costPerMeterGreige" DECIMAL(10,2),
    "expectedShrinkagePercent" DECIMAL(5,2),
    "isGreige" BOOLEAN NOT NULL DEFAULT false,
    "sourceGreigeLaceId" TEXT,

    CONSTRAINT "lace_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lace_stock" (
    "id" TEXT NOT NULL,
    "laceId" TEXT NOT NULL,
    "lotNumber" TEXT,
    "rollNumbers" TEXT,
    "dyeLotNumber" TEXT,
    "originStyleId" TEXT,
    "originOrderId" TEXT,
    "originStyleCode" TEXT,
    "procurementId" TEXT,
    "processingBatchId" TEXT,
    "warehouseLocation" TEXT,
    "rackNumber" TEXT,
    "quantityAvailable" DECIMAL(10,2) NOT NULL,
    "quantityReserved" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quantityConsumed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'meters',
    "weightedAvgCost" DECIMAL(10,2) NOT NULL,
    "purchaseCost" DECIMAL(10,2) NOT NULL,
    "qualityGrade" TEXT NOT NULL DEFAULT 'A',
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "stockType" TEXT NOT NULL DEFAULT 'PLANNED_STOCK',
    "receivedDate" TIMESTAMP(3) NOT NULL,
    "lastConsumedDate" TIMESTAMP(3),
    "agingDays" INTEGER NOT NULL DEFAULT 0,
    "returnStatus" TEXT,
    "returnReason" TEXT,
    "returnRequestDate" TIMESTAMP(3),
    "returnConfirmedDate" TIMESTAMP(3),
    "restockingFee" DECIMAL(10,2),
    "shadeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "lace_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lace_stock_allocation" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "styleCode" TEXT,
    "originalStyleId" TEXT,
    "originalStyleCode" TEXT,
    "originalOrderId" TEXT,
    "allocationType" TEXT NOT NULL DEFAULT 'SAME_STYLE',
    "transferredFromStyleId" TEXT,
    "transferDate" TIMESTAMP(3),
    "transferNotes" TEXT,
    "quantityAllocated" DECIMAL(10,2) NOT NULL,
    "quantityConsumed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quantityReturned" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "allocationStatus" TEXT NOT NULL DEFAULT 'RESERVED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lace_stock_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lace_stock_transaction" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "balanceAfter" DECIMAL(10,2) NOT NULL,
    "fromStyleId" TEXT,
    "toStyleId" TEXT,
    "fromStyleCode" TEXT,
    "toStyleCode" TEXT,
    "qualityGradeFrom" TEXT,
    "qualityGradeTo" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "notes" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedById" TEXT NOT NULL,

    CONSTRAINT "lace_stock_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lace_style_associations" (
    "id" TEXT NOT NULL,
    "laceId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lace_style_associations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lace_suppliers" (
    "id" TEXT NOT NULL,
    "laceId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "pricePerMeter" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lace_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."locations" (
    "id" TEXT NOT NULL,
    "locationCode" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "locationType" "public"."LocationType" NOT NULL,
    "address" TEXT,
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lookup_values" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lookup_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."machine_part_master" (
    "id" TEXT NOT NULL,
    "partCode" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "partNumber" TEXT,
    "category" TEXT,
    "machine" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "specifications" TEXT,
    "pricePerUnit" DECIMAL(10,2),
    "image" TEXT,
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machine_part_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."machine_part_suppliers" (
    "id" TEXT NOT NULL,
    "machinePartId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "pricePerUnit" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machine_part_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."material_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentCategoryId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."material_master" (
    "id" SERIAL NOT NULL,
    "materialType" "public"."MaterialType" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pricePerUnit" DECIMAL(15,2),
    "pricePerMeter" DECIMAL(15,2),
    "pricePerPiece" DECIMAL(15,2),
    "pricePerKg" DECIMAL(15,2),
    "pricePerGross" DECIMAL(15,2),
    "unit" TEXT,
    "currencyId" TEXT,
    "specifications" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hsnCode" TEXT,
    "gstRate" DECIMAL(5,2),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "legacyLaceId" TEXT,
    "legacyButtonId" TEXT,
    "legacyThreadId" TEXT,
    "legacyZipperId" TEXT,
    "legacyElasticId" TEXT,
    "legacyLabelId" TEXT,
    "legacyPackagingId" TEXT,
    "legacyMachinePartId" TEXT,
    "legacyHookEyeId" TEXT,
    "legacySnapButtonId" TEXT,
    "legacyBuckleId" TEXT,
    "legacyBeltId" TEXT,
    "legacyVelcroId" TEXT,
    "legacyDrawstringId" TEXT,
    "legacyRibbonId" TEXT,
    "legacySequinId" TEXT,
    "legacyBeadId" TEXT,
    "legacyMotifId" TEXT,
    "legacyInterliningId" TEXT,
    "legacyPaddingId" TEXT,

    CONSTRAINT "material_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."material_requirements" (
    "id" TEXT NOT NULL,
    "requirementNumber" TEXT NOT NULL,
    "source" "public"."RequirementSource" NOT NULL,
    "orderId" TEXT,
    "orderItemId" TEXT,
    "materialId" TEXT NOT NULL,
    "orderQuantity" INTEGER NOT NULL,
    "quantityPerUnit" DECIMAL(10,4) NOT NULL,
    "wastagePercent" DECIMAL(5,2) NOT NULL,
    "totalRequired" DECIMAL(12,3) NOT NULL,
    "unit" "public"."Unit" NOT NULL,
    "availableStock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "allocatedFromStock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "shortfall" DECIMAL(12,3) NOT NULL,
    "preferredSupplierId" TEXT,
    "status" "public"."MaterialRequirementStatus" NOT NULL DEFAULT 'PENDING',
    "requiredDate" TIMESTAMP(3) NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orderBomId" TEXT,
    "cadId" TEXT,
    "fabricWidth" DECIMAL(10,2),
    "splitFromId" TEXT,
    "linkedRequirementId" TEXT,
    "processingCost" DECIMAL(12,2),
    "processorId" TEXT,
    "requirementType" TEXT NOT NULL DEFAULT 'MATERIAL',
    "printingType" TEXT,

    CONSTRAINT "material_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."material_requisition_items" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "requiredQuantity" DECIMAL(10,3) NOT NULL,
    "issuedQuantity" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "unit" "public"."Unit" NOT NULL,
    "remarks" TEXT,

    CONSTRAINT "material_requisition_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."material_requisitions" (
    "id" TEXT NOT NULL,
    "requisitionNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "requisitionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT NOT NULL,
    "receivedById" TEXT,
    "status" "public"."RequisitionStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "material_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."material_supplier_mapping" (
    "id" SERIAL NOT NULL,
    "materialId" INTEGER NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierCode" TEXT,
    "supplierName" TEXT,
    "supplierPrice" DECIMAL(15,2),
    "leadTimeDays" INTEGER,
    "moq" DECIMAL(15,4),
    "moqUnit" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "lastPurchaseDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_supplier_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."material_suppliers" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "supplierPrice" DECIMAL(15,2),
    "leadTimeDays" INTEGER,
    "moq" DECIMAL(15,4),
    "moqUnit" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "material_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."materials" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT,
    "specifications" TEXT,
    "unit" "public"."Unit" NOT NULL,
    "reorderLevel" INTEGER,
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categoryData" JSONB,
    "materialType" "public"."MaterialType" NOT NULL DEFAULT 'GENERIC',
    "greigeId" TEXT,
    "fabricId" TEXT,
    "laceId" TEXT,
    "buttonId" TEXT,
    "threadId" TEXT,
    "zipperId" TEXT,
    "elasticId" TEXT,
    "labelId" TEXT,
    "packagingId" TEXT,
    "sizeVariantId" TEXT,
    "machinePartId" TEXT,
    "otherMaterialId" TEXT,
    "gstRate" DECIMAL(5,2),
    "hsnCode" TEXT,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."mood_board_items" (
    "id" TEXT NOT NULL,
    "mood_board_id" TEXT NOT NULL,
    "item_type" TEXT NOT NULL,
    "image_url" TEXT,
    "color_hex" TEXT,
    "fabric_id" TEXT,
    "style_id" TEXT,
    "title" TEXT,
    "caption" TEXT,
    "position_x" INTEGER NOT NULL DEFAULT 0,
    "position_y" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL DEFAULT 200,
    "height" INTEGER NOT NULL DEFAULT 200,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "z_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mood_board_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."mood_boards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "season_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "canvas_width" INTEGER NOT NULL DEFAULT 1920,
    "canvas_height" INTEGER NOT NULL DEFAULT 1080,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mood_boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."motif_master" (
    "id" TEXT NOT NULL,
    "motifCode" TEXT NOT NULL,
    "motifName" TEXT NOT NULL,
    "size" TEXT,
    "type" TEXT,
    "design" TEXT,
    "color" TEXT,
    "pricePerPiece" DECIMAL(10,2),
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "motif_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationType" "public"."NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_bom" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "styleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" "public"."OrderBOMStatus" NOT NULL DEFAULT 'DRAFT',
    "totalMaterialCost" DECIMAL(15,2),
    "sourceCostSheetId" TEXT,
    "copiedFromOrderId" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_bom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_bom_items" (
    "id" TEXT NOT NULL,
    "orderBomId" TEXT NOT NULL,
    "materialType" TEXT NOT NULL,
    "materialId" TEXT,
    "buttonId" TEXT,
    "threadId" TEXT,
    "zipperId" TEXT,
    "laceId" TEXT,
    "elasticId" TEXT,
    "labelId" TEXT,
    "packagingId" TEXT,
    "fabricId" TEXT,
    "quantityPerGarment" DECIMAL(10,4) NOT NULL,
    "orderQuantity" INTEGER NOT NULL,
    "totalQuantity" DECIMAL(15,4) NOT NULL,
    "wastagePercent" DECIMAL(5,2),
    "totalWithWastage" DECIMAL(15,4),
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalCost" DECIMAL(15,2) NOT NULL,
    "componentName" TEXT,
    "usageCategory" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "cadAverageSnapshot" DECIMAL(10,4),
    "fabricWidthInches" DECIMAL(10,2),
    "selectedCadId" TEXT,
    "sourcingStrategy" TEXT,
    "greigeCost" DECIMAL(12,2),
    "greigeId" TEXT,
    "processingCost" DECIMAL(12,2),
    "processorId" TEXT,
    "rateCardId" TEXT,

    CONSTRAINT "order_bom_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_inspections" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "inspectionType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inspectedQuantity" INTEGER,
    "passedQuantity" INTEGER,
    "failedQuantity" INTEGER,
    "scheduledDate" TIMESTAMP(3),
    "inspectedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "defectDetails" TEXT,
    "inspectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_item_breakup" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "colorId" TEXT,
    "sizeId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "order_item_breakup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_item_costing" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "selectedCadId" TEXT,
    "cadMeters" DECIMAL(10,4),
    "cadWidth" DECIMAL(10,2),
    "fabricTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "trimsTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cmtTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "embroideryTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "accessoriesTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "processingTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "overheadsTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalCostPerPiece" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "profitMargin" DECIMAL(5,2),
    "sellingPricePerPiece" DECIMAL(15,2),
    "baseCostingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "recalculatedAt" TIMESTAMP(3),
    "actual_cost_per_piece" DECIMAL(15,2),
    "cost_variance_amount" DECIMAL(15,2),
    "cost_variance_percent" DECIMAL(5,2),
    "costing_snapshot" JSONB,
    "estimated_cost_per_piece" DECIMAL(15,2),
    "original_cost_sheet_version" INTEGER,
    "snapshot_created_at" TIMESTAMP(3),
    "variance_calculated_at" TIMESTAMP(3),

    CONSTRAINT "order_item_costing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "itemDescription" TEXT,
    "totalQuantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "deliveryDate" TIMESTAMP(3),
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "inheritInspections" BOOLEAN NOT NULL DEFAULT true,
    "inheritStyleSamples" BOOLEAN NOT NULL DEFAULT true,
    "selectedCadId" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_label_override" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "styleMaterialBomId" TEXT NOT NULL,
    "extraPercentage" DECIMAL(5,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_label_override_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_label_size_override" (
    "id" TEXT NOT NULL,
    "orderLabelOverrideId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "barcodeValue" TEXT,
    "mrp" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_label_size_override_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_samples" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "sampleType" "public"."SampleType" NOT NULL,
    "status" "public"."SampleStatus" NOT NULL DEFAULT 'REQUESTED',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentDate" TIMESTAMP(3),
    "feedbackDate" TIMESTAMP(3),
    "completionDate" TIMESTAMP(3),
    "remarks" TEXT,
    "feedbackNote" TEXT,
    "courierInfo" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_thread_requirements" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "ply" "public"."ThreadPly" NOT NULL,
    "materialComposition" "public"."ThreadMaterial" NOT NULL,
    "colorId" TEXT NOT NULL,
    "colorName" TEXT NOT NULL,
    "packagingType" "public"."ThreadPackagingType" NOT NULL,
    "inputType" "public"."ThreadQuantityInput" NOT NULL,
    "unitsOrdered" DECIMAL(10,2),
    "boxesOrdered" DECIMAL(10,2),
    "totalUnits" DECIMAL(10,2) NOT NULL,
    "totalBoxes" DECIMAL(10,2) NOT NULL,
    "totalMeters" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(10,2),
    "totalCost" DECIMAL(10,2),
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_thread_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDeliveryDate" TIMESTAMP(3) NOT NULL,
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "public"."Priority" NOT NULL DEFAULT 'MEDIUM',
    "totalQuantity" INTEGER NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "paymentTerms" TEXT,
    "shippingAddress" TEXT,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."other_decorative_master" (
    "id" TEXT NOT NULL,
    "otherDecorativeCode" TEXT NOT NULL,
    "otherDecorativeName" TEXT NOT NULL,
    "type" TEXT,
    "size" TEXT,
    "material" TEXT,
    "color" TEXT,
    "pricePerPiece" DECIMAL(10,2),
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "other_decorative_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."other_fastener_master" (
    "id" TEXT NOT NULL,
    "otherFastenerCode" TEXT NOT NULL,
    "otherFastenerName" TEXT NOT NULL,
    "type" TEXT,
    "size" TEXT,
    "material" TEXT,
    "color" TEXT,
    "pricePerPiece" DECIMAL(10,2),
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "other_fastener_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."other_functional_master" (
    "id" TEXT NOT NULL,
    "otherFunctionalCode" TEXT NOT NULL,
    "otherFunctionalName" TEXT NOT NULL,
    "type" TEXT,
    "size" TEXT,
    "material" TEXT,
    "color" TEXT,
    "pricePerPiece" DECIMAL(10,2),
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "other_functional_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."other_material_master" (
    "id" TEXT NOT NULL,
    "materialCode" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'PIECE',
    "specifications" TEXT,
    "pricePerUnit" DECIMAL(10,2),
    "image" TEXT,
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "other_material_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."other_material_suppliers" (
    "id" TEXT NOT NULL,
    "otherMaterialId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "pricePerUnit" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "other_material_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."other_tape_master" (
    "id" TEXT NOT NULL,
    "otherTapeCode" TEXT NOT NULL,
    "otherTapeName" TEXT NOT NULL,
    "type" TEXT,
    "width" TEXT,
    "material" TEXT,
    "color" TEXT,
    "pricePerMeter" DECIMAL(10,2),
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "other_tape_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."packaging_master" (
    "id" TEXT NOT NULL,
    "packagingCode" TEXT NOT NULL,
    "packagingName" TEXT NOT NULL,
    "supplierCode" TEXT,
    "buyerCode" TEXT,
    "packagingType" TEXT,
    "size" TEXT,
    "material" TEXT,
    "thickness" TEXT,
    "printDetails" TEXT,
    "pricePerPiece" DECIMAL(10,2),
    "pricePerHundred" DECIMAL(10,2),
    "image" TEXT,
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT,
    "brandCategoryId" TEXT,

    CONSTRAINT "packaging_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."packaging_suppliers" (
    "id" TEXT NOT NULL,
    "packagingId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "pricePerPiece" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packaging_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."padding_master" (
    "id" TEXT NOT NULL,
    "paddingCode" TEXT NOT NULL,
    "paddingName" TEXT NOT NULL,
    "type" TEXT,
    "size" TEXT,
    "thickness" TEXT,
    "material" TEXT,
    "color" TEXT,
    "pricePerPair" DECIMAL(10,2),
    "pricePerPiece" DECIMAL(10,2),
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "padding_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pattern_part_groups" (
    "id" TEXT NOT NULL,
    "pattern_part_id" TEXT NOT NULL,
    "component_group_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pattern_part_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pattern_part_master" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pattern_part_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payment_terms" (
    "id" TEXT NOT NULL,
    "termCode" TEXT NOT NULL,
    "termName" TEXT NOT NULL,
    "description" TEXT,
    "daysCount" INTEGER,
    "paymentSchedule" JSONB,
    "discountPercent" DECIMAL(5,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "public"."PaymentMethod" NOT NULL,
    "referenceNumber" TEXT,
    "remarks" TEXT,
    "receivedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."permission_definitions" (
    "id" TEXT NOT NULL,
    "permissionKey" VARCHAR(100) NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "moduleGroup" VARCHAR(50) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."po_source_links" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT NOT NULL,
    "sourceType" "public"."POSource" NOT NULL,
    "costSheetGenerationId" TEXT,
    "materialRequirementId" TEXT,
    "serviceRequirementId" TEXT,
    "quantityLinked" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productionRunId" TEXT,

    CONSTRAINT "po_source_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."polybag_entries" (
    "id" TEXT NOT NULL,
    "finishingIssueId" TEXT NOT NULL,
    "componentId" TEXT,
    "packingDate" TIMESTAMP(3) NOT NULL,
    "totalPolybags" INTEGER NOT NULL,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "polybag_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."polybag_skus" (
    "id" TEXT NOT NULL,
    "polybagEntryId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "packedQty" INTEGER NOT NULL,

    CONSTRAINT "polybag_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."processing_batch" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "materialType" TEXT NOT NULL,
    "greigeId" TEXT,
    "fabricId" TEXT,
    "totalQuantitySent" DECIMAL(10,2) NOT NULL,
    "totalQuantityReceived" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quantityInProcess" DECIMAL(10,2) NOT NULL,
    "quantityInTransit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quantityRejected" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "overallStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "totalCostIncurred" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "colorToApply" TEXT,
    "dyeLotNumber" TEXT,
    "expectedShrinkagePercent" DECIMAL(5,2),
    "finishedLaceId" TEXT,
    "laceId" TEXT,
    "shadeNote" TEXT,
    "workOrderId" TEXT,

    CONSTRAINT "processing_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."processing_delivery" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "deliveryNumber" TEXT NOT NULL,
    "quantityDelivered" DECIMAL(10,2) NOT NULL,
    "quantityAccepted" DECIMAL(10,2) NOT NULL,
    "quantityRejected" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "qualityStatus" TEXT NOT NULL DEFAULT 'PENDING_QC',
    "qualityNotes" TEXT,
    "rejectionReason" TEXT,
    "receivedAtWarehouse" TEXT,
    "nextStageId" TEXT,
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "qcDate" TIMESTAMP(3),
    "acceptanceDate" TIMESTAMP(3),
    "invoiceNumber" TEXT,
    "challanNumber" TEXT,
    "documents" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "receivedById" TEXT NOT NULL,
    "challanId" TEXT,

    CONSTRAINT "processing_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."processing_movement" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "stageId" TEXT,
    "movementType" TEXT NOT NULL,
    "fromLocation" TEXT NOT NULL,
    "toLocation" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_TRANSIT',
    "vehicleNumber" TEXT,
    "driverName" TEXT,
    "lrNumber" TEXT,
    "dispatchDate" TIMESTAMP(3) NOT NULL,
    "expectedDeliveryDate" TIMESTAMP(3),
    "actualDeliveryDate" TIMESTAMP(3),
    "challanNumber" TEXT,
    "documents" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "performedById" TEXT NOT NULL,
    "challanId" TEXT,

    CONSTRAINT "processing_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."processing_stage" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "stageNumber" INTEGER NOT NULL,
    "processorId" TEXT NOT NULL,
    "processorFacility" TEXT,
    "processingType" TEXT NOT NULL,
    "quantitySent" DECIMAL(10,2) NOT NULL,
    "quantityReceived" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quantityInProcess" DECIMAL(10,2) NOT NULL,
    "processSpecifications" TEXT,
    "expectedOutputSpecs" JSONB,
    "actualOutputSpecs" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentDate" TIMESTAMP(3),
    "expectedCompletionDate" TIMESTAMP(3),
    "actualCompletionDate" TIMESTAMP(3),
    "processingCost" DECIMAL(10,2) NOT NULL,
    "qualityNotes" TEXT,
    "reworkReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processing_stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."processor_quantity_slabs" (
    "id" TEXT NOT NULL,
    "processorId" TEXT NOT NULL,
    "processingType" TEXT NOT NULL,
    "slabOrder" INTEGER NOT NULL,
    "minQuantity" DECIMAL(10,2) NOT NULL,
    "maxQuantity" DECIMAL(10,2) NOT NULL,
    "slabLabel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processor_quantity_slabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."processor_rate_card" (
    "id" TEXT NOT NULL,
    "processorId" TEXT NOT NULL,
    "processingType" TEXT NOT NULL,
    "ratePerMeter" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "greigeId" TEXT,
    "slabId" TEXT,
    "printingType" "public"."PrintingType",
    "shrinkagePercent" DECIMAL(5,2),
    "screenCostPerScreen" DECIMAL(10,2),
    "screenType" TEXT,
    "laceId" TEXT,

    CONSTRAINT "processor_rate_card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_category_master" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parent_id" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "max_components" INTEGER NOT NULL DEFAULT 1,
    "min_components" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "product_category_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."production_plans" (
    "id" TEXT NOT NULL,
    "planNumber" TEXT NOT NULL,
    "planDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "production_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."production_tracking" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "productionStage" "public"."ProductionStage" NOT NULL,
    "updateDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantityCompleted" INTEGER NOT NULL,
    "remarks" TEXT,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_order_items" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "materialId" TEXT,
    "orderedQuantity" DECIMAL(10,3) NOT NULL,
    "receivedQuantity" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "unit" "public"."Unit" NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "remarks" TEXT,
    "serviceDescription" TEXT,
    "serviceType" "public"."ServiceType",
    "printingType" TEXT,
    "gstRate" DECIMAL(5,2),
    "cgstRate" DECIMAL(5,2),
    "cgstAmount" DECIMAL(12,2),
    "sgstRate" DECIMAL(5,2),
    "sgstAmount" DECIMAL(12,2),
    "igstRate" DECIMAL(5,2),
    "igstAmount" DECIMAL(12,2),
    "taxAmount" DECIMAL(12,2),
    "hsnCode" TEXT,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_orders" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "poDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDeliveryDate" TIMESTAMP(3) NOT NULL,
    "status" "public"."PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(12,2),
    "paymentTerms" TEXT,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "costSheetGenerationId" TEXT,
    "linkedGreigePOId" TEXT,
    "poCategory" "public"."POCategory" DEFAULT 'GENERAL',
    "mrpBatchId" TEXT,
    "poSource" "public"."POSource" DEFAULT 'MANUAL',
    "serviceWorkOrderId" TEXT,
    "totalCgst" DECIMAL(12,2),
    "totalSgst" DECIMAL(12,2),
    "totalIgst" DECIMAL(12,2),
    "totalTax" DECIMAL(12,2),
    "isInterstate" BOOLEAN NOT NULL DEFAULT false,
    "subtotal" DECIMAL(12,2),
    "isReverseCharge" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."quality_defects" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "defectType" TEXT NOT NULL,
    "defectDescription" TEXT,
    "severity" "public"."Severity" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "image" TEXT,
    "actionTaken" TEXT,

    CONSTRAINT "quality_defects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."quality_inspection" (
    "id" TEXT NOT NULL,
    "inspectionType" TEXT NOT NULL,
    "fabricProcurementId" TEXT,
    "fabricStockId" TEXT,
    "fabricId" TEXT NOT NULL,
    "width" DECIMAL(10,2) NOT NULL,
    "quantityInspected" DECIMAL(10,2) NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "inspectionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "defectTypes" TEXT,
    "defectPoints" INTEGER NOT NULL DEFAULT 0,
    "defectMeters" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "defectPercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "qualityGrade" TEXT NOT NULL,
    "gradeReason" TEXT,
    "aGradeQuantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "bGradeQuantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "defectQuantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "aGradeValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "bGradeValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "defectValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalLoss" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "action" TEXT,
    "supplierClaimAmount" DECIMAL(10,2),
    "claimStatus" TEXT,
    "inspectionPhotos" TEXT,
    "inspectionReportUrl" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."quality_inspections" (
    "id" TEXT NOT NULL,
    "inspectionNumber" TEXT NOT NULL,
    "inspectionType" "public"."InspectionType" NOT NULL,
    "workOrderId" TEXT,
    "styleId" TEXT NOT NULL,
    "inspectionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspectedQuantity" INTEGER NOT NULL,
    "passedQuantity" INTEGER NOT NULL,
    "failedQuantity" INTEGER NOT NULL,
    "reworkQuantity" INTEGER NOT NULL,
    "status" "public"."QualityStatus" NOT NULL,
    "remarks" TEXT,
    "inspectedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "quality_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."quality_inspections_mfg" (
    "id" TEXT NOT NULL,
    "inspectionNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "finishingIssueId" TEXT,
    "inspectionType" TEXT NOT NULL,
    "inspectionDate" TIMESTAMP(3) NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "stage" TEXT,
    "sampleSize" INTEGER NOT NULL,
    "passQty" INTEGER NOT NULL,
    "failQty" INTEGER NOT NULL,
    "defectNotes" TEXT,
    "actionTaken" TEXT,
    "status" "public"."InspectionStatus" NOT NULL,
    "reworkRequired" INTEGER DEFAULT 0,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_inspections_mfg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."quotation_items" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "description" TEXT,
    "totalQuantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "deliveryDays" INTEGER,
    "remarks" TEXT,
    "gstRate" DECIMAL(5,2),
    "cgstRate" DECIMAL(5,2),
    "cgstAmount" DECIMAL(12,2),
    "sgstRate" DECIMAL(5,2),
    "sgstAmount" DECIMAL(12,2),
    "igstRate" DECIMAL(5,2),
    "igstAmount" DECIMAL(12,2),
    "taxAmount" DECIMAL(12,2),
    "hsnCode" TEXT,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."quotations" (
    "id" TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "quotationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" "public"."QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(12,2),
    "remarks" TEXT,
    "termsAndConditions" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "estimatedCGST" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estimatedIGST" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estimatedSGST" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "placeOfSupplyId" TEXT,
    "taxRate" DECIMAL(5,2),
    "totalWithTax" DECIMAL(12,2),

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."requirement_po_links" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT NOT NULL,
    "allocatedQuantity" DECIMAL(12,3) NOT NULL,
    "receivedQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_po_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ribbon_master" (
    "id" TEXT NOT NULL,
    "ribbonCode" TEXT NOT NULL,
    "ribbonName" TEXT NOT NULL,
    "width" TEXT,
    "type" TEXT,
    "color" TEXT,
    "pattern" TEXT,
    "pricePerMeter" DECIMAL(10,2),
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "ribbon_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."role_permissions" (
    "id" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL,
    "permissionKey" VARCHAR(100) NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sample_colorways" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "sizeId" TEXT,
    "fabricLot" TEXT,
    "qtySent" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "sample_colorways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sample_measurements" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "sizeId" TEXT,
    "measurementPoint" TEXT NOT NULL,
    "specValue" DECIMAL(10,2) NOT NULL,
    "actualValue" DECIMAL(10,2),
    "tolerance" DECIMAL(5,2) NOT NULL,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sample_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sample_size_sets" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "sample_size_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."samples" (
    "id" TEXT NOT NULL,
    "sampleNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "styleId" TEXT,
    "sampleType" "public"."SampleType" NOT NULL,
    "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requiredDate" TIMESTAMP(3) NOT NULL,
    "completionDate" TIMESTAMP(3),
    "status" "public"."SampleStatus" NOT NULL DEFAULT 'REQUESTED',
    "customerFeedback" TEXT,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "courierMode" TEXT,
    "feedbackDate" TIMESTAMP(3),
    "linkedDispatchId" TEXT,
    "measurementComments" TEXT,
    "nextAction" TEXT,
    "productionLot" TEXT,
    "purpose" TEXT,
    "receivedDate" TIMESTAMP(3),
    "revisionRequired" BOOLEAN NOT NULL DEFAULT false,
    "sentDate" TIMESTAMP(3),
    "sentTo" TEXT,
    "trackingNumber" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."season_master" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "seasonType" "public"."SeasonType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "season_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sequin_master" (
    "id" TEXT NOT NULL,
    "sequinCode" TEXT NOT NULL,
    "sequinName" TEXT NOT NULL,
    "size" TEXT,
    "shape" TEXT,
    "finish" TEXT,
    "color" TEXT,
    "onTape" BOOLEAN NOT NULL DEFAULT false,
    "pricePerMeter" DECIMAL(10,2),
    "pricePerPack" DECIMAL(10,2),
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "sequin_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."service_requirement_po_links" (
    "id" TEXT NOT NULL,
    "serviceRequirementId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT NOT NULL,
    "quantityLinked" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_requirement_po_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."size_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sizes" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "size_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."size_options" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "sizeName" TEXT NOT NULL,
    "sizeCode" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "size_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."snap_button_master" (
    "id" TEXT NOT NULL,
    "snapButtonCode" TEXT NOT NULL,
    "snapButtonName" TEXT NOT NULL,
    "size" TEXT,
    "type" TEXT,
    "material" TEXT,
    "color" TEXT,
    "pricePerPiece" DECIMAL(10,2),
    "pricePerGross" DECIMAL(10,2),
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "snap_button_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stage_receipt_skus" (
    "id" TEXT NOT NULL,
    "stageReceiptId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "expectedQty" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL,
    "deviation" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "stage_receipt_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stage_receipts" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "transferSlipId" TEXT NOT NULL,
    "receivedDate" TIMESTAMP(3) NOT NULL,
    "receivedById" TEXT NOT NULL,
    "hasDeviation" BOOLEAN NOT NULL DEFAULT false,
    "deviationReason" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stage_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stage_transition_overrides" (
    "id" TEXT NOT NULL,
    "blockType" TEXT NOT NULL,
    "workOrderId" TEXT,
    "orderItemId" TEXT,
    "sampleId" TEXT,
    "fromStage" "public"."ProductionStage",
    "toStage" "public"."ProductionStage" NOT NULL,
    "blockedSampleType" "public"."SampleType",
    "prerequisiteSampleType" "public"."SampleType",
    "overrideReason" TEXT NOT NULL,
    "overriddenById" TEXT NOT NULL,
    "overriddenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stage_transition_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stitching_daily_outputs" (
    "id" TEXT NOT NULL,
    "stitchingIssueId" TEXT NOT NULL,
    "componentId" TEXT,
    "outputDate" TIMESTAMP(3) NOT NULL,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stitching_daily_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stitching_issue_components" (
    "id" TEXT NOT NULL,
    "stitchingIssueId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,

    CONSTRAINT "stitching_issue_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stitching_issue_skus" (
    "id" TEXT NOT NULL,
    "stitchingIssueId" TEXT NOT NULL,
    "colorId" TEXT,
    "sizeId" TEXT NOT NULL,
    "availableQty" INTEGER NOT NULL,
    "issuedQty" INTEGER NOT NULL,

    CONSTRAINT "stitching_issue_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stitching_issues" (
    "id" TEXT NOT NULL,
    "issueNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "managerId" TEXT,
    "expectedCompletionDate" TIMESTAMP(3),
    "status" "public"."StitchingIssueStatus" NOT NULL DEFAULT 'PENDING_RECEIPT',
    "remarks" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "contractorId" TEXT,

    CONSTRAINT "stitching_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stitching_output_skus" (
    "id" TEXT NOT NULL,
    "dailyOutputId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "goodQty" INTEGER NOT NULL DEFAULT 0,
    "defectQty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "stitching_output_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stock_count_items" (
    "id" TEXT NOT NULL,
    "stockCountId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "systemQuantity" DECIMAL(10,3) NOT NULL,
    "physicalQuantity" DECIMAL(10,3),
    "variance" DECIMAL(10,3),
    "unit" "public"."Unit" NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_count_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stock_counts" (
    "id" TEXT NOT NULL,
    "countNumber" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "countType" "public"."CountType" NOT NULL,
    "countDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."CountStatus" NOT NULL DEFAULT 'DRAFT',
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "countedItems" INTEGER NOT NULL DEFAULT 0,
    "varianceItems" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "countedById" TEXT NOT NULL,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stock_levels" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" "public"."Unit" NOT NULL,
    "reorderLevel" DECIMAL(10,3),
    "maxLevel" DECIMAL(10,3),
    "minLevel" DECIMAL(10,3),
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valuationRate" DECIMAL(10,2),
    "stockValue" DECIMAL(12,2),

    CONSTRAINT "stock_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stock_movements" (
    "id" TEXT NOT NULL,
    "movementType" "public"."MovementType" NOT NULL,
    "materialId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" "public"."Unit" NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "referenceNumber" TEXT,
    "fromLocation" TEXT,
    "toLocation" TEXT,
    "rate" DECIMAL(10,2),
    "value" DECIMAL(12,2),
    "remarks" TEXT,
    "performedById" TEXT NOT NULL,
    "movementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stock_reservations" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "reservationType" "public"."ReservationType" NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "reservedQuantity" DECIMAL(10,3) NOT NULL,
    "consumedQuantity" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "unit" "public"."Unit" NOT NULL,
    "status" "public"."ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiryDate" TIMESTAMP(3),
    "remarks" TEXT,
    "reservedById" TEXT NOT NULL,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stock_transactions" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "transactionType" "public"."StockTransactionType" NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" "public"."Unit" NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "balanceQuantity" DECIMAL(10,3) NOT NULL,
    "balanceValue" DECIMAL(12,2) NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "referenceNumber" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."style_accessories" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "accessoryName" TEXT NOT NULL,
    "accessoryType" TEXT NOT NULL,
    "quantityPerPiece" DECIMAL(10,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "supplierName" TEXT,
    "unitPrice" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_accessories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."style_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "style_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."style_comments" (
    "id" TEXT NOT NULL,
    "style_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."style_components" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "component_master_id" TEXT,

    CONSTRAINT "style_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."style_costing" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "totalMaterialCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "printingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalProcessingCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cuttingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "stitchingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "finishingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "checkingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalProductionCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "profitMargin" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "totalCostPerPiece" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sellingPricePerPiece" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "accessoriesCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "adminOverhead" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cadFabricConsumption" DECIMAL(10,4),
    "cadUnit" TEXT,
    "cadWastagePercent" DECIMAL(5,2),
    "cmtCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "dyeingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "embroideryWork" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "fabricCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "factoryOverhead" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "handWork" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "otherMaterialCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "otherOverheads" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "otherProcessingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "packagingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "profitAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "transportCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "trimsCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "washingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "numberOfComponents" INTEGER,
    "category" TEXT,
    "subCategory" TEXT,
    "fabricDetails" JSONB,
    "fabricTotal" DECIMAL(10,2) DEFAULT 0,
    "trimsDetails" JSONB,
    "trimsTotal" DECIMAL(10,2) DEFAULT 0,
    "buttonAttachmentCost" DECIMAL(10,2) DEFAULT 0,
    "handworkCmtCost" DECIMAL(10,2) DEFAULT 0,
    "cmtTotal" DECIMAL(10,2) DEFAULT 0,
    "embroideryDetails" JSONB,
    "embroideryTotal" DECIMAL(10,2) DEFAULT 0,
    "accessoriesDetails" JSONB,
    "accessoriesTotal" DECIMAL(10,2) DEFAULT 0,
    "valueLossPercent" DECIMAL(5,2) DEFAULT 2,
    "valueLossAmount" DECIMAL(10,2) DEFAULT 0,
    "markupPercent" DECIMAL(5,2) DEFAULT 15,
    "markupAmount" DECIMAL(10,2) DEFAULT 0,
    "subtotal" DECIMAL(15,2) DEFAULT 0,
    "totalProductCost" DECIMAL(15,2) DEFAULT 0,
    "costVariancePercent" DECIMAL(5,2),
    "lockedForOrders" BOOLEAN NOT NULL DEFAULT false,
    "supersededById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "versionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "versionReason" TEXT,
    "approvalStatus" "public"."CostSheetApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionNotes" TEXT,
    "width_combination_description" TEXT,
    "width_combination_hash" TEXT,
    "orderId" TEXT,
    "orderItemId" TEXT,
    "accessories_actual" DECIMAL(10,2),
    "accessories_budget" DECIMAL(10,2),
    "accessories_buffer_percent" DECIMAL(5,2) DEFAULT 10.0,
    "accessories_variance" DECIMAL(10,2),
    "accessories_variance_percent" DECIMAL(5,2),
    "cmt_actual" DECIMAL(10,2),
    "cmt_budget" DECIMAL(10,2),
    "cmt_buffer_percent" DECIMAL(5,2) DEFAULT 5.0,
    "cmt_variance" DECIMAL(10,2),
    "cmt_variance_percent" DECIMAL(5,2),
    "copied_from_costing_id" TEXT,
    "embroidery_actual" DECIMAL(10,2),
    "embroidery_budget" DECIMAL(10,2),
    "embroidery_buffer_percent" DECIMAL(5,2) DEFAULT 8.0,
    "embroidery_variance" DECIMAL(10,2),
    "embroidery_variance_percent" DECIMAL(5,2),
    "fabric_actual" DECIMAL(10,2),
    "fabric_budget" DECIMAL(10,2),
    "fabric_buffer_percent" DECIMAL(5,2) DEFAULT 5.0,
    "fabric_variance" DECIMAL(10,2),
    "fabric_variance_percent" DECIMAL(5,2),
    "purpose" "public"."CostSheetPurpose" NOT NULL DEFAULT 'COSTING',
    "total_actual" DECIMAL(10,2),
    "total_budget" DECIMAL(10,2),
    "total_variance" DECIMAL(10,2),
    "total_variance_percent" DECIMAL(5,2),
    "trims_actual" DECIMAL(10,2),
    "trims_budget" DECIMAL(10,2),
    "trims_buffer_percent" DECIMAL(5,2) DEFAULT 10.0,
    "trims_variance" DECIMAL(10,2),
    "trims_variance_percent" DECIMAL(5,2),
    "variance_approved_at" TIMESTAMP(3),
    "variance_approved_by" TEXT,
    "variance_notes" TEXT,
    "variance_status" "public"."CostSheetVarianceStatus" DEFAULT 'PENDING',
    "closed_cost" DECIMAL(15,2),
    "closed_cost_approved_at" TIMESTAMP(3),
    "closed_cost_approved_by_id" TEXT,
    "closed_cost_currency" TEXT DEFAULT 'INR',
    "closed_cost_notes" TEXT,
    "laceTotal" DECIMAL(10,2) DEFAULT 0,
    "smockingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "style_costing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."style_costing_fabric_items" (
    "id" TEXT NOT NULL,
    "costingId" TEXT NOT NULL,
    "fabricId" TEXT,
    "fabricCADId" TEXT,
    "fabricName" TEXT NOT NULL,
    "colorName" TEXT,
    "width" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cadMeters" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "cadWastagePercent" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "effectiveCad" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "costPerMeter" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "costComparisonData" JSONB,
    "greigeCost" DECIMAL(10,2),
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "processingCost" DECIMAL(10,2),
    "processorId" TEXT,
    "procurementId" TEXT,
    "rateCardId" TEXT,
    "readyFabricCost" DECIMAL(10,2),
    "sourcingStrategy" TEXT NOT NULL DEFAULT 'READY_FABRIC',
    "stockCost" DECIMAL(10,2),
    "stockLotId" TEXT,
    "greigeId" TEXT,

    CONSTRAINT "style_costing_fabric_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."style_costing_lace_items" (
    "id" TEXT NOT NULL,
    "costingId" TEXT NOT NULL,
    "laceId" TEXT NOT NULL,
    "laceName" TEXT NOT NULL,
    "colorName" TEXT,
    "width" DECIMAL(10,2),
    "quantityPerGarment" DECIMAL(10,4) NOT NULL,
    "wastagePercent" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "effectiveQuantity" DECIMAL(10,4) NOT NULL,
    "sourcingStrategy" TEXT NOT NULL DEFAULT 'READY_LACE',
    "greigeCost" DECIMAL(10,2),
    "processingCost" DECIMAL(10,2),
    "readyLaceCost" DECIMAL(10,2),
    "stockCost" DECIMAL(10,2),
    "costPerMeter" DECIMAL(10,2) NOT NULL,
    "totalCost" DECIMAL(10,2) NOT NULL,
    "greigeLaceId" TEXT,
    "processorId" TEXT,
    "rateCardId" TEXT,
    "stockLotId" TEXT,
    "procurementId" TEXT,
    "labDipId" TEXT,
    "labDipStatus" TEXT,
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_costing_lace_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."style_costing_thread_items" (
    "id" TEXT NOT NULL,
    "costingId" TEXT NOT NULL,
    "threadId" TEXT,
    "threadName" TEXT NOT NULL,
    "ply" "public"."ThreadPly",
    "materialComposition" "public"."ThreadMaterial",
    "colorName" TEXT,
    "packagingType" "public"."ThreadPackagingType",
    "costPerGarment" DECIMAL(10,2) NOT NULL DEFAULT 4.00,
    "totalCost" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_costing_thread_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."style_fabrics" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "fabricId" TEXT,
    "fabricCADId" TEXT,
    "fabricFinishType" "public"."FabricFinishType",
    "cadGroupKey" TEXT,
    "quantityNeeded" DECIMAL(10,4),
    "unitPrice" DECIMAL(10,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cadAverageMeters" DECIMAL(10,3),
    "cadAverageYards" DECIMAL(10,3),
    "fabricColor" TEXT,
    "fabricGSM" TEXT,
    "fabricName" TEXT,
    "fabricType" TEXT,
    "greigeName" TEXT,
    "supplierName" TEXT,
    "allowCombinedCutting" BOOLEAN NOT NULL DEFAULT true,
    "embroideryCostPerMeter" DECIMAL(10,2),
    "embroideryId" TEXT,
    "fabricCostPerMeter" DECIMAL(10,2),
    "genericGreigeName" TEXT,
    "hasEmbroidery" BOOLEAN NOT NULL DEFAULT false,
    "totalCostPerMeter" DECIMAL(10,2),
    "cutableWidth" DECIMAL(10,2),
    "averagingMode" TEXT DEFAULT 'COMBINED',
    "selectedGreigeId" TEXT,
    "migrationStatus" TEXT DEFAULT 'LINKED',
    "numberOfColors" INTEGER,

    CONSTRAINT "style_fabrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."style_images" (
    "id" TEXT NOT NULL,
    "style_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "image_type" "public"."StyleImageType" NOT NULL DEFAULT 'OTHER',
    "caption" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "style_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."style_import_staging" (
    "id" TEXT NOT NULL,
    "styleCode" TEXT NOT NULL,
    "projectGroup" TEXT,
    "itemDescription" TEXT NOT NULL,
    "customer" TEXT,
    "season" TEXT,
    "gender" TEXT,
    "category" TEXT,
    "componentName" TEXT NOT NULL,
    "fabricDescription" TEXT NOT NULL,
    "cadAverage" DECIMAL(10,4),
    "lastProductionAverage" DECIMAL(10,4),
    "fabricWidth" DECIMAL(10,2),
    "generatedFabricCode" TEXT,
    "generatedFabricName" TEXT,
    "importBatchId" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdStyleId" TEXT,
    "createdFabricId" TEXT,
    "createdComponentId" TEXT,

    CONSTRAINT "style_import_staging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."style_label_size_config" (
    "id" TEXT NOT NULL,
    "styleMaterialBomId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "barcodeValue" TEXT,
    "mrp" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_label_size_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."style_material_bom" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "materialId" TEXT,
    "materialType" "public"."MaterialType" NOT NULL,
    "laceId" TEXT,
    "buttonId" TEXT,
    "threadId" TEXT,
    "zipperId" TEXT,
    "elasticId" TEXT,
    "labelId" TEXT,
    "packagingId" TEXT,
    "usageCategory" "public"."MaterialUsageCategory" NOT NULL,
    "componentName" TEXT,
    "quantityPerGarment" DECIMAL(10,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,2),
    "totalCost" DECIMAL(10,2),
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "machinePartId" TEXT,
    "otherMaterialId" TEXT,
    "extraPercentage" DECIMAL(5,2) DEFAULT 5,

    CONSTRAINT "style_material_bom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."style_packaging" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "specification" TEXT,
    "quantityPerPack" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_packaging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."style_pattern_parts" (
    "id" TEXT NOT NULL,
    "style_fabric_id" TEXT NOT NULL,
    "pattern_part_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "goesToEmbroidery" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_pattern_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."style_processes" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "processName" TEXT NOT NULL,
    "processType" "public"."ProcessType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DECIMAL(10,2),
    "estimatedDays" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "supplierId" TEXT,

    CONSTRAINT "style_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."style_production_tracking" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "currentStage" "public"."ProductionStage" NOT NULL,
    "piecesInStage" INTEGER NOT NULL DEFAULT 0,
    "sizeName" TEXT,
    "piecesOrderReceived" INTEGER NOT NULL DEFAULT 0,
    "piecesPendingCosting" INTEGER NOT NULL DEFAULT 0,
    "piecesPendingGreige" INTEGER NOT NULL DEFAULT 0,
    "piecesTrimsNotOrdered" INTEGER NOT NULL DEFAULT 0,
    "piecesInPrinting" INTEGER NOT NULL DEFAULT 0,
    "piecesInDying" INTEGER NOT NULL DEFAULT 0,
    "piecesInEmbroidery" INTEGER NOT NULL DEFAULT 0,
    "piecesInHandwork" INTEGER NOT NULL DEFAULT 0,
    "piecesInCutting" INTEGER NOT NULL DEFAULT 0,
    "piecesInStitching" INTEGER NOT NULL DEFAULT 0,
    "piecesInFinishing" INTEGER NOT NULL DEFAULT 0,
    "piecesReadyToShip" INTEGER NOT NULL DEFAULT 0,
    "piecesShipped" INTEGER NOT NULL DEFAULT 0,
    "piecesCompleted" INTEGER NOT NULL DEFAULT 0,
    "lastUpdatedStage" "public"."ProductionStage",
    "lastUpdatedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_production_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."style_tech_specs" (
    "id" TEXT NOT NULL,
    "style_id" TEXT NOT NULL,
    "overall_length" DECIMAL(10,2),
    "top_length" DECIMAL(10,2),
    "bottom_length" DECIMAL(10,2),
    "length_unit" TEXT NOT NULL DEFAULT 'inches',
    "sleeve_type" TEXT,
    "collar_type" TEXT,
    "fit_type" TEXT,
    "closure_type" TEXT,
    "design_notes" TEXT,
    "construction_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_tech_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."style_value_additions" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "additionType" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT,
    "numberOfItems" TEXT,
    "estimatedCost" DECIMAL(10,2),
    "vendor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_value_additions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."style_variants" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "sizeId" TEXT,
    "colorId" TEXT,
    "sizeName" TEXT,
    "colorName" TEXT,
    "barcode" TEXT,
    "accountingSKU" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."styles" (
    "id" TEXT NOT NULL,
    "styleCode" TEXT NOT NULL,
    "styleName" TEXT NOT NULL,
    "categoryId" TEXT,
    "brandCategoryId" TEXT,
    "gender" "public"."Gender",
    "ageGroup" "public"."AgeGroup",
    "description" TEXT,
    "specifications" TEXT,
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" "public"."StyleStatus" NOT NULL DEFAULT 'DRAFT',
    "cadStatus" "public"."CADStatus" NOT NULL DEFAULT 'PENDING',
    "approvedCadDate" TIMESTAMP(3),
    "costPrice" DECIMAL(10,2),
    "sellingPrice" DECIMAL(10,2),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "brandName" TEXT,
    "customerName" TEXT,
    "imageUrl" TEXT,
    "season" TEXT,
    "projectGroup" TEXT,
    "bulletPoints" TEXT,
    "accountingSKU" TEXT,
    "accountingUnit" TEXT,
    "hsnCode" TEXT,
    "productTaxRule" TEXT,
    "internalCode" TEXT,
    "numberOfComponents" INTEGER,
    "product_category_id" TEXT,
    "customerAccessoriesPresetId" TEXT,
    "seasonId" TEXT,

    CONSTRAINT "styles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."supplier_gst_numbers" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "stateId" TEXT,
    "stateName" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "gstNumber" TEXT NOT NULL,
    "billingAddress" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "billingCityId" TEXT,
    "billingPincode" TEXT,

    CONSTRAINT "supplier_gst_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."suppliers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "paymentTerms" TEXT,
    "paymentTermsId" TEXT,
    "currencyCode" TEXT,
    "rating" INTEGER DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "creditDays" INTEGER,
    "creditLimit" DECIMAL(10,2),
    "categoryData" JSONB,
    "bankAccountNumber" TEXT,
    "bankName" TEXT,
    "ifscCode" TEXT,
    "supplierCategories" "public"."SupplierCategory"[],
    "billingCityId" TEXT,
    "billingPincode" TEXT,
    "billingStateId" TEXT,
    "shippingAddress" TEXT,
    "shippingCityId" TEXT,
    "shippingPincode" TEXT,
    "shippingStateId" TEXT,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tax_masters" (
    "id" TEXT NOT NULL,
    "taxCode" TEXT NOT NULL,
    "taxName" TEXT NOT NULL,
    "taxType" "public"."TaxType" NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL,
    "hsnSacCode" TEXT,
    "description" TEXT,
    "applicableFrom" TIMESTAMP(3) NOT NULL,
    "applicableTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tcs_entries" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT,
    "customerName" TEXT NOT NULL,
    "tcsSection" TEXT NOT NULL,
    "tcsRate" DECIMAL(5,2) NOT NULL,
    "saleAmount" DECIMAL(12,2) NOT NULL,
    "tcsAmount" DECIMAL(12,2) NOT NULL,
    "collectionDate" TIMESTAMP(3) NOT NULL,
    "financialYear" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tcs_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tds_entries" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "deductorName" TEXT NOT NULL,
    "deducteeName" TEXT NOT NULL,
    "tdsSection" TEXT NOT NULL,
    "tdsRate" DECIMAL(5,2) NOT NULL,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "tdsAmount" DECIMAL(12,2) NOT NULL,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "certificateNo" TEXT,
    "deductionDate" TIMESTAMP(3) NOT NULL,
    "financialYear" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "status" "public"."TDSStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tds_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."test_templates" (
    "id" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "templateType" "public"."TestTemplateType" NOT NULL,
    "requiredParams" JSONB NOT NULL,
    "optionalParams" JSONB,
    "toleranceRanges" JSONB,
    "description" TEXT,
    "testingStandards" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."testing_labs" (
    "id" TEXT NOT NULL,
    "labCode" TEXT NOT NULL,
    "labName" TEXT NOT NULL,
    "contactPerson" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "averageTurnaroundDays" INTEGER NOT NULL DEFAULT 7,
    "accreditations" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testing_labs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."thread_master" (
    "id" TEXT NOT NULL,
    "threadCode" TEXT NOT NULL,
    "threadName" TEXT NOT NULL,
    "supplierCode" TEXT,
    "buyerCode" TEXT,
    "color" TEXT,
    "colorCode" TEXT,
    "coneSize" TEXT,
    "pricePerCone" DECIMAL(10,2),
    "image" TEXT,
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "brand" TEXT,
    "metersPerUnit" DECIMAL(10,2),
    "packagingType" "public"."ThreadPackagingType",
    "piecesPerBox" INTEGER,
    "colorId" TEXT,
    "materialComposition" "public"."ThreadMaterial",
    "ply" "public"."ThreadPly",
    "unitsPerBox" INTEGER,

    CONSTRAINT "thread_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."thread_packaging_specs" (
    "id" TEXT NOT NULL,
    "ply" "public"."ThreadPly" NOT NULL,
    "packagingType" "public"."ThreadPackagingType" NOT NULL,
    "unitsPerBox" INTEGER NOT NULL,
    "metersPerUnit" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thread_packaging_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."thread_style_associations" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thread_style_associations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."thread_suppliers" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "pricePerCone" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thread_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transfer_slip_skus" (
    "id" TEXT NOT NULL,
    "transferSlipId" TEXT NOT NULL,
    "colorId" TEXT,
    "sizeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "transfer_slip_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transfer_slips" (
    "id" TEXT NOT NULL,
    "slipNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "componentId" TEXT,
    "fromStage" TEXT NOT NULL,
    "toStage" TEXT NOT NULL,
    "fromDepartment" TEXT NOT NULL,
    "toDepartment" TEXT NOT NULL,
    "transferDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."TransferSlipStatus" NOT NULL DEFAULT 'CREATED',
    "cuttingBatchId" TEXT,
    "stitchingIssueId" TEXT,
    "finishingIssueId" TEXT,
    "totalGoodPieces" INTEGER NOT NULL,
    "preparedById" TEXT NOT NULL,
    "receivedById" TEXT,
    "receivedDate" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "issuedToId" TEXT,

    CONSTRAINT "transfer_slips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "public"."UserRole" NOT NULL,
    "department" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."velcro_master" (
    "id" TEXT NOT NULL,
    "velcroCode" TEXT NOT NULL,
    "velcroName" TEXT NOT NULL,
    "width" TEXT,
    "type" TEXT,
    "color" TEXT,
    "pricePerMeter" DECIMAL(10,2),
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "velcro_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."warehouses" (
    "id" TEXT NOT NULL,
    "warehouseCode" TEXT NOT NULL,
    "warehouseName" TEXT NOT NULL,
    "warehouseType" "public"."WarehouseType" NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "contactPerson" TEXT,
    "contactPhone" TEXT,
    "capacity" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contactEmail" TEXT,
    "country" TEXT,
    "isVirtual" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."work_order_breakup" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "colorId" TEXT,
    "sizeId" TEXT NOT NULL,
    "plannedQuantity" INTEGER NOT NULL,
    "completedQuantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "work_order_breakup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."work_order_service_requirements" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "serviceType" "public"."ServiceType" NOT NULL,
    "processId" TEXT,
    "quantityRequired" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "preferredProcessorId" TEXT,
    "assignedProcessorId" TEXT,
    "estimatedRate" DECIMAL(10,2),
    "estimatedTotal" DECIMAL(10,2),
    "status" "public"."ServiceRequirementStatus" NOT NULL DEFAULT 'PENDING',
    "purchaseOrderId" TEXT,
    "jobWorkOrderId" TEXT,
    "embroiderySendOutId" TEXT,
    "processingBatchId" TEXT,
    "source" "public"."RequirementSource" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "work_order_service_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."work_orders" (
    "id" TEXT NOT NULL,
    "workOrderNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "plannedStartDate" TIMESTAMP(3) NOT NULL,
    "plannedEndDate" TIMESTAMP(3) NOT NULL,
    "actualStartDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "totalQuantity" INTEGER NOT NULL,
    "completedQuantity" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "public"."Priority" NOT NULL DEFAULT 'MEDIUM',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "fabricLotInfo" JSONB,
    "parentRunId" TEXT,
    "splitReason" TEXT,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."zipper_master" (
    "id" TEXT NOT NULL,
    "zipperCode" TEXT NOT NULL,
    "zipperName" TEXT NOT NULL,
    "supplierCode" TEXT,
    "buyerCode" TEXT,
    "length" DECIMAL(10,2),
    "teethType" TEXT,
    "color" TEXT,
    "brand" TEXT,
    "sliderType" TEXT,
    "tapeWidth" DECIMAL(10,2),
    "pricePerPiece" DECIMAL(10,2),
    "image" TEXT,
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zipper_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."zipper_suppliers" (
    "id" TEXT NOT NULL,
    "zipperId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "pricePerPiece" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zipper_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agencies_code_idx" ON "public"."agencies"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "agencies_code_key" ON "public"."agencies"("code" ASC);

-- CreateIndex
CREATE INDEX "agencies_isActive_idx" ON "public"."agencies"("isActive" ASC);

-- CreateIndex
CREATE INDEX "agencies_name_idx" ON "public"."agencies"("name" ASC);

-- CreateIndex
CREATE INDEX "agents_agencyId_idx" ON "public"."agents"("agencyId" ASC);

-- CreateIndex
CREATE INDEX "agents_code_idx" ON "public"."agents"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "agents_code_key" ON "public"."agents"("code" ASC);

-- CreateIndex
CREATE INDEX "agents_isActive_idx" ON "public"."agents"("isActive" ASC);

-- CreateIndex
CREATE INDEX "agents_name_idx" ON "public"."agents"("name" ASC);

-- CreateIndex
CREATE INDEX "ai_conversations_lastMessageAt_idx" ON "public"."ai_conversations"("lastMessageAt" ASC);

-- CreateIndex
CREATE INDEX "ai_conversations_status_idx" ON "public"."ai_conversations"("status" ASC);

-- CreateIndex
CREATE INDEX "ai_conversations_userId_idx" ON "public"."ai_conversations"("userId" ASC);

-- CreateIndex
CREATE INDEX "ai_feedback_messageId_idx" ON "public"."ai_feedback"("messageId" ASC);

-- CreateIndex
CREATE INDEX "ai_feedback_userId_idx" ON "public"."ai_feedback"("userId" ASC);

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_idx" ON "public"."ai_messages"("conversationId" ASC);

-- CreateIndex
CREATE INDEX "ai_messages_createdAt_idx" ON "public"."ai_messages"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "asn_applications_orderId_idx" ON "public"."asn_applications"("orderId" ASC);

-- CreateIndex
CREATE INDEX "asn_applications_status_idx" ON "public"."asn_applications"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "asn_skus_asnId_colorId_sizeId_key" ON "public"."asn_skus"("asnId" ASC, "colorId" ASC, "sizeId" ASC);

-- CreateIndex
CREATE INDEX "asn_skus_asnId_idx" ON "public"."asn_skus"("asnId" ASC);

-- CreateIndex
CREATE INDEX "audit_logs_entityType_idx" ON "public"."audit_logs"("entityType" ASC);

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "public"."audit_logs"("timestamp" ASC);

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "public"."audit_logs"("userId" ASC);

-- CreateIndex
CREATE INDEX "bank_accounts_accountNumber_idx" ON "public"."bank_accounts"("accountNumber" ASC);

-- CreateIndex
CREATE INDEX "bank_accounts_bankName_idx" ON "public"."bank_accounts"("bankName" ASC);

-- CreateIndex
CREATE INDEX "bead_master_beadCode_idx" ON "public"."bead_master"("beadCode" ASC);

-- CreateIndex
CREATE INDEX "bead_master_supplierId_idx" ON "public"."bead_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "belt_master_beltCode_idx" ON "public"."belt_master"("beltCode" ASC);

-- CreateIndex
CREATE INDEX "belt_master_supplierId_idx" ON "public"."belt_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "brand_categories_brandName_idx" ON "public"."brand_categories"("brandName" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "brand_categories_customerId_brandName_category_subCategory__key" ON "public"."brand_categories"("customerId" ASC, "brandName" ASC, "category" ASC, "subCategory" ASC, "subSubCategory" ASC);

-- CreateIndex
CREATE INDEX "brand_categories_customerId_idx" ON "public"."brand_categories"("customerId" ASC);

-- CreateIndex
CREATE INDEX "brand_categories_productCategoryId_idx" ON "public"."brand_categories"("productCategoryId" ASC);

-- CreateIndex
CREATE INDEX "buckle_master_buckleCode_idx" ON "public"."buckle_master"("buckleCode" ASC);

-- CreateIndex
CREATE INDEX "buckle_master_supplierId_idx" ON "public"."buckle_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "button_master_buttonCode_idx" ON "public"."button_master"("buttonCode" ASC);

-- CreateIndex
CREATE INDEX "button_master_supplierId_idx" ON "public"."button_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "button_style_associations_buttonId_idx" ON "public"."button_style_associations"("buttonId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "button_style_associations_buttonId_styleId_key" ON "public"."button_style_associations"("buttonId" ASC, "styleId" ASC);

-- CreateIndex
CREATE INDEX "button_style_associations_styleId_idx" ON "public"."button_style_associations"("styleId" ASC);

-- CreateIndex
CREATE INDEX "button_suppliers_buttonId_idx" ON "public"."button_suppliers"("buttonId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "button_suppliers_buttonId_supplierId_key" ON "public"."button_suppliers"("buttonId" ASC, "supplierId" ASC);

-- CreateIndex
CREATE INDEX "button_suppliers_supplierId_idx" ON "public"."button_suppliers"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "cad_size_breakdown_cadId_idx" ON "public"."cad_size_breakdown"("cadId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "cad_size_breakdown_cadId_sizeName_key" ON "public"."cad_size_breakdown"("cadId" ASC, "sizeName" ASC);

-- CreateIndex
CREATE INDEX "cad_size_breakdown_sizeId_idx" ON "public"."cad_size_breakdown"("sizeId" ASC);

-- CreateIndex
CREATE INDEX "carton_packings_finishingIssueId_idx" ON "public"."carton_packings"("finishingIssueId" ASC);

-- CreateIndex
CREATE INDEX "carton_packings_status_idx" ON "public"."carton_packings"("status" ASC);

-- CreateIndex
CREATE INDEX "carton_packings_workOrderId_idx" ON "public"."carton_packings"("workOrderId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "carton_skus_cartonId_colorId_sizeId_key" ON "public"."carton_skus"("cartonId" ASC, "colorId" ASC, "sizeId" ASC);

-- CreateIndex
CREATE INDEX "carton_skus_cartonId_idx" ON "public"."carton_skus"("cartonId" ASC);

-- CreateIndex
CREATE INDEX "category_component_defaults_component_master_id_idx" ON "public"."category_component_defaults"("component_master_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "category_component_defaults_product_category_id_component_m_key" ON "public"."category_component_defaults"("product_category_id" ASC, "component_master_id" ASC);

-- CreateIndex
CREATE INDEX "category_component_defaults_product_category_id_idx" ON "public"."category_component_defaults"("product_category_id" ASC);

-- CreateIndex
CREATE INDEX "challan_items_challanId_idx" ON "public"."challan_items"("challanId" ASC);

-- CreateIndex
CREATE INDEX "challan_items_fabricStockId_idx" ON "public"."challan_items"("fabricStockId" ASC);

-- CreateIndex
CREATE INDEX "challan_items_greigeStockId_idx" ON "public"."challan_items"("greigeStockId" ASC);

-- CreateIndex
CREATE INDEX "challan_items_itemType_idx" ON "public"."challan_items"("itemType" ASC);

-- CreateIndex
CREATE INDEX "challan_items_laceStockId_idx" ON "public"."challan_items"("laceStockId" ASC);

-- CreateIndex
CREATE INDEX "challan_items_materialRequirementId_idx" ON "public"."challan_items"("materialRequirementId" ASC);

-- CreateIndex
CREATE INDEX "challan_items_serviceRequirementId_idx" ON "public"."challan_items"("serviceRequirementId" ASC);

-- CreateIndex
CREATE INDEX "challans_challanDate_idx" ON "public"."challans"("challanDate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "challans_challanNumber_key" ON "public"."challans"("challanNumber" ASC);

-- CreateIndex
CREATE INDEX "challans_challanType_idx" ON "public"."challans"("challanType" ASC);

-- CreateIndex
CREATE INDEX "challans_fabricProcessingId_idx" ON "public"."challans"("fabricProcessingId" ASC);

-- CreateIndex
CREATE INDEX "challans_orderId_idx" ON "public"."challans"("orderId" ASC);

-- CreateIndex
CREATE INDEX "challans_productionRunId_idx" ON "public"."challans"("productionRunId" ASC);

-- CreateIndex
CREATE INDEX "challans_purchaseOrderId_idx" ON "public"."challans"("purchaseOrderId" ASC);

-- CreateIndex
CREATE INDEX "challans_status_idx" ON "public"."challans"("status" ASC);

-- CreateIndex
CREATE INDEX "chart_of_accounts_accountCode_idx" ON "public"."chart_of_accounts"("accountCode" ASC);

-- CreateIndex
CREATE INDEX "chart_of_accounts_accountType_idx" ON "public"."chart_of_accounts"("accountType" ASC);

-- CreateIndex
CREATE INDEX "chart_of_accounts_parentAccountId_idx" ON "public"."chart_of_accounts"("parentAccountId" ASC);

-- CreateIndex
CREATE INDEX "color_master_colorFamily_idx" ON "public"."color_master"("colorFamily" ASC);

-- CreateIndex
CREATE INDEX "color_master_colorName_idx" ON "public"."color_master"("colorName" ASC);

-- CreateIndex
CREATE INDEX "color_master_isActive_idx" ON "public"."color_master"("isActive" ASC);

-- CreateIndex
CREATE INDEX "color_options_colorMasterId_idx" ON "public"."color_options"("colorMasterId" ASC);

-- CreateIndex
CREATE INDEX "color_options_styleId_idx" ON "public"."color_options"("styleId" ASC);

-- CreateIndex
CREATE INDEX "component_group_master_isActive_idx" ON "public"."component_group_master"("isActive" ASC);

-- CreateIndex
CREATE INDEX "component_group_master_sortOrder_idx" ON "public"."component_group_master"("sortOrder" ASC);

-- CreateIndex
CREATE INDEX "component_masters_componentCategory_idx" ON "public"."component_masters"("componentCategory" ASC);

-- CreateIndex
CREATE INDEX "component_masters_component_group_id_idx" ON "public"."component_masters"("component_group_id" ASC);

-- CreateIndex
CREATE INDEX "component_masters_isActive_idx" ON "public"."component_masters"("isActive" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "component_masters_name_key" ON "public"."component_masters"("name" ASC);

-- CreateIndex
CREATE INDEX "component_pattern_parts_component_id_idx" ON "public"."component_pattern_parts"("component_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "component_pattern_parts_component_id_pattern_part_id_key" ON "public"."component_pattern_parts"("component_id" ASC, "pattern_part_id" ASC);

-- CreateIndex
CREATE INDEX "component_pattern_parts_pattern_part_id_idx" ON "public"."component_pattern_parts"("pattern_part_id" ASC);

-- CreateIndex
CREATE INDEX "cost_centers_costCenterCode_idx" ON "public"."cost_centers"("costCenterCode" ASC);

-- CreateIndex
CREATE INDEX "cost_centers_locationId_idx" ON "public"."cost_centers"("locationId" ASC);

-- CreateIndex
CREATE INDEX "cost_sheet_po_generation_costSheetId_idx" ON "public"."cost_sheet_po_generation"("costSheetId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "cost_sheet_po_generation_fabricPOId_key" ON "public"."cost_sheet_po_generation"("fabricPOId" ASC);

-- CreateIndex
CREATE INDEX "cost_sheet_po_generation_generatedById_idx" ON "public"."cost_sheet_po_generation"("generatedById" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "cost_sheet_po_generation_greigeLacePOId_key" ON "public"."cost_sheet_po_generation"("greigeLacePOId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "cost_sheet_po_generation_greigePOId_key" ON "public"."cost_sheet_po_generation"("greigePOId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "cost_sheet_po_generation_lacePOId_key" ON "public"."cost_sheet_po_generation"("lacePOId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "cost_sheet_po_generation_laceProcessingPOId_key" ON "public"."cost_sheet_po_generation"("laceProcessingPOId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "cost_sheet_po_generation_processingPOId_key" ON "public"."cost_sheet_po_generation"("processingPOId" ASC);

-- CreateIndex
CREATE INDEX "cost_sheet_po_generation_status_idx" ON "public"."cost_sheet_po_generation"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "cost_sheet_po_generation_trimsPOId_key" ON "public"."cost_sheet_po_generation"("trimsPOId" ASC);

-- CreateIndex
CREATE INDEX "credit_note_items_creditNoteId_idx" ON "public"."credit_note_items"("creditNoteId" ASC);

-- CreateIndex
CREATE INDEX "credit_notes_creditNoteNumber_idx" ON "public"."credit_notes"("creditNoteNumber" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_creditNoteNumber_key" ON "public"."credit_notes"("creditNoteNumber" ASC);

-- CreateIndex
CREATE INDEX "credit_notes_customerId_idx" ON "public"."credit_notes"("customerId" ASC);

-- CreateIndex
CREATE INDEX "credit_notes_invoiceId_idx" ON "public"."credit_notes"("invoiceId" ASC);

-- CreateIndex
CREATE INDEX "credit_notes_status_idx" ON "public"."credit_notes"("status" ASC);

-- CreateIndex
CREATE INDEX "currencies_currencyCode_idx" ON "public"."currencies"("currencyCode" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "currencies_currencyCode_key" ON "public"."currencies"("currencyCode" ASC);

-- CreateIndex
CREATE INDEX "customer_accessories_preset_items_labelId_idx" ON "public"."customer_accessories_preset_items"("labelId" ASC);

-- CreateIndex
CREATE INDEX "customer_accessories_preset_items_materialId_idx" ON "public"."customer_accessories_preset_items"("materialId" ASC);

-- CreateIndex
CREATE INDEX "customer_accessories_preset_items_materialType_idx" ON "public"."customer_accessories_preset_items"("materialType" ASC);

-- CreateIndex
CREATE INDEX "customer_accessories_preset_items_presetId_idx" ON "public"."customer_accessories_preset_items"("presetId" ASC);

-- CreateIndex
CREATE INDEX "customer_accessories_presets_customerId_idx" ON "public"."customer_accessories_presets"("customerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "customer_accessories_presets_customerId_presetName_key" ON "public"."customer_accessories_presets"("customerId" ASC, "presetName" ASC);

-- CreateIndex
CREATE INDEX "customer_accessories_presets_isDefault_idx" ON "public"."customer_accessories_presets"("isDefault" ASC);

-- CreateIndex
CREATE INDEX "customer_gst_numbers_billingCityId_idx" ON "public"."customer_gst_numbers"("billingCityId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "customer_gst_numbers_customerId_gstNumber_key" ON "public"."customer_gst_numbers"("customerId" ASC, "gstNumber" ASC);

-- CreateIndex
CREATE INDEX "customer_gst_numbers_customerId_idx" ON "public"."customer_gst_numbers"("customerId" ASC);

-- CreateIndex
CREATE INDEX "customer_gst_numbers_gstNumber_idx" ON "public"."customer_gst_numbers"("gstNumber" ASC);

-- CreateIndex
CREATE INDEX "customer_gst_numbers_stateId_idx" ON "public"."customer_gst_numbers"("stateId" ASC);

-- CreateIndex
CREATE INDEX "customer_size_category_presets_customerId_idx" ON "public"."customer_size_category_presets"("customerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "customer_size_category_presets_customerId_presetName_key" ON "public"."customer_size_category_presets"("customerId" ASC, "presetName" ASC);

-- CreateIndex
CREATE INDEX "customer_size_category_presets_isDefault_idx" ON "public"."customer_size_category_presets"("isDefault" ASC);

-- CreateIndex
CREATE INDEX "customer_size_category_presets_sizeCategoryId_idx" ON "public"."customer_size_category_presets"("sizeCategoryId" ASC);

-- CreateIndex
CREATE INDEX "customers_agencyId_idx" ON "public"."customers"("agencyId" ASC);

-- CreateIndex
CREATE INDEX "customers_agentId_idx" ON "public"."customers"("agentId" ASC);

-- CreateIndex
CREATE INDEX "customers_billingName_idx" ON "public"."customers"("billingName" ASC);

-- CreateIndex
CREATE INDEX "customers_billingStateId_idx" ON "public"."customers"("billingStateId" ASC);

-- CreateIndex
CREATE INDEX "customers_brandNames_idx" ON "public"."customers"("brandNames" ASC);

-- CreateIndex
CREATE INDEX "customers_code_idx" ON "public"."customers"("code" ASC);

-- CreateIndex
CREATE INDEX "customers_currencyCode_idx" ON "public"."customers"("currencyCode" ASC);

-- CreateIndex
CREATE INDEX "customers_defaultTestingLabId_idx" ON "public"."customers"("defaultTestingLabId" ASC);

-- CreateIndex
CREATE INDEX "customers_fptTemplateId_idx" ON "public"."customers"("fptTemplateId" ASC);

-- CreateIndex
CREATE INDEX "customers_gptTemplateId_idx" ON "public"."customers"("gptTemplateId" ASC);

-- CreateIndex
CREATE INDEX "customers_isActive_idx" ON "public"."customers"("isActive" ASC);

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "public"."customers"("name" ASC);

-- CreateIndex
CREATE INDEX "customers_paymentTermsId_idx" ON "public"."customers"("paymentTermsId" ASC);

-- CreateIndex
CREATE INDEX "customers_shippingStateId_idx" ON "public"."customers"("shippingStateId" ASC);

-- CreateIndex
CREATE INDEX "customers_type_idx" ON "public"."customers"("type" ASC);

-- CreateIndex
CREATE INDEX "cutting_batch_defects_cuttingBatchId_idx" ON "public"."cutting_batch_defects"("cuttingBatchId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "cutting_batch_fabrics_batchId_fabricStockId_key" ON "public"."cutting_batch_fabrics"("batchId" ASC, "fabricStockId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "cutting_batch_skus_cuttingBatchId_colorId_sizeId_key" ON "public"."cutting_batch_skus"("cuttingBatchId" ASC, "colorId" ASC, "sizeId" ASC);

-- CreateIndex
CREATE INDEX "cutting_batch_skus_cuttingBatchId_idx" ON "public"."cutting_batch_skus"("cuttingBatchId" ASC);

-- CreateIndex
CREATE INDEX "cutting_batches_componentId_idx" ON "public"."cutting_batches"("componentId" ASC);

-- CreateIndex
CREATE INDEX "cutting_batches_cuttingDate_idx" ON "public"."cutting_batches"("cuttingDate" ASC);

-- CreateIndex
CREATE INDEX "cutting_batches_fabricStockId_idx" ON "public"."cutting_batches"("fabricStockId" ASC);

-- CreateIndex
CREATE INDEX "cutting_batches_status_idx" ON "public"."cutting_batches"("status" ASC);

-- CreateIndex
CREATE INDEX "cutting_batches_workOrderId_idx" ON "public"."cutting_batches"("workOrderId" ASC);

-- CreateIndex
CREATE INDEX "cutting_batches_workOrderId_status_idx" ON "public"."cutting_batches"("workOrderId" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "cutting_lay_skus_cuttingLayId_colorId_sizeId_key" ON "public"."cutting_lay_skus"("cuttingLayId" ASC, "colorId" ASC, "sizeId" ASC);

-- CreateIndex
CREATE INDEX "cutting_lay_skus_cuttingLayId_idx" ON "public"."cutting_lay_skus"("cuttingLayId" ASC);

-- CreateIndex
CREATE INDEX "cutting_lays_cuttingBatchId_idx" ON "public"."cutting_lays"("cuttingBatchId" ASC);

-- CreateIndex
CREATE INDEX "cutting_lays_layDate_idx" ON "public"."cutting_lays"("layDate" ASC);

-- CreateIndex
CREATE INDEX "debit_note_items_debitNoteId_idx" ON "public"."debit_note_items"("debitNoteId" ASC);

-- CreateIndex
CREATE INDEX "debit_notes_debitNoteNumber_idx" ON "public"."debit_notes"("debitNoteNumber" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "debit_notes_debitNoteNumber_key" ON "public"."debit_notes"("debitNoteNumber" ASC);

-- CreateIndex
CREATE INDEX "debit_notes_poId_idx" ON "public"."debit_notes"("poId" ASC);

-- CreateIndex
CREATE INDEX "debit_notes_status_idx" ON "public"."debit_notes"("status" ASC);

-- CreateIndex
CREATE INDEX "debit_notes_supplierId_idx" ON "public"."debit_notes"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "delivery_note_items_deliveryNoteId_idx" ON "public"."delivery_note_items"("deliveryNoteId" ASC);

-- CreateIndex
CREATE INDEX "delivery_note_items_orderItemId_idx" ON "public"."delivery_note_items"("orderItemId" ASC);

-- CreateIndex
CREATE INDEX "delivery_notes_createdById_idx" ON "public"."delivery_notes"("createdById" ASC);

-- CreateIndex
CREATE INDEX "delivery_notes_customerId_idx" ON "public"."delivery_notes"("customerId" ASC);

-- CreateIndex
CREATE INDEX "delivery_notes_deliveryNumber_idx" ON "public"."delivery_notes"("deliveryNumber" ASC);

-- CreateIndex
CREATE INDEX "delivery_notes_orderId_idx" ON "public"."delivery_notes"("orderId" ASC);

-- CreateIndex
CREATE INDEX "delivery_notes_ext_asnId_idx" ON "public"."delivery_notes_ext"("asnId" ASC);

-- CreateIndex
CREATE INDEX "delivery_notes_ext_deliveryNoteId_idx" ON "public"."delivery_notes_ext"("deliveryNoteId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_notes_ext_deliveryNoteId_key" ON "public"."delivery_notes_ext"("deliveryNoteId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "dispatch_cartons_deliveryNoteExtId_cartonId_key" ON "public"."dispatch_cartons"("deliveryNoteExtId" ASC, "cartonId" ASC);

-- CreateIndex
CREATE INDEX "dispatch_cartons_deliveryNoteExtId_idx" ON "public"."dispatch_cartons"("deliveryNoteExtId" ASC);

-- CreateIndex
CREATE INDEX "dispatch_documents_deliveryNoteExtId_idx" ON "public"."dispatch_documents"("deliveryNoteExtId" ASC);

-- CreateIndex
CREATE INDEX "dispatch_documents_documentType_idx" ON "public"."dispatch_documents"("documentType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "dispatch_pods_deliveryNoteExtId_key" ON "public"."dispatch_pods"("deliveryNoteExtId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "dispatch_transports_deliveryNoteExtId_key" ON "public"."dispatch_transports"("deliveryNoteExtId" ASC);

-- CreateIndex
CREATE INDEX "drawstring_master_drawstringCode_idx" ON "public"."drawstring_master"("drawstringCode" ASC);

-- CreateIndex
CREATE INDEX "drawstring_master_supplierId_idx" ON "public"."drawstring_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "elastic_master_elasticCode_idx" ON "public"."elastic_master"("elasticCode" ASC);

-- CreateIndex
CREATE INDEX "elastic_master_supplierId_idx" ON "public"."elastic_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "elastic_suppliers_elasticId_idx" ON "public"."elastic_suppliers"("elasticId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "elastic_suppliers_elasticId_supplierId_key" ON "public"."elastic_suppliers"("elasticId" ASC, "supplierId" ASC);

-- CreateIndex
CREATE INDEX "elastic_suppliers_supplierId_idx" ON "public"."elastic_suppliers"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "embroidery_cad_size_breakdown_embroidery_cad_id_idx" ON "public"."embroidery_cad_size_breakdown"("embroidery_cad_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "embroidery_cad_size_breakdown_embroidery_cad_id_sizeName_key" ON "public"."embroidery_cad_size_breakdown"("embroidery_cad_id" ASC, "sizeName" ASC);

-- CreateIndex
CREATE INDEX "embroidery_cad_size_breakdown_size_id_idx" ON "public"."embroidery_cad_size_breakdown"("size_id" ASC);

-- CreateIndex
CREATE INDEX "embroidery_master_embroideryCode_idx" ON "public"."embroidery_master"("embroideryCode" ASC);

-- CreateIndex
CREATE INDEX "embroidery_master_isActive_idx" ON "public"."embroidery_master"("isActive" ASC);

-- CreateIndex
CREATE INDEX "embroidery_master_supplierId_idx" ON "public"."embroidery_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "embroidery_part_cad_embroidery_id_idx" ON "public"."embroidery_part_cad"("embroidery_id" ASC);

-- CreateIndex
CREATE INDEX "embroidery_part_cad_fabric_width_cad_id_idx" ON "public"."embroidery_part_cad"("fabric_width_cad_id" ASC);

-- CreateIndex
CREATE INDEX "embroidery_part_cad_style_fabric_id_idx" ON "public"."embroidery_part_cad"("style_fabric_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "embroidery_part_cad_style_fabric_id_key" ON "public"."embroidery_part_cad"("style_fabric_id" ASC);

-- CreateIndex
CREATE INDEX "embroidery_send_out_embroideryId_idx" ON "public"."embroidery_send_out"("embroideryId" ASC);

-- CreateIndex
CREATE INDEX "embroidery_send_out_forOrderId_idx" ON "public"."embroidery_send_out"("forOrderId" ASC);

-- CreateIndex
CREATE INDEX "embroidery_send_out_forStyleId_idx" ON "public"."embroidery_send_out"("forStyleId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "embroidery_send_out_resultFabricStockId_key" ON "public"."embroidery_send_out"("resultFabricStockId" ASC);

-- CreateIndex
CREATE INDEX "embroidery_send_out_sendDate_idx" ON "public"."embroidery_send_out"("sendDate" ASC);

-- CreateIndex
CREATE INDEX "embroidery_send_out_sourceFabricStockId_idx" ON "public"."embroidery_send_out"("sourceFabricStockId" ASC);

-- CreateIndex
CREATE INDEX "embroidery_send_out_status_idx" ON "public"."embroidery_send_out"("status" ASC);

-- CreateIndex
CREATE INDEX "embroidery_send_out_supplierId_idx" ON "public"."embroidery_send_out"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "embroidery_send_out_workOrderId_idx" ON "public"."embroidery_send_out"("workOrderId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_currencyCode_effectiveDate_rateType_key" ON "public"."exchange_rates"("currencyCode" ASC, "effectiveDate" ASC, "rateType" ASC);

-- CreateIndex
CREATE INDEX "exchange_rates_currencyCode_idx" ON "public"."exchange_rates"("currencyCode" ASC);

-- CreateIndex
CREATE INDEX "exchange_rates_effectiveDate_idx" ON "public"."exchange_rates"("effectiveDate" ASC);

-- CreateIndex
CREATE INDEX "expense_types_accountId_idx" ON "public"."expense_types"("accountId" ASC);

-- CreateIndex
CREATE INDEX "expense_types_expenseCode_idx" ON "public"."expense_types"("expenseCode" ASC);

-- CreateIndex
CREATE INDEX "export_templates_createdById_idx" ON "public"."export_templates"("createdById" ASC);

-- CreateIndex
CREATE INDEX "export_templates_moduleName_idx" ON "public"."export_templates"("moduleName" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "export_templates_moduleName_templateName_key" ON "public"."export_templates"("moduleName" ASC, "templateName" ASC);

-- CreateIndex
CREATE INDEX "fabric_costing_run_createdAt_idx" ON "public"."fabric_costing_run"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "fabric_costing_run_styleId_purpose_idx" ON "public"."fabric_costing_run"("styleId" ASC, "purpose" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "fabric_costing_run_styleId_purpose_runNumber_key" ON "public"."fabric_costing_run"("styleId" ASC, "purpose" ASC, "runNumber" ASC);

-- CreateIndex
CREATE INDEX "fabric_master_fabricCode_idx" ON "public"."fabric_master"("fabricCode" ASC);

-- CreateIndex
CREATE INDEX "fabric_master_greigeId_idx" ON "public"."fabric_master"("greigeId" ASC);

-- CreateIndex
CREATE INDEX "fabric_master_isActive_idx" ON "public"."fabric_master"("isActive" ASC);

-- CreateIndex
CREATE INDEX "fabric_master_styleReference_idx" ON "public"."fabric_master"("styleReference" ASC);

-- CreateIndex
CREATE INDEX "fabric_master_supplierId_idx" ON "public"."fabric_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "fabric_physical_tests_createdAt_idx" ON "public"."fabric_physical_tests"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "fabric_physical_tests_customerId_idx" ON "public"."fabric_physical_tests"("customerId" ASC);

-- CreateIndex
CREATE INDEX "fabric_physical_tests_fabricId_idx" ON "public"."fabric_physical_tests"("fabricId" ASC);

-- CreateIndex
CREATE INDEX "fabric_physical_tests_fabricProcurementId_idx" ON "public"."fabric_physical_tests"("fabricProcurementId" ASC);

-- CreateIndex
CREATE INDEX "fabric_physical_tests_fabricStockLotId_idx" ON "public"."fabric_physical_tests"("fabricStockLotId" ASC);

-- CreateIndex
CREATE INDEX "fabric_physical_tests_overallTestResult_idx" ON "public"."fabric_physical_tests"("overallTestResult" ASC);

-- CreateIndex
CREATE INDEX "fabric_physical_tests_sentToLabDate_idx" ON "public"."fabric_physical_tests"("sentToLabDate" ASC);

-- CreateIndex
CREATE INDEX "fabric_physical_tests_styleId_idx" ON "public"."fabric_physical_tests"("styleId" ASC);

-- CreateIndex
CREATE INDEX "fabric_physical_tests_testNumber_idx" ON "public"."fabric_physical_tests"("testNumber" ASC);

-- CreateIndex
CREATE INDEX "fabric_physical_tests_testingLabId_idx" ON "public"."fabric_physical_tests"("testingLabId" ASC);

-- CreateIndex
CREATE INDEX "fabric_processing_processingMillId_greigeId_idx" ON "public"."fabric_processing"("processingMillId" ASC, "greigeId" ASC);

-- CreateIndex
CREATE INDEX "fabric_processing_processingStatus_idx" ON "public"."fabric_processing"("processingStatus" ASC);

-- CreateIndex
CREATE INDEX "fabric_processing_procurementId_idx" ON "public"."fabric_processing"("procurementId" ASC);

-- CreateIndex
CREATE INDEX "fabric_processing_sentDate_idx" ON "public"."fabric_processing"("sentDate" ASC);

-- CreateIndex
CREATE INDEX "fabric_procurement_orderedForOrderId_idx" ON "public"."fabric_procurement"("orderedForOrderId" ASC);

-- CreateIndex
CREATE INDEX "fabric_procurement_orderedForStyleId_idx" ON "public"."fabric_procurement"("orderedForStyleId" ASC);

-- CreateIndex
CREATE INDEX "fabric_procurement_procurementType_idx" ON "public"."fabric_procurement"("procurementType" ASC);

-- CreateIndex
CREATE INDEX "fabric_procurement_purchaseDate_idx" ON "public"."fabric_procurement"("purchaseDate" ASC);

-- CreateIndex
CREATE INDEX "fabric_procurement_status_idx" ON "public"."fabric_procurement"("status" ASC);

-- CreateIndex
CREATE INDEX "fabric_procurement_supplierId_idx" ON "public"."fabric_procurement"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "fabric_stock_agingDays_idx" ON "public"."fabric_stock"("agingDays" ASC);

-- CreateIndex
CREATE INDEX "fabric_stock_embroideryId_idx" ON "public"."fabric_stock"("embroideryId" ASC);

-- CreateIndex
CREATE INDEX "fabric_stock_fabricFinishType_idx" ON "public"."fabric_stock"("fabricFinishType" ASC);

-- CreateIndex
CREATE INDEX "fabric_stock_fabricId_finishedWidth_cutableWidth_status_idx" ON "public"."fabric_stock"("fabricId" ASC, "finishedWidth" ASC, "cutableWidth" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "fabric_stock_fabricId_procurementId_finishedWidth_cutableWi_key" ON "public"."fabric_stock"("fabricId" ASC, "procurementId" ASC, "finishedWidth" ASC, "cutableWidth" ASC, "qualityGrade" ASC, "embroideryId" ASC);

-- CreateIndex
CREATE INDEX "fabric_stock_originOrderId_idx" ON "public"."fabric_stock"("originOrderId" ASC);

-- CreateIndex
CREATE INDEX "fabric_stock_originStyleId_idx" ON "public"."fabric_stock"("originStyleId" ASC);

-- CreateIndex
CREATE INDEX "fabric_stock_pattern_part_id_idx" ON "public"."fabric_stock"("pattern_part_id" ASC);

-- CreateIndex
CREATE INDEX "fabric_stock_procurementId_status_idx" ON "public"."fabric_stock"("procurementId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "fabric_stock_qualityGrade_idx" ON "public"."fabric_stock"("qualityGrade" ASC);

-- CreateIndex
CREATE INDEX "fabric_stock_status_idx" ON "public"."fabric_stock"("status" ASC);

-- CreateIndex
CREATE INDEX "fabric_stock_stockType_idx" ON "public"."fabric_stock"("stockType" ASC);

-- CreateIndex
CREATE INDEX "fabric_stock_allocation_allocationStatus_idx" ON "public"."fabric_stock_allocation"("allocationStatus" ASC);

-- CreateIndex
CREATE INDEX "fabric_stock_allocation_allocationType_idx" ON "public"."fabric_stock_allocation"("allocationType" ASC);

-- CreateIndex
CREATE INDEX "fabric_stock_allocation_orderId_idx" ON "public"."fabric_stock_allocation"("orderId" ASC);

-- CreateIndex
CREATE INDEX "fabric_stock_allocation_production_cad_id_idx" ON "public"."fabric_stock_allocation"("production_cad_id" ASC);

-- CreateIndex
CREATE INDEX "fabric_stock_allocation_stockId_idx" ON "public"."fabric_stock_allocation"("stockId" ASC);

-- CreateIndex
CREATE INDEX "fabric_stock_allocation_styleId_idx" ON "public"."fabric_stock_allocation"("styleId" ASC);

-- CreateIndex
CREATE INDEX "fabric_stock_transaction_referenceType_referenceId_idx" ON "public"."fabric_stock_transaction"("referenceType" ASC, "referenceId" ASC);

-- CreateIndex
CREATE INDEX "fabric_stock_transaction_stockId_idx" ON "public"."fabric_stock_transaction"("stockId" ASC);

-- CreateIndex
CREATE INDEX "fabric_stock_transaction_transactionDate_idx" ON "public"."fabric_stock_transaction"("transactionDate" ASC);

-- CreateIndex
CREATE INDEX "fabric_stock_transaction_transactionType_idx" ON "public"."fabric_stock_transaction"("transactionType" ASC);

-- CreateIndex
CREATE INDEX "fabric_suppliers_fabricId_idx" ON "public"."fabric_suppliers"("fabricId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "fabric_suppliers_fabricId_supplierId_key" ON "public"."fabric_suppliers"("fabricId" ASC, "supplierId" ASC);

-- CreateIndex
CREATE INDEX "fabric_suppliers_supplierId_idx" ON "public"."fabric_suppliers"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_approval_status_idx" ON "public"."fabric_width_cad"("approval_status" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_approved_by_idx" ON "public"."fabric_width_cad"("approved_by" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_cloned_from_cad_id_idx" ON "public"."fabric_width_cad"("cloned_from_cad_id" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_cloned_from_order_id_idx" ON "public"."fabric_width_cad"("cloned_from_order_id" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_copied_from_id_idx" ON "public"."fabric_width_cad"("copied_from_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "fabric_width_cad_costingStyleId_componentName_style_fabric__key" ON "public"."fabric_width_cad"("costingStyleId" ASC, "componentName" ASC, "style_fabric_id" ASC, "cutableWidth" ASC, "purpose" ASC, "approval_status" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_costingStyleId_idx" ON "public"."fabric_width_cad"("costingStyleId" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_costing_run_id_idx" ON "public"."fabric_width_cad"("costing_run_id" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_createdById_idx" ON "public"."fabric_width_cad"("createdById" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_fabricId_idx" ON "public"."fabric_width_cad"("fabricId" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_fabric_stock_id_idx" ON "public"."fabric_width_cad"("fabric_stock_id" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_greigeId_idx" ON "public"."fabric_width_cad"("greigeId" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_greigeId_isPreferred_idx" ON "public"."fabric_width_cad"("greigeId" ASC, "isPreferred" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_greige_rate_source_idx" ON "public"."fabric_width_cad"("greige_rate_source" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_isPreferred_idx" ON "public"."fabric_width_cad"("isPreferred" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_is_locked_idx" ON "public"."fabric_width_cad"("is_locked" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_pattern_part_id_idx" ON "public"."fabric_width_cad"("pattern_part_id" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_processorId_idx" ON "public"."fabric_width_cad"("processorId" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_procurement_id_idx" ON "public"."fabric_width_cad"("procurement_id" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_purpose_enum_idx" ON "public"."fabric_width_cad"("purpose_enum" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_purpose_idx" ON "public"."fabric_width_cad"("purpose" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_style_costing_id_idx" ON "public"."fabric_width_cad"("style_costing_id" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_style_fabric_id_cadMeters_idx" ON "public"."fabric_width_cad"("style_fabric_id" ASC, "cadMeters" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_style_fabric_id_idx" ON "public"."fabric_width_cad"("style_fabric_id" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_superseded_by_id_idx" ON "public"."fabric_width_cad"("superseded_by_id" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_variance_approval_status_idx" ON "public"."fabric_width_cad"("variance_approval_status" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_variance_approved_by_idx" ON "public"."fabric_width_cad"("variance_approved_by" ASC);

-- CreateIndex
CREATE INDEX "fabric_width_cad_version_idx" ON "public"."fabric_width_cad"("version" ASC);

-- CreateIndex
CREATE INDEX "finished_goods_stock_locationId_idx" ON "public"."finished_goods_stock"("locationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "finished_goods_stock_styleId_colorId_sizeId_locationId_key" ON "public"."finished_goods_stock"("styleId" ASC, "colorId" ASC, "sizeId" ASC, "locationId" ASC);

-- CreateIndex
CREATE INDEX "finished_goods_stock_styleId_idx" ON "public"."finished_goods_stock"("styleId" ASC);

-- CreateIndex
CREATE INDEX "finishing_daily_outputs_finishingIssueId_idx" ON "public"."finishing_daily_outputs"("finishingIssueId" ASC);

-- CreateIndex
CREATE INDEX "finishing_daily_outputs_outputDate_idx" ON "public"."finishing_daily_outputs"("outputDate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "finishing_issue_components_finishingIssueId_componentId_key" ON "public"."finishing_issue_components"("finishingIssueId" ASC, "componentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "finishing_issue_skus_finishingIssueId_colorId_sizeId_key" ON "public"."finishing_issue_skus"("finishingIssueId" ASC, "colorId" ASC, "sizeId" ASC);

-- CreateIndex
CREATE INDEX "finishing_issue_skus_finishingIssueId_idx" ON "public"."finishing_issue_skus"("finishingIssueId" ASC);

-- CreateIndex
CREATE INDEX "finishing_issues_managerId_idx" ON "public"."finishing_issues"("managerId" ASC);

-- CreateIndex
CREATE INDEX "finishing_issues_status_idx" ON "public"."finishing_issues"("status" ASC);

-- CreateIndex
CREATE INDEX "finishing_issues_workOrderId_idx" ON "public"."finishing_issues"("workOrderId" ASC);

-- CreateIndex
CREATE INDEX "finishing_issues_workOrderId_status_idx" ON "public"."finishing_issues"("workOrderId" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "finishing_output_skus_dailyOutputId_colorId_sizeId_key" ON "public"."finishing_output_skus"("dailyOutputId" ASC, "colorId" ASC, "sizeId" ASC);

-- CreateIndex
CREATE INDEX "finishing_output_skus_dailyOutputId_idx" ON "public"."finishing_output_skus"("dailyOutputId" ASC);

-- CreateIndex
CREATE INDEX "garment_physical_tests_createdAt_idx" ON "public"."garment_physical_tests"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "garment_physical_tests_customerId_idx" ON "public"."garment_physical_tests"("customerId" ASC);

-- CreateIndex
CREATE INDEX "garment_physical_tests_overallTestResult_idx" ON "public"."garment_physical_tests"("overallTestResult" ASC);

-- CreateIndex
CREATE INDEX "garment_physical_tests_sentToLabDate_idx" ON "public"."garment_physical_tests"("sentToLabDate" ASC);

-- CreateIndex
CREATE INDEX "garment_physical_tests_styleId_idx" ON "public"."garment_physical_tests"("styleId" ASC);

-- CreateIndex
CREATE INDEX "garment_physical_tests_testNumber_idx" ON "public"."garment_physical_tests"("testNumber" ASC);

-- CreateIndex
CREATE INDEX "garment_physical_tests_testingLabId_idx" ON "public"."garment_physical_tests"("testingLabId" ASC);

-- CreateIndex
CREATE INDEX "garment_physical_tests_workOrderId_idx" ON "public"."garment_physical_tests"("workOrderId" ASC);

-- CreateIndex
CREATE INDEX "goods_receiving_notes_approvedById_idx" ON "public"."goods_receiving_notes"("approvedById" ASC);

-- CreateIndex
CREATE INDEX "goods_receiving_notes_grnNumber_idx" ON "public"."goods_receiving_notes"("grnNumber" ASC);

-- CreateIndex
CREATE INDEX "goods_receiving_notes_poId_idx" ON "public"."goods_receiving_notes"("poId" ASC);

-- CreateIndex
CREATE INDEX "goods_receiving_notes_receivedById_idx" ON "public"."goods_receiving_notes"("receivedById" ASC);

-- CreateIndex
CREATE INDEX "goods_receiving_notes_supplierId_idx" ON "public"."goods_receiving_notes"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "goods_receiving_notes_warehouseId_idx" ON "public"."goods_receiving_notes"("warehouseId" ASC);

-- CreateIndex
CREATE INDEX "greige_master_greigeCode_idx" ON "public"."greige_master"("greigeCode" ASC);

-- CreateIndex
CREATE INDEX "greige_master_isActive_idx" ON "public"."greige_master"("isActive" ASC);

-- CreateIndex
CREATE INDEX "greige_master_supplierId_idx" ON "public"."greige_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "greige_stock_greigeId_idx" ON "public"."greige_stock"("greigeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "greige_stock_greigeId_procurementId_greigeWidth_qualityGrad_key" ON "public"."greige_stock"("greigeId" ASC, "procurementId" ASC, "greigeWidth" ASC, "qualityGrade" ASC);

-- CreateIndex
CREATE INDEX "greige_stock_receivedDate_idx" ON "public"."greige_stock"("receivedDate" ASC);

-- CreateIndex
CREATE INDEX "greige_stock_status_idx" ON "public"."greige_stock"("status" ASC);

-- CreateIndex
CREATE INDEX "greige_suppliers_greigeId_idx" ON "public"."greige_suppliers"("greigeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "greige_suppliers_greigeId_supplierId_key" ON "public"."greige_suppliers"("greigeId" ASC, "supplierId" ASC);

-- CreateIndex
CREATE INDEX "greige_suppliers_supplierId_idx" ON "public"."greige_suppliers"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "grn_items_grnId_idx" ON "public"."grn_items"("grnId" ASC);

-- CreateIndex
CREATE INDEX "grn_items_poItemId_idx" ON "public"."grn_items"("poItemId" ASC);

-- CreateIndex
CREATE INDEX "hook_eye_master_hookEyeCode_idx" ON "public"."hook_eye_master"("hookEyeCode" ASC);

-- CreateIndex
CREATE INDEX "hook_eye_master_supplierId_idx" ON "public"."hook_eye_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "hsn_sac_masters_chapter_idx" ON "public"."hsn_sac_masters"("chapter" ASC);

-- CreateIndex
CREATE INDEX "hsn_sac_masters_code_idx" ON "public"."hsn_sac_masters"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "hsn_sac_masters_code_key" ON "public"."hsn_sac_masters"("code" ASC);

-- CreateIndex
CREATE INDEX "hsn_sac_masters_type_idx" ON "public"."hsn_sac_masters"("type" ASC);

-- CreateIndex
CREATE INDEX "indian_cities_isActive_idx" ON "public"."indian_cities"("isActive" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "indian_cities_stateId_cityName_key" ON "public"."indian_cities"("stateId" ASC, "cityName" ASC);

-- CreateIndex
CREATE INDEX "indian_cities_stateId_idx" ON "public"."indian_cities"("stateId" ASC);

-- CreateIndex
CREATE INDEX "indian_states_isActive_idx" ON "public"."indian_states"("isActive" ASC);

-- CreateIndex
CREATE INDEX "indian_states_stateCode_idx" ON "public"."indian_states"("stateCode" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "indian_states_stateCode_key" ON "public"."indian_states"("stateCode" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "indian_states_stateName_key" ON "public"."indian_states"("stateName" ASC);

-- CreateIndex
CREATE INDEX "interlining_master_interliningCode_idx" ON "public"."interlining_master"("interliningCode" ASC);

-- CreateIndex
CREATE INDEX "interlining_master_supplierId_idx" ON "public"."interlining_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "inventory_stock_locationId_idx" ON "public"."inventory_stock"("locationId" ASC);

-- CreateIndex
CREATE INDEX "inventory_stock_materialId_idx" ON "public"."inventory_stock"("materialId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_stock_materialId_locationId_key" ON "public"."inventory_stock"("materialId" ASC, "locationId" ASC);

-- CreateIndex
CREATE INDEX "invoice_items_invoiceId_idx" ON "public"."invoice_items"("invoiceId" ASC);

-- CreateIndex
CREATE INDEX "invoice_items_styleId_idx" ON "public"."invoice_items"("styleId" ASC);

-- CreateIndex
CREATE INDEX "invoices_customerId_idx" ON "public"."invoices"("customerId" ASC);

-- CreateIndex
CREATE INDEX "invoices_invoiceNumber_idx" ON "public"."invoices"("invoiceNumber" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "public"."invoices"("invoiceNumber" ASC);

-- CreateIndex
CREATE INDEX "invoices_orderId_idx" ON "public"."invoices"("orderId" ASC);

-- CreateIndex
CREATE INDEX "invoices_placeOfSupplyId_idx" ON "public"."invoices"("placeOfSupplyId" ASC);

-- CreateIndex
CREATE INDEX "job_work_orders_finishedFabricId_idx" ON "public"."job_work_orders"("finishedFabricId" ASC);

-- CreateIndex
CREATE INDEX "job_work_orders_greigeStockLotId_idx" ON "public"."job_work_orders"("greigeStockLotId" ASC);

-- CreateIndex
CREATE INDEX "job_work_orders_grnId_idx" ON "public"."job_work_orders"("grnId" ASC);

-- CreateIndex
CREATE INDEX "job_work_orders_inwardChallanId_idx" ON "public"."job_work_orders"("inwardChallanId" ASC);

-- CreateIndex
CREATE INDEX "job_work_orders_labDipId_idx" ON "public"."job_work_orders"("labDipId" ASC);

-- CreateIndex
CREATE INDEX "job_work_orders_millId_idx" ON "public"."job_work_orders"("millId" ASC);

-- CreateIndex
CREATE INDEX "job_work_orders_outwardChallanId_idx" ON "public"."job_work_orders"("outwardChallanId" ASC);

-- CreateIndex
CREATE INDEX "job_work_orders_processType_idx" ON "public"."job_work_orders"("processType" ASC);

-- CreateIndex
CREATE INDEX "job_work_orders_purchaseOrderId_idx" ON "public"."job_work_orders"("purchaseOrderId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "job_work_orders_purchaseOrderId_key" ON "public"."job_work_orders"("purchaseOrderId" ASC);

-- CreateIndex
CREATE INDEX "job_work_orders_status_idx" ON "public"."job_work_orders"("status" ASC);

-- CreateIndex
CREATE INDEX "job_work_orders_styleId_idx" ON "public"."job_work_orders"("styleId" ASC);

-- CreateIndex
CREATE INDEX "job_work_orders_workOrderId_idx" ON "public"."job_work_orders"("workOrderId" ASC);

-- CreateIndex
CREATE INDEX "lab_dips_processType_idx" ON "public"."lab_dips"("processType" ASC);

-- CreateIndex
CREATE INDEX "lab_dips_status_idx" ON "public"."lab_dips"("status" ASC);

-- CreateIndex
CREATE INDEX "lab_dips_styleId_idx" ON "public"."lab_dips"("styleId" ASC);

-- CreateIndex
CREATE INDEX "label_master_brandCategoryId_idx" ON "public"."label_master"("brandCategoryId" ASC);

-- CreateIndex
CREATE INDEX "label_master_customerId_idx" ON "public"."label_master"("customerId" ASC);

-- CreateIndex
CREATE INDEX "label_master_labelCode_idx" ON "public"."label_master"("labelCode" ASC);

-- CreateIndex
CREATE INDEX "label_master_supplierId_idx" ON "public"."label_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "label_size_variants_labelId_idx" ON "public"."label_size_variants"("labelId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "label_size_variants_labelId_size_key" ON "public"."label_size_variants"("labelId" ASC, "size" ASC);

-- CreateIndex
CREATE INDEX "label_size_variants_sizeCategoryId_idx" ON "public"."label_size_variants"("sizeCategoryId" ASC);

-- CreateIndex
CREATE INDEX "label_size_variants_size_idx" ON "public"."label_size_variants"("size" ASC);

-- CreateIndex
CREATE INDEX "label_suppliers_labelId_idx" ON "public"."label_suppliers"("labelId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "label_suppliers_labelId_supplierId_key" ON "public"."label_suppliers"("labelId" ASC, "supplierId" ASC);

-- CreateIndex
CREATE INDEX "label_suppliers_supplierId_idx" ON "public"."label_suppliers"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "lace_defect_log_claimStatus_idx" ON "public"."lace_defect_log"("claimStatus" ASC);

-- CreateIndex
CREATE INDEX "lace_defect_log_laceId_idx" ON "public"."lace_defect_log"("laceId" ASC);

-- CreateIndex
CREATE INDEX "lace_defect_log_orderId_idx" ON "public"."lace_defect_log"("orderId" ASC);

-- CreateIndex
CREATE INDEX "lace_defect_log_stockId_idx" ON "public"."lace_defect_log"("stockId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "lace_issue_note_issueNumber_key" ON "public"."lace_issue_note"("issueNumber" ASC);

-- CreateIndex
CREATE INDEX "lace_issue_note_orderId_idx" ON "public"."lace_issue_note"("orderId" ASC);

-- CreateIndex
CREATE INDEX "lace_issue_note_status_idx" ON "public"."lace_issue_note"("status" ASC);

-- CreateIndex
CREATE INDEX "lace_issue_note_stockId_idx" ON "public"."lace_issue_note"("stockId" ASC);

-- CreateIndex
CREATE INDEX "lace_issue_note_styleId_idx" ON "public"."lace_issue_note"("styleId" ASC);

-- CreateIndex
CREATE INDEX "lace_lab_dip_costSheetId_idx" ON "public"."lace_lab_dip"("costSheetId" ASC);

-- CreateIndex
CREATE INDEX "lace_lab_dip_greigeLaceId_idx" ON "public"."lace_lab_dip"("greigeLaceId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "lace_lab_dip_labDipNumber_key" ON "public"."lace_lab_dip"("labDipNumber" ASC);

-- CreateIndex
CREATE INDEX "lace_lab_dip_processorId_idx" ON "public"."lace_lab_dip"("processorId" ASC);

-- CreateIndex
CREATE INDEX "lace_lab_dip_status_idx" ON "public"."lace_lab_dip"("status" ASC);

-- CreateIndex
CREATE INDEX "lace_lab_dip_styleId_idx" ON "public"."lace_lab_dip"("styleId" ASC);

-- CreateIndex
CREATE INDEX "lace_master_isGreige_idx" ON "public"."lace_master"("isGreige" ASC);

-- CreateIndex
CREATE INDEX "lace_master_laceCode_idx" ON "public"."lace_master"("laceCode" ASC);

-- CreateIndex
CREATE INDEX "lace_master_sourceGreigeLaceId_idx" ON "public"."lace_master"("sourceGreigeLaceId" ASC);

-- CreateIndex
CREATE INDEX "lace_master_supplierId_idx" ON "public"."lace_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "lace_stock_dyeLotNumber_idx" ON "public"."lace_stock"("dyeLotNumber" ASC);

-- CreateIndex
CREATE INDEX "lace_stock_laceId_idx" ON "public"."lace_stock"("laceId" ASC);

-- CreateIndex
CREATE INDEX "lace_stock_originOrderId_idx" ON "public"."lace_stock"("originOrderId" ASC);

-- CreateIndex
CREATE INDEX "lace_stock_originStyleId_idx" ON "public"."lace_stock"("originStyleId" ASC);

-- CreateIndex
CREATE INDEX "lace_stock_processingBatchId_idx" ON "public"."lace_stock"("processingBatchId" ASC);

-- CreateIndex
CREATE INDEX "lace_stock_qualityGrade_idx" ON "public"."lace_stock"("qualityGrade" ASC);

-- CreateIndex
CREATE INDEX "lace_stock_status_idx" ON "public"."lace_stock"("status" ASC);

-- CreateIndex
CREATE INDEX "lace_stock_allocation_allocationStatus_idx" ON "public"."lace_stock_allocation"("allocationStatus" ASC);

-- CreateIndex
CREATE INDEX "lace_stock_allocation_orderId_idx" ON "public"."lace_stock_allocation"("orderId" ASC);

-- CreateIndex
CREATE INDEX "lace_stock_allocation_stockId_idx" ON "public"."lace_stock_allocation"("stockId" ASC);

-- CreateIndex
CREATE INDEX "lace_stock_allocation_styleId_idx" ON "public"."lace_stock_allocation"("styleId" ASC);

-- CreateIndex
CREATE INDEX "lace_stock_transaction_stockId_idx" ON "public"."lace_stock_transaction"("stockId" ASC);

-- CreateIndex
CREATE INDEX "lace_stock_transaction_transactionDate_idx" ON "public"."lace_stock_transaction"("transactionDate" ASC);

-- CreateIndex
CREATE INDEX "lace_stock_transaction_transactionType_idx" ON "public"."lace_stock_transaction"("transactionType" ASC);

-- CreateIndex
CREATE INDEX "lace_style_associations_laceId_idx" ON "public"."lace_style_associations"("laceId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "lace_style_associations_laceId_styleId_key" ON "public"."lace_style_associations"("laceId" ASC, "styleId" ASC);

-- CreateIndex
CREATE INDEX "lace_style_associations_styleId_idx" ON "public"."lace_style_associations"("styleId" ASC);

-- CreateIndex
CREATE INDEX "lace_suppliers_laceId_idx" ON "public"."lace_suppliers"("laceId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "lace_suppliers_laceId_supplierId_key" ON "public"."lace_suppliers"("laceId" ASC, "supplierId" ASC);

-- CreateIndex
CREATE INDEX "lace_suppliers_supplierId_idx" ON "public"."lace_suppliers"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "locations_locationCode_idx" ON "public"."locations"("locationCode" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "locations_locationCode_key" ON "public"."locations"("locationCode" ASC);

-- CreateIndex
CREATE INDEX "lookup_values_category_idx" ON "public"."lookup_values"("category" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "lookup_values_category_value_key" ON "public"."lookup_values"("category" ASC, "value" ASC);

-- CreateIndex
CREATE INDEX "lookup_values_isActive_idx" ON "public"."lookup_values"("isActive" ASC);

-- CreateIndex
CREATE INDEX "machine_part_master_partCode_idx" ON "public"."machine_part_master"("partCode" ASC);

-- CreateIndex
CREATE INDEX "machine_part_master_supplierId_idx" ON "public"."machine_part_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "machine_part_suppliers_machinePartId_idx" ON "public"."machine_part_suppliers"("machinePartId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "machine_part_suppliers_machinePartId_supplierId_key" ON "public"."machine_part_suppliers"("machinePartId" ASC, "supplierId" ASC);

-- CreateIndex
CREATE INDEX "machine_part_suppliers_supplierId_idx" ON "public"."machine_part_suppliers"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "material_categories_level_idx" ON "public"."material_categories"("level" ASC);

-- CreateIndex
CREATE INDEX "material_categories_parentCategoryId_idx" ON "public"."material_categories"("parentCategoryId" ASC);

-- CreateIndex
CREATE INDEX "material_master_code_idx" ON "public"."material_master"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "material_master_code_key" ON "public"."material_master"("code" ASC);

-- CreateIndex
CREATE INDEX "material_master_createdById_idx" ON "public"."material_master"("createdById" ASC);

-- CreateIndex
CREATE INDEX "material_master_isActive_idx" ON "public"."material_master"("isActive" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyBeadId_key" ON "public"."material_master"("legacyBeadId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyBeltId_key" ON "public"."material_master"("legacyBeltId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyBuckleId_key" ON "public"."material_master"("legacyBuckleId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyButtonId_key" ON "public"."material_master"("legacyButtonId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyDrawstringId_key" ON "public"."material_master"("legacyDrawstringId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyElasticId_key" ON "public"."material_master"("legacyElasticId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyHookEyeId_key" ON "public"."material_master"("legacyHookEyeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyInterliningId_key" ON "public"."material_master"("legacyInterliningId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyLabelId_key" ON "public"."material_master"("legacyLabelId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyLaceId_key" ON "public"."material_master"("legacyLaceId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyMachinePartId_key" ON "public"."material_master"("legacyMachinePartId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyMotifId_key" ON "public"."material_master"("legacyMotifId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyPackagingId_key" ON "public"."material_master"("legacyPackagingId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyPaddingId_key" ON "public"."material_master"("legacyPaddingId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyRibbonId_key" ON "public"."material_master"("legacyRibbonId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacySequinId_key" ON "public"."material_master"("legacySequinId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacySnapButtonId_key" ON "public"."material_master"("legacySnapButtonId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyThreadId_key" ON "public"."material_master"("legacyThreadId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyVelcroId_key" ON "public"."material_master"("legacyVelcroId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyZipperId_key" ON "public"."material_master"("legacyZipperId" ASC);

-- CreateIndex
CREATE INDEX "material_master_materialType_idx" ON "public"."material_master"("materialType" ASC);

-- CreateIndex
CREATE INDEX "material_requirements_linkedRequirementId_idx" ON "public"."material_requirements"("linkedRequirementId" ASC);

-- CreateIndex
CREATE INDEX "material_requirements_materialId_idx" ON "public"."material_requirements"("materialId" ASC);

-- CreateIndex
CREATE INDEX "material_requirements_orderId_idx" ON "public"."material_requirements"("orderId" ASC);

-- CreateIndex
CREATE INDEX "material_requirements_orderId_status_requiredDate_idx" ON "public"."material_requirements"("orderId" ASC, "status" ASC, "requiredDate" ASC);

-- CreateIndex
CREATE INDEX "material_requirements_orderItemId_idx" ON "public"."material_requirements"("orderItemId" ASC);

-- CreateIndex
CREATE INDEX "material_requirements_preferredSupplierId_status_idx" ON "public"."material_requirements"("preferredSupplierId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "material_requirements_processorId_idx" ON "public"."material_requirements"("processorId" ASC);

-- CreateIndex
CREATE INDEX "material_requirements_requiredDate_idx" ON "public"."material_requirements"("requiredDate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "material_requirements_requirementNumber_key" ON "public"."material_requirements"("requirementNumber" ASC);

-- CreateIndex
CREATE INDEX "material_requirements_requirementType_idx" ON "public"."material_requirements"("requirementType" ASC);

-- CreateIndex
CREATE INDEX "material_requirements_splitFromId_idx" ON "public"."material_requirements"("splitFromId" ASC);

-- CreateIndex
CREATE INDEX "material_requirements_status_idx" ON "public"."material_requirements"("status" ASC);

-- CreateIndex
CREATE INDEX "material_requirements_status_requiredDate_idx" ON "public"."material_requirements"("status" ASC, "requiredDate" ASC);

-- CreateIndex
CREATE INDEX "material_requisition_items_materialId_idx" ON "public"."material_requisition_items"("materialId" ASC);

-- CreateIndex
CREATE INDEX "material_requisition_items_requisitionId_idx" ON "public"."material_requisition_items"("requisitionId" ASC);

-- CreateIndex
CREATE INDEX "material_requisitions_issuedById_idx" ON "public"."material_requisitions"("issuedById" ASC);

-- CreateIndex
CREATE INDEX "material_requisitions_receivedById_idx" ON "public"."material_requisitions"("receivedById" ASC);

-- CreateIndex
CREATE INDEX "material_requisitions_requisitionNumber_idx" ON "public"."material_requisitions"("requisitionNumber" ASC);

-- CreateIndex
CREATE INDEX "material_requisitions_workOrderId_idx" ON "public"."material_requisitions"("workOrderId" ASC);

-- CreateIndex
CREATE INDEX "material_supplier_mapping_isActive_idx" ON "public"."material_supplier_mapping"("isActive" ASC);

-- CreateIndex
CREATE INDEX "material_supplier_mapping_isPrimary_idx" ON "public"."material_supplier_mapping"("isPrimary" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "material_supplier_mapping_materialId_supplierId_key" ON "public"."material_supplier_mapping"("materialId" ASC, "supplierId" ASC);

-- CreateIndex
CREATE INDEX "material_supplier_mapping_supplierId_idx" ON "public"."material_supplier_mapping"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "material_suppliers_materialId_idx" ON "public"."material_suppliers"("materialId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "material_suppliers_materialId_supplierId_key" ON "public"."material_suppliers"("materialId" ASC, "supplierId" ASC);

-- CreateIndex
CREATE INDEX "material_suppliers_supplierId_idx" ON "public"."material_suppliers"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "materials_buttonId_idx" ON "public"."materials"("buttonId" ASC);

-- CreateIndex
CREATE INDEX "materials_categoryId_idx" ON "public"."materials"("categoryId" ASC);

-- CreateIndex
CREATE INDEX "materials_code_idx" ON "public"."materials"("code" ASC);

-- CreateIndex
CREATE INDEX "materials_elasticId_idx" ON "public"."materials"("elasticId" ASC);

-- CreateIndex
CREATE INDEX "materials_fabricId_idx" ON "public"."materials"("fabricId" ASC);

-- CreateIndex
CREATE INDEX "materials_greigeId_idx" ON "public"."materials"("greigeId" ASC);

-- CreateIndex
CREATE INDEX "materials_isActive_idx" ON "public"."materials"("isActive" ASC);

-- CreateIndex
CREATE INDEX "materials_labelId_idx" ON "public"."materials"("labelId" ASC);

-- CreateIndex
CREATE INDEX "materials_laceId_idx" ON "public"."materials"("laceId" ASC);

-- CreateIndex
CREATE INDEX "materials_materialType_idx" ON "public"."materials"("materialType" ASC);

-- CreateIndex
CREATE INDEX "materials_name_idx" ON "public"."materials"("name" ASC);

-- CreateIndex
CREATE INDEX "materials_packagingId_idx" ON "public"."materials"("packagingId" ASC);

-- CreateIndex
CREATE INDEX "materials_sizeVariantId_idx" ON "public"."materials"("sizeVariantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "materials_sizeVariantId_key" ON "public"."materials"("sizeVariantId" ASC);

-- CreateIndex
CREATE INDEX "materials_threadId_idx" ON "public"."materials"("threadId" ASC);

-- CreateIndex
CREATE INDEX "materials_zipperId_idx" ON "public"."materials"("zipperId" ASC);

-- CreateIndex
CREATE INDEX "mood_board_items_mood_board_id_idx" ON "public"."mood_board_items"("mood_board_id" ASC);

-- CreateIndex
CREATE INDEX "mood_boards_created_by_id_idx" ON "public"."mood_boards"("created_by_id" ASC);

-- CreateIndex
CREATE INDEX "mood_boards_season_id_idx" ON "public"."mood_boards"("season_id" ASC);

-- CreateIndex
CREATE INDEX "mood_boards_status_idx" ON "public"."mood_boards"("status" ASC);

-- CreateIndex
CREATE INDEX "motif_master_motifCode_idx" ON "public"."motif_master"("motifCode" ASC);

-- CreateIndex
CREATE INDEX "motif_master_supplierId_idx" ON "public"."motif_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "public"."notifications"("isRead" ASC);

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "public"."notifications"("userId" ASC);

-- CreateIndex
CREATE INDEX "order_bom_orderId_idx" ON "public"."order_bom"("orderId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "order_bom_orderId_styleId_version_key" ON "public"."order_bom"("orderId" ASC, "styleId" ASC, "version" ASC);

-- CreateIndex
CREATE INDEX "order_bom_status_idx" ON "public"."order_bom"("status" ASC);

-- CreateIndex
CREATE INDEX "order_bom_styleId_idx" ON "public"."order_bom"("styleId" ASC);

-- CreateIndex
CREATE INDEX "order_bom_items_greigeId_idx" ON "public"."order_bom_items"("greigeId" ASC);

-- CreateIndex
CREATE INDEX "order_bom_items_materialType_idx" ON "public"."order_bom_items"("materialType" ASC);

-- CreateIndex
CREATE INDEX "order_bom_items_orderBomId_idx" ON "public"."order_bom_items"("orderBomId" ASC);

-- CreateIndex
CREATE INDEX "order_bom_items_processorId_idx" ON "public"."order_bom_items"("processorId" ASC);

-- CreateIndex
CREATE INDEX "order_inspections_inspectionType_idx" ON "public"."order_inspections"("inspectionType" ASC);

-- CreateIndex
CREATE INDEX "order_inspections_orderItemId_idx" ON "public"."order_inspections"("orderItemId" ASC);

-- CreateIndex
CREATE INDEX "order_inspections_status_idx" ON "public"."order_inspections"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "order_item_breakup_orderItemId_colorId_sizeId_key" ON "public"."order_item_breakup"("orderItemId" ASC, "colorId" ASC, "sizeId" ASC);

-- CreateIndex
CREATE INDEX "order_item_breakup_orderItemId_idx" ON "public"."order_item_breakup"("orderItemId" ASC);

-- CreateIndex
CREATE INDEX "order_item_costing_baseCostingId_idx" ON "public"."order_item_costing"("baseCostingId" ASC);

-- CreateIndex
CREATE INDEX "order_item_costing_orderItemId_idx" ON "public"."order_item_costing"("orderItemId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "order_item_costing_orderItemId_key" ON "public"."order_item_costing"("orderItemId" ASC);

-- CreateIndex
CREATE INDEX "order_item_costing_selectedCadId_idx" ON "public"."order_item_costing"("selectedCadId" ASC);

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "public"."order_items"("orderId" ASC);

-- CreateIndex
CREATE INDEX "order_items_orderId_status_idx" ON "public"."order_items"("orderId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "order_items_selectedCadId_idx" ON "public"."order_items"("selectedCadId" ASC);

-- CreateIndex
CREATE INDEX "order_items_styleId_idx" ON "public"."order_items"("styleId" ASC);

-- CreateIndex
CREATE INDEX "order_items_styleId_status_idx" ON "public"."order_items"("styleId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "order_label_override_orderItemId_idx" ON "public"."order_label_override"("orderItemId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "order_label_override_orderItemId_styleLabelConfigId_key" ON "public"."order_label_override"("orderItemId" ASC, "styleMaterialBomId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "order_label_override_orderItemId_styleMaterialBomId_key" ON "public"."order_label_override"("orderItemId" ASC, "styleMaterialBomId" ASC);

-- CreateIndex
CREATE INDEX "order_label_override_styleMaterialBomId_idx" ON "public"."order_label_override"("styleMaterialBomId" ASC);

-- CreateIndex
CREATE INDEX "order_label_size_override_orderLabelOverrideId_idx" ON "public"."order_label_size_override"("orderLabelOverrideId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "order_label_size_override_orderLabelOverrideId_size_key" ON "public"."order_label_size_override"("orderLabelOverrideId" ASC, "size" ASC);

-- CreateIndex
CREATE INDEX "order_samples_orderItemId_idx" ON "public"."order_samples"("orderItemId" ASC);

-- CreateIndex
CREATE INDEX "order_samples_sampleType_idx" ON "public"."order_samples"("sampleType" ASC);

-- CreateIndex
CREATE INDEX "order_samples_status_idx" ON "public"."order_samples"("status" ASC);

-- CreateIndex
CREATE INDEX "order_thread_requirements_orderId_idx" ON "public"."order_thread_requirements"("orderId" ASC);

-- CreateIndex
CREATE INDEX "order_thread_requirements_threadId_idx" ON "public"."order_thread_requirements"("threadId" ASC);

-- CreateIndex
CREATE INDEX "orders_customerId_idx" ON "public"."orders"("customerId" ASC);

-- CreateIndex
CREATE INDEX "orders_customerId_status_idx" ON "public"."orders"("customerId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "orders_orderNumber_idx" ON "public"."orders"("orderNumber" ASC);

-- CreateIndex
CREATE INDEX "orders_status_createdAt_idx" ON "public"."orders"("status" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "public"."orders"("status" ASC);

-- CreateIndex
CREATE INDEX "other_decorative_master_otherDecorativeCode_idx" ON "public"."other_decorative_master"("otherDecorativeCode" ASC);

-- CreateIndex
CREATE INDEX "other_decorative_master_supplierId_idx" ON "public"."other_decorative_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "other_fastener_master_otherFastenerCode_idx" ON "public"."other_fastener_master"("otherFastenerCode" ASC);

-- CreateIndex
CREATE INDEX "other_fastener_master_supplierId_idx" ON "public"."other_fastener_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "other_functional_master_otherFunctionalCode_idx" ON "public"."other_functional_master"("otherFunctionalCode" ASC);

-- CreateIndex
CREATE INDEX "other_functional_master_supplierId_idx" ON "public"."other_functional_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "other_material_master_materialCode_idx" ON "public"."other_material_master"("materialCode" ASC);

-- CreateIndex
CREATE INDEX "other_material_master_supplierId_idx" ON "public"."other_material_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "other_material_suppliers_otherMaterialId_idx" ON "public"."other_material_suppliers"("otherMaterialId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "other_material_suppliers_otherMaterialId_supplierId_key" ON "public"."other_material_suppliers"("otherMaterialId" ASC, "supplierId" ASC);

-- CreateIndex
CREATE INDEX "other_material_suppliers_supplierId_idx" ON "public"."other_material_suppliers"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "other_tape_master_otherTapeCode_idx" ON "public"."other_tape_master"("otherTapeCode" ASC);

-- CreateIndex
CREATE INDEX "other_tape_master_supplierId_idx" ON "public"."other_tape_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "packaging_master_brandCategoryId_idx" ON "public"."packaging_master"("brandCategoryId" ASC);

-- CreateIndex
CREATE INDEX "packaging_master_customerId_idx" ON "public"."packaging_master"("customerId" ASC);

-- CreateIndex
CREATE INDEX "packaging_master_packagingCode_idx" ON "public"."packaging_master"("packagingCode" ASC);

-- CreateIndex
CREATE INDEX "packaging_master_supplierId_idx" ON "public"."packaging_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "packaging_suppliers_packagingId_idx" ON "public"."packaging_suppliers"("packagingId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "packaging_suppliers_packagingId_supplierId_key" ON "public"."packaging_suppliers"("packagingId" ASC, "supplierId" ASC);

-- CreateIndex
CREATE INDEX "packaging_suppliers_supplierId_idx" ON "public"."packaging_suppliers"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "padding_master_paddingCode_idx" ON "public"."padding_master"("paddingCode" ASC);

-- CreateIndex
CREATE INDEX "padding_master_supplierId_idx" ON "public"."padding_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "pattern_part_groups_component_group_id_idx" ON "public"."pattern_part_groups"("component_group_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "pattern_part_groups_pattern_part_id_component_group_id_key" ON "public"."pattern_part_groups"("pattern_part_id" ASC, "component_group_id" ASC);

-- CreateIndex
CREATE INDEX "pattern_part_groups_pattern_part_id_idx" ON "public"."pattern_part_groups"("pattern_part_id" ASC);

-- CreateIndex
CREATE INDEX "pattern_part_master_isActive_idx" ON "public"."pattern_part_master"("isActive" ASC);

-- CreateIndex
CREATE INDEX "pattern_part_master_sortOrder_idx" ON "public"."pattern_part_master"("sortOrder" ASC);

-- CreateIndex
CREATE INDEX "payment_terms_termCode_idx" ON "public"."payment_terms"("termCode" ASC);

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "public"."payments"("invoiceId" ASC);

-- CreateIndex
CREATE INDEX "payments_paymentDate_idx" ON "public"."payments"("paymentDate" ASC);

-- CreateIndex
CREATE INDEX "permission_definitions_isActive_idx" ON "public"."permission_definitions"("isActive" ASC);

-- CreateIndex
CREATE INDEX "permission_definitions_moduleGroup_idx" ON "public"."permission_definitions"("moduleGroup" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "permission_definitions_permissionKey_key" ON "public"."permission_definitions"("permissionKey" ASC);

-- CreateIndex
CREATE INDEX "po_source_links_costSheetGenerationId_idx" ON "public"."po_source_links"("costSheetGenerationId" ASC);

-- CreateIndex
CREATE INDEX "po_source_links_materialRequirementId_idx" ON "public"."po_source_links"("materialRequirementId" ASC);

-- CreateIndex
CREATE INDEX "po_source_links_productionRunId_idx" ON "public"."po_source_links"("productionRunId" ASC);

-- CreateIndex
CREATE INDEX "po_source_links_purchaseOrderId_idx" ON "public"."po_source_links"("purchaseOrderId" ASC);

-- CreateIndex
CREATE INDEX "po_source_links_purchaseOrderItemId_idx" ON "public"."po_source_links"("purchaseOrderItemId" ASC);

-- CreateIndex
CREATE INDEX "po_source_links_serviceRequirementId_idx" ON "public"."po_source_links"("serviceRequirementId" ASC);

-- CreateIndex
CREATE INDEX "po_source_links_sourceType_idx" ON "public"."po_source_links"("sourceType" ASC);

-- CreateIndex
CREATE INDEX "polybag_entries_finishingIssueId_idx" ON "public"."polybag_entries"("finishingIssueId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "polybag_skus_polybagEntryId_colorId_sizeId_key" ON "public"."polybag_skus"("polybagEntryId" ASC, "colorId" ASC, "sizeId" ASC);

-- CreateIndex
CREATE INDEX "polybag_skus_polybagEntryId_idx" ON "public"."polybag_skus"("polybagEntryId" ASC);

-- CreateIndex
CREATE INDEX "processing_batch_batchNumber_idx" ON "public"."processing_batch"("batchNumber" ASC);

-- CreateIndex
CREATE INDEX "processing_batch_createdById_idx" ON "public"."processing_batch"("createdById" ASC);

-- CreateIndex
CREATE INDEX "processing_batch_fabricId_idx" ON "public"."processing_batch"("fabricId" ASC);

-- CreateIndex
CREATE INDEX "processing_batch_greigeId_idx" ON "public"."processing_batch"("greigeId" ASC);

-- CreateIndex
CREATE INDEX "processing_batch_laceId_idx" ON "public"."processing_batch"("laceId" ASC);

-- CreateIndex
CREATE INDEX "processing_batch_overallStatus_idx" ON "public"."processing_batch"("overallStatus" ASC);

-- CreateIndex
CREATE INDEX "processing_batch_workOrderId_idx" ON "public"."processing_batch"("workOrderId" ASC);

-- CreateIndex
CREATE INDEX "processing_delivery_batchId_idx" ON "public"."processing_delivery"("batchId" ASC);

-- CreateIndex
CREATE INDEX "processing_delivery_challanId_idx" ON "public"."processing_delivery"("challanId" ASC);

-- CreateIndex
CREATE INDEX "processing_delivery_deliveryNumber_idx" ON "public"."processing_delivery"("deliveryNumber" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "processing_delivery_deliveryNumber_key" ON "public"."processing_delivery"("deliveryNumber" ASC);

-- CreateIndex
CREATE INDEX "processing_delivery_qualityStatus_idx" ON "public"."processing_delivery"("qualityStatus" ASC);

-- CreateIndex
CREATE INDEX "processing_delivery_receivedById_idx" ON "public"."processing_delivery"("receivedById" ASC);

-- CreateIndex
CREATE INDEX "processing_delivery_stageId_idx" ON "public"."processing_delivery"("stageId" ASC);

-- CreateIndex
CREATE INDEX "processing_movement_batchId_idx" ON "public"."processing_movement"("batchId" ASC);

-- CreateIndex
CREATE INDEX "processing_movement_challanId_idx" ON "public"."processing_movement"("challanId" ASC);

-- CreateIndex
CREATE INDEX "processing_movement_performedById_idx" ON "public"."processing_movement"("performedById" ASC);

-- CreateIndex
CREATE INDEX "processing_movement_stageId_idx" ON "public"."processing_movement"("stageId" ASC);

-- CreateIndex
CREATE INDEX "processing_movement_status_idx" ON "public"."processing_movement"("status" ASC);

-- CreateIndex
CREATE INDEX "processing_stage_batchId_stageNumber_idx" ON "public"."processing_stage"("batchId" ASC, "stageNumber" ASC);

-- CreateIndex
CREATE INDEX "processing_stage_processorId_status_idx" ON "public"."processing_stage"("processorId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "processing_stage_status_idx" ON "public"."processing_stage"("status" ASC);

-- CreateIndex
CREATE INDEX "processor_quantity_slabs_isActive_idx" ON "public"."processor_quantity_slabs"("isActive" ASC);

-- CreateIndex
CREATE INDEX "processor_quantity_slabs_processorId_processingType_idx" ON "public"."processor_quantity_slabs"("processorId" ASC, "processingType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "processor_quantity_slabs_processorId_processingType_slabOrd_key" ON "public"."processor_quantity_slabs"("processorId" ASC, "processingType" ASC, "slabOrder" ASC);

-- CreateIndex
CREATE INDEX "processor_rate_card_greigeId_idx" ON "public"."processor_rate_card"("greigeId" ASC);

-- CreateIndex
CREATE INDEX "processor_rate_card_isActive_idx" ON "public"."processor_rate_card"("isActive" ASC);

-- CreateIndex
CREATE INDEX "processor_rate_card_laceId_idx" ON "public"."processor_rate_card"("laceId" ASC);

-- CreateIndex
CREATE INDEX "processor_rate_card_processorId_processingType_idx" ON "public"."processor_rate_card"("processorId" ASC, "processingType" ASC);

-- CreateIndex
CREATE INDEX "processor_rate_card_processorId_processingType_printingType_idx" ON "public"."processor_rate_card"("processorId" ASC, "processingType" ASC, "printingType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "processor_rate_card_processorId_processingType_printingType_key" ON "public"."processor_rate_card"("processorId" ASC, "processingType" ASC, "printingType" ASC, "greigeId" ASC, "laceId" ASC, "slabId" ASC);

-- CreateIndex
CREATE INDEX "processor_rate_card_slabId_idx" ON "public"."processor_rate_card"("slabId" ASC);

-- CreateIndex
CREATE INDEX "product_category_master_is_active_idx" ON "public"."product_category_master"("is_active" ASC);

-- CreateIndex
CREATE INDEX "product_category_master_level_idx" ON "public"."product_category_master"("level" ASC);

-- CreateIndex
CREATE INDEX "product_category_master_parent_id_idx" ON "public"."product_category_master"("parent_id" ASC);

-- CreateIndex
CREATE INDEX "production_plans_approvedById_idx" ON "public"."production_plans"("approvedById" ASC);

-- CreateIndex
CREATE INDEX "production_plans_createdById_idx" ON "public"."production_plans"("createdById" ASC);

-- CreateIndex
CREATE INDEX "production_plans_planNumber_idx" ON "public"."production_plans"("planNumber" ASC);

-- CreateIndex
CREATE INDEX "production_tracking_productionStage_idx" ON "public"."production_tracking"("productionStage" ASC);

-- CreateIndex
CREATE INDEX "production_tracking_updateDate_idx" ON "public"."production_tracking"("updateDate" ASC);

-- CreateIndex
CREATE INDEX "production_tracking_workOrderId_idx" ON "public"."production_tracking"("workOrderId" ASC);

-- CreateIndex
CREATE INDEX "purchase_order_items_materialId_idx" ON "public"."purchase_order_items"("materialId" ASC);

-- CreateIndex
CREATE INDEX "purchase_order_items_poId_idx" ON "public"."purchase_order_items"("poId" ASC);

-- CreateIndex
CREATE INDEX "purchase_order_items_serviceType_idx" ON "public"."purchase_order_items"("serviceType" ASC);

-- CreateIndex
CREATE INDEX "purchase_orders_costSheetGenerationId_idx" ON "public"."purchase_orders"("costSheetGenerationId" ASC);

-- CreateIndex
CREATE INDEX "purchase_orders_expectedDeliveryDate_idx" ON "public"."purchase_orders"("expectedDeliveryDate" ASC);

-- CreateIndex
CREATE INDEX "purchase_orders_linkedGreigePOId_idx" ON "public"."purchase_orders"("linkedGreigePOId" ASC);

-- CreateIndex
CREATE INDEX "purchase_orders_mrpBatchId_idx" ON "public"."purchase_orders"("mrpBatchId" ASC);

-- CreateIndex
CREATE INDEX "purchase_orders_poCategory_idx" ON "public"."purchase_orders"("poCategory" ASC);

-- CreateIndex
CREATE INDEX "purchase_orders_poNumber_idx" ON "public"."purchase_orders"("poNumber" ASC);

-- CreateIndex
CREATE INDEX "purchase_orders_poSource_idx" ON "public"."purchase_orders"("poSource" ASC);

-- CreateIndex
CREATE INDEX "purchase_orders_serviceWorkOrderId_idx" ON "public"."purchase_orders"("serviceWorkOrderId" ASC);

-- CreateIndex
CREATE INDEX "purchase_orders_status_createdAt_idx" ON "public"."purchase_orders"("status" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "purchase_orders_supplierId_idx" ON "public"."purchase_orders"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "purchase_orders_supplierId_status_idx" ON "public"."purchase_orders"("supplierId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "quality_defects_inspectionId_idx" ON "public"."quality_defects"("inspectionId" ASC);

-- CreateIndex
CREATE INDEX "quality_inspection_fabricId_idx" ON "public"."quality_inspection"("fabricId" ASC);

-- CreateIndex
CREATE INDEX "quality_inspection_inspectionDate_idx" ON "public"."quality_inspection"("inspectionDate" ASC);

-- CreateIndex
CREATE INDEX "quality_inspection_inspectionType_idx" ON "public"."quality_inspection"("inspectionType" ASC);

-- CreateIndex
CREATE INDEX "quality_inspection_inspectorId_idx" ON "public"."quality_inspection"("inspectorId" ASC);

-- CreateIndex
CREATE INDEX "quality_inspection_qualityGrade_idx" ON "public"."quality_inspection"("qualityGrade" ASC);

-- CreateIndex
CREATE INDEX "quality_inspections_inspectionNumber_idx" ON "public"."quality_inspections"("inspectionNumber" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "quality_inspections_inspectionNumber_key" ON "public"."quality_inspections"("inspectionNumber" ASC);

-- CreateIndex
CREATE INDEX "quality_inspections_workOrderId_idx" ON "public"."quality_inspections"("workOrderId" ASC);

-- CreateIndex
CREATE INDEX "quality_inspections_mfg_inspectionDate_idx" ON "public"."quality_inspections_mfg"("inspectionDate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "quality_inspections_mfg_inspectionNumber_key" ON "public"."quality_inspections_mfg"("inspectionNumber" ASC);

-- CreateIndex
CREATE INDEX "quality_inspections_mfg_inspectionType_idx" ON "public"."quality_inspections_mfg"("inspectionType" ASC);

-- CreateIndex
CREATE INDEX "quality_inspections_mfg_workOrderId_idx" ON "public"."quality_inspections_mfg"("workOrderId" ASC);

-- CreateIndex
CREATE INDEX "quotation_items_quotationId_idx" ON "public"."quotation_items"("quotationId" ASC);

-- CreateIndex
CREATE INDEX "quotation_items_styleId_idx" ON "public"."quotation_items"("styleId" ASC);

-- CreateIndex
CREATE INDEX "quotations_customerId_idx" ON "public"."quotations"("customerId" ASC);

-- CreateIndex
CREATE INDEX "quotations_placeOfSupplyId_idx" ON "public"."quotations"("placeOfSupplyId" ASC);

-- CreateIndex
CREATE INDEX "quotations_quotationNumber_idx" ON "public"."quotations"("quotationNumber" ASC);

-- CreateIndex
CREATE INDEX "requirement_po_links_purchaseOrderId_idx" ON "public"."requirement_po_links"("purchaseOrderId" ASC);

-- CreateIndex
CREATE INDEX "requirement_po_links_requirementId_idx" ON "public"."requirement_po_links"("requirementId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "requirement_po_links_requirementId_purchaseOrderItemId_key" ON "public"."requirement_po_links"("requirementId" ASC, "purchaseOrderItemId" ASC);

-- CreateIndex
CREATE INDEX "ribbon_master_ribbonCode_idx" ON "public"."ribbon_master"("ribbonCode" ASC);

-- CreateIndex
CREATE INDEX "ribbon_master_supplierId_idx" ON "public"."ribbon_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "role_permissions_permissionKey_idx" ON "public"."role_permissions"("permissionKey" ASC);

-- CreateIndex
CREATE INDEX "role_permissions_role_idx" ON "public"."role_permissions"("role" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_permissionKey_key" ON "public"."role_permissions"("role" ASC, "permissionKey" ASC);

-- CreateIndex
CREATE INDEX "sample_colorways_sampleId_idx" ON "public"."sample_colorways"("sampleId" ASC);

-- CreateIndex
CREATE INDEX "sample_measurements_sampleId_idx" ON "public"."sample_measurements"("sampleId" ASC);

-- CreateIndex
CREATE INDEX "sample_size_sets_sampleId_idx" ON "public"."sample_size_sets"("sampleId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "sample_size_sets_sampleId_sizeId_colorId_key" ON "public"."sample_size_sets"("sampleId" ASC, "sizeId" ASC, "colorId" ASC);

-- CreateIndex
CREATE INDEX "samples_customerId_idx" ON "public"."samples"("customerId" ASC);

-- CreateIndex
CREATE INDEX "samples_sampleNumber_idx" ON "public"."samples"("sampleNumber" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "season_master_code_key" ON "public"."season_master"("code" ASC);

-- CreateIndex
CREATE INDEX "season_master_isActive_idx" ON "public"."season_master"("isActive" ASC);

-- CreateIndex
CREATE INDEX "season_master_sortOrder_idx" ON "public"."season_master"("sortOrder" ASC);

-- CreateIndex
CREATE INDEX "season_master_year_seasonType_idx" ON "public"."season_master"("year" ASC, "seasonType" ASC);

-- CreateIndex
CREATE INDEX "sequin_master_sequinCode_idx" ON "public"."sequin_master"("sequinCode" ASC);

-- CreateIndex
CREATE INDEX "sequin_master_supplierId_idx" ON "public"."sequin_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "service_requirement_po_links_purchaseOrderItemId_idx" ON "public"."service_requirement_po_links"("purchaseOrderItemId" ASC);

-- CreateIndex
CREATE INDEX "service_requirement_po_links_serviceRequirementId_idx" ON "public"."service_requirement_po_links"("serviceRequirementId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "service_requirement_po_links_serviceRequirementId_purchaseO_key" ON "public"."service_requirement_po_links"("serviceRequirementId" ASC, "purchaseOrderItemId" ASC);

-- CreateIndex
CREATE INDEX "size_categories_name_idx" ON "public"."size_categories"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "size_categories_name_key" ON "public"."size_categories"("name" ASC);

-- CreateIndex
CREATE INDEX "size_options_styleId_idx" ON "public"."size_options"("styleId" ASC);

-- CreateIndex
CREATE INDEX "snap_button_master_snapButtonCode_idx" ON "public"."snap_button_master"("snapButtonCode" ASC);

-- CreateIndex
CREATE INDEX "snap_button_master_supplierId_idx" ON "public"."snap_button_master"("supplierId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "stage_receipt_skus_stageReceiptId_colorId_sizeId_key" ON "public"."stage_receipt_skus"("stageReceiptId" ASC, "colorId" ASC, "sizeId" ASC);

-- CreateIndex
CREATE INDEX "stage_receipt_skus_stageReceiptId_idx" ON "public"."stage_receipt_skus"("stageReceiptId" ASC);

-- CreateIndex
CREATE INDEX "stage_receipts_transferSlipId_idx" ON "public"."stage_receipts"("transferSlipId" ASC);

-- CreateIndex
CREATE INDEX "stage_receipts_workOrderId_stage_idx" ON "public"."stage_receipts"("workOrderId" ASC, "stage" ASC);

-- CreateIndex
CREATE INDEX "stage_transition_overrides_blockType_idx" ON "public"."stage_transition_overrides"("blockType" ASC);

-- CreateIndex
CREATE INDEX "stage_transition_overrides_orderItemId_idx" ON "public"."stage_transition_overrides"("orderItemId" ASC);

-- CreateIndex
CREATE INDEX "stage_transition_overrides_overriddenAt_idx" ON "public"."stage_transition_overrides"("overriddenAt" ASC);

-- CreateIndex
CREATE INDEX "stage_transition_overrides_overriddenById_idx" ON "public"."stage_transition_overrides"("overriddenById" ASC);

-- CreateIndex
CREATE INDEX "stage_transition_overrides_sampleId_idx" ON "public"."stage_transition_overrides"("sampleId" ASC);

-- CreateIndex
CREATE INDEX "stage_transition_overrides_workOrderId_idx" ON "public"."stage_transition_overrides"("workOrderId" ASC);

-- CreateIndex
CREATE INDEX "stitching_daily_outputs_outputDate_idx" ON "public"."stitching_daily_outputs"("outputDate" ASC);

-- CreateIndex
CREATE INDEX "stitching_daily_outputs_stitchingIssueId_idx" ON "public"."stitching_daily_outputs"("stitchingIssueId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "stitching_issue_components_stitchingIssueId_componentId_key" ON "public"."stitching_issue_components"("stitchingIssueId" ASC, "componentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "stitching_issue_skus_stitchingIssueId_colorId_sizeId_key" ON "public"."stitching_issue_skus"("stitchingIssueId" ASC, "colorId" ASC, "sizeId" ASC);

-- CreateIndex
CREATE INDEX "stitching_issue_skus_stitchingIssueId_idx" ON "public"."stitching_issue_skus"("stitchingIssueId" ASC);

-- CreateIndex
CREATE INDEX "stitching_issues_managerId_idx" ON "public"."stitching_issues"("managerId" ASC);

-- CreateIndex
CREATE INDEX "stitching_issues_status_idx" ON "public"."stitching_issues"("status" ASC);

-- CreateIndex
CREATE INDEX "stitching_issues_workOrderId_idx" ON "public"."stitching_issues"("workOrderId" ASC);

-- CreateIndex
CREATE INDEX "stitching_issues_workOrderId_status_idx" ON "public"."stitching_issues"("workOrderId" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "stitching_output_skus_dailyOutputId_colorId_sizeId_key" ON "public"."stitching_output_skus"("dailyOutputId" ASC, "colorId" ASC, "sizeId" ASC);

-- CreateIndex
CREATE INDEX "stitching_output_skus_dailyOutputId_idx" ON "public"."stitching_output_skus"("dailyOutputId" ASC);

-- CreateIndex
CREATE INDEX "stock_count_items_materialId_idx" ON "public"."stock_count_items"("materialId" ASC);

-- CreateIndex
CREATE INDEX "stock_count_items_stockCountId_idx" ON "public"."stock_count_items"("stockCountId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "stock_count_items_stockCountId_materialId_key" ON "public"."stock_count_items"("stockCountId" ASC, "materialId" ASC);

-- CreateIndex
CREATE INDEX "stock_counts_countDate_idx" ON "public"."stock_counts"("countDate" ASC);

-- CreateIndex
CREATE INDEX "stock_counts_countNumber_idx" ON "public"."stock_counts"("countNumber" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "stock_counts_countNumber_key" ON "public"."stock_counts"("countNumber" ASC);

-- CreateIndex
CREATE INDEX "stock_counts_status_idx" ON "public"."stock_counts"("status" ASC);

-- CreateIndex
CREATE INDEX "stock_counts_warehouseId_idx" ON "public"."stock_counts"("warehouseId" ASC);

-- CreateIndex
CREATE INDEX "stock_levels_materialId_idx" ON "public"."stock_levels"("materialId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "stock_levels_materialId_warehouseId_key" ON "public"."stock_levels"("materialId" ASC, "warehouseId" ASC);

-- CreateIndex
CREATE INDEX "stock_levels_quantity_idx" ON "public"."stock_levels"("quantity" ASC);

-- CreateIndex
CREATE INDEX "stock_levels_warehouseId_idx" ON "public"."stock_levels"("warehouseId" ASC);

-- CreateIndex
CREATE INDEX "stock_movements_materialId_idx" ON "public"."stock_movements"("materialId" ASC);

-- CreateIndex
CREATE INDEX "stock_movements_movementDate_idx" ON "public"."stock_movements"("movementDate" ASC);

-- CreateIndex
CREATE INDEX "stock_movements_movementType_idx" ON "public"."stock_movements"("movementType" ASC);

-- CreateIndex
CREATE INDEX "stock_movements_referenceType_referenceId_idx" ON "public"."stock_movements"("referenceType" ASC, "referenceId" ASC);

-- CreateIndex
CREATE INDEX "stock_movements_warehouseId_idx" ON "public"."stock_movements"("warehouseId" ASC);

-- CreateIndex
CREATE INDEX "stock_reservations_materialId_idx" ON "public"."stock_reservations"("materialId" ASC);

-- CreateIndex
CREATE INDEX "stock_reservations_referenceType_referenceId_idx" ON "public"."stock_reservations"("referenceType" ASC, "referenceId" ASC);

-- CreateIndex
CREATE INDEX "stock_reservations_status_idx" ON "public"."stock_reservations"("status" ASC);

-- CreateIndex
CREATE INDEX "stock_reservations_warehouseId_idx" ON "public"."stock_reservations"("warehouseId" ASC);

-- CreateIndex
CREATE INDEX "stock_transactions_materialId_idx" ON "public"."stock_transactions"("materialId" ASC);

-- CreateIndex
CREATE INDEX "stock_transactions_transactionDate_idx" ON "public"."stock_transactions"("transactionDate" ASC);

-- CreateIndex
CREATE INDEX "stock_transactions_transactionType_idx" ON "public"."stock_transactions"("transactionType" ASC);

-- CreateIndex
CREATE INDEX "stock_transactions_warehouseId_idx" ON "public"."stock_transactions"("warehouseId" ASC);

-- CreateIndex
CREATE INDEX "style_accessories_componentId_idx" ON "public"."style_accessories"("componentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "style_categories_name_key" ON "public"."style_categories"("name" ASC);

-- CreateIndex
CREATE INDEX "style_comments_parent_id_idx" ON "public"."style_comments"("parent_id" ASC);

-- CreateIndex
CREATE INDEX "style_comments_style_id_idx" ON "public"."style_comments"("style_id" ASC);

-- CreateIndex
CREATE INDEX "style_comments_user_id_idx" ON "public"."style_comments"("user_id" ASC);

-- CreateIndex
CREATE INDEX "style_components_component_master_id_idx" ON "public"."style_components"("component_master_id" ASC);

-- CreateIndex
CREATE INDEX "style_components_styleId_idx" ON "public"."style_components"("styleId" ASC);

-- CreateIndex
CREATE INDEX "style_costing_approvalStatus_idx" ON "public"."style_costing"("approvalStatus" ASC);

-- CreateIndex
CREATE INDEX "style_costing_copied_from_costing_id_idx" ON "public"."style_costing"("copied_from_costing_id" ASC);

-- CreateIndex
CREATE INDEX "style_costing_lockedForOrders_idx" ON "public"."style_costing"("lockedForOrders" ASC);

-- CreateIndex
CREATE INDEX "style_costing_orderId_idx" ON "public"."style_costing"("orderId" ASC);

-- CreateIndex
CREATE INDEX "style_costing_orderItemId_idx" ON "public"."style_costing"("orderItemId" ASC);

-- CreateIndex
CREATE INDEX "style_costing_purpose_idx" ON "public"."style_costing"("purpose" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "style_costing_styleId_purpose_version_key" ON "public"."style_costing"("styleId" ASC, "purpose" ASC, "version" ASC);

-- CreateIndex
CREATE INDEX "style_costing_styleId_version_idx" ON "public"."style_costing"("styleId" ASC, "version" ASC);

-- CreateIndex
CREATE INDEX "style_costing_supersededById_idx" ON "public"."style_costing"("supersededById" ASC);

-- CreateIndex
CREATE INDEX "style_costing_variance_status_idx" ON "public"."style_costing"("variance_status" ASC);

-- CreateIndex
CREATE INDEX "style_costing_width_combination_hash_idx" ON "public"."style_costing"("width_combination_hash" ASC);

-- CreateIndex
CREATE INDEX "style_costing_fabric_items_costingId_idx" ON "public"."style_costing_fabric_items"("costingId" ASC);

-- CreateIndex
CREATE INDEX "style_costing_fabric_items_fabricCADId_idx" ON "public"."style_costing_fabric_items"("fabricCADId" ASC);

-- CreateIndex
CREATE INDEX "style_costing_fabric_items_fabricId_idx" ON "public"."style_costing_fabric_items"("fabricId" ASC);

-- CreateIndex
CREATE INDEX "style_costing_fabric_items_processorId_rateCardId_stockLotI_idx" ON "public"."style_costing_fabric_items"("processorId" ASC, "rateCardId" ASC, "stockLotId" ASC, "sourcingStrategy" ASC);

-- CreateIndex
CREATE INDEX "style_costing_fabric_items_sourcingStrategy_idx" ON "public"."style_costing_fabric_items"("sourcingStrategy" ASC);

-- CreateIndex
CREATE INDEX "style_costing_lace_items_costingId_idx" ON "public"."style_costing_lace_items"("costingId" ASC);

-- CreateIndex
CREATE INDEX "style_costing_lace_items_greigeLaceId_idx" ON "public"."style_costing_lace_items"("greigeLaceId" ASC);

-- CreateIndex
CREATE INDEX "style_costing_lace_items_labDipId_idx" ON "public"."style_costing_lace_items"("labDipId" ASC);

-- CreateIndex
CREATE INDEX "style_costing_lace_items_laceId_idx" ON "public"."style_costing_lace_items"("laceId" ASC);

-- CreateIndex
CREATE INDEX "style_costing_lace_items_processorId_rateCardId_stockLotId__idx" ON "public"."style_costing_lace_items"("processorId" ASC, "rateCardId" ASC, "stockLotId" ASC, "sourcingStrategy" ASC);

-- CreateIndex
CREATE INDEX "style_costing_lace_items_sourcingStrategy_idx" ON "public"."style_costing_lace_items"("sourcingStrategy" ASC);

-- CreateIndex
CREATE INDEX "style_costing_thread_items_costingId_idx" ON "public"."style_costing_thread_items"("costingId" ASC);

-- CreateIndex
CREATE INDEX "style_costing_thread_items_threadId_idx" ON "public"."style_costing_thread_items"("threadId" ASC);

-- CreateIndex
CREATE INDEX "style_fabrics_cadGroupKey_idx" ON "public"."style_fabrics"("cadGroupKey" ASC);

-- CreateIndex
CREATE INDEX "style_fabrics_componentId_idx" ON "public"."style_fabrics"("componentId" ASC);

-- CreateIndex
CREATE INDEX "style_fabrics_embroideryId_idx" ON "public"."style_fabrics"("embroideryId" ASC);

-- CreateIndex
CREATE INDEX "style_fabrics_fabricCADId_idx" ON "public"."style_fabrics"("fabricCADId" ASC);

-- CreateIndex
CREATE INDEX "style_fabrics_fabricId_idx" ON "public"."style_fabrics"("fabricId" ASC);

-- CreateIndex
CREATE INDEX "style_fabrics_selectedGreigeId_idx" ON "public"."style_fabrics"("selectedGreigeId" ASC);

-- CreateIndex
CREATE INDEX "style_images_style_id_idx" ON "public"."style_images"("style_id" ASC);

-- CreateIndex
CREATE INDEX "style_import_staging_importBatchId_idx" ON "public"."style_import_staging"("importBatchId" ASC);

-- CreateIndex
CREATE INDEX "style_import_staging_status_idx" ON "public"."style_import_staging"("status" ASC);

-- CreateIndex
CREATE INDEX "style_import_staging_styleCode_idx" ON "public"."style_import_staging"("styleCode" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "style_label_size_config_styleLabelConfigId_size_key" ON "public"."style_label_size_config"("styleMaterialBomId" ASC, "size" ASC);

-- CreateIndex
CREATE INDEX "style_label_size_config_styleMaterialBomId_idx" ON "public"."style_label_size_config"("styleMaterialBomId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "style_label_size_config_styleMaterialBomId_size_key" ON "public"."style_label_size_config"("styleMaterialBomId" ASC, "size" ASC);

-- CreateIndex
CREATE INDEX "style_material_bom_materialId_idx" ON "public"."style_material_bom"("materialId" ASC);

-- CreateIndex
CREATE INDEX "style_material_bom_materialType_idx" ON "public"."style_material_bom"("materialType" ASC);

-- CreateIndex
CREATE INDEX "style_material_bom_styleId_idx" ON "public"."style_material_bom"("styleId" ASC);

-- CreateIndex
CREATE INDEX "style_material_bom_usageCategory_idx" ON "public"."style_material_bom"("usageCategory" ASC);

-- CreateIndex
CREATE INDEX "style_packaging_styleId_idx" ON "public"."style_packaging"("styleId" ASC);

-- CreateIndex
CREATE INDEX "style_pattern_parts_pattern_part_id_idx" ON "public"."style_pattern_parts"("pattern_part_id" ASC);

-- CreateIndex
CREATE INDEX "style_pattern_parts_style_fabric_id_idx" ON "public"."style_pattern_parts"("style_fabric_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "style_pattern_parts_style_fabric_id_pattern_part_id_key" ON "public"."style_pattern_parts"("style_fabric_id" ASC, "pattern_part_id" ASC);

-- CreateIndex
CREATE INDEX "style_processes_styleId_idx" ON "public"."style_processes"("styleId" ASC);

-- CreateIndex
CREATE INDEX "style_processes_supplierId_idx" ON "public"."style_processes"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "style_production_tracking_currentStage_idx" ON "public"."style_production_tracking"("currentStage" ASC);

-- CreateIndex
CREATE INDEX "style_production_tracking_styleId_idx" ON "public"."style_production_tracking"("styleId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "style_tech_specs_style_id_key" ON "public"."style_tech_specs"("style_id" ASC);

-- CreateIndex
CREATE INDEX "style_value_additions_styleId_idx" ON "public"."style_value_additions"("styleId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "style_variants_sku_key" ON "public"."style_variants"("sku" ASC);

-- CreateIndex
CREATE INDEX "style_variants_styleId_idx" ON "public"."style_variants"("styleId" ASC);

-- CreateIndex
CREATE INDEX "styles_brandCategoryId_idx" ON "public"."styles"("brandCategoryId" ASC);

-- CreateIndex
CREATE INDEX "styles_brandName_idx" ON "public"."styles"("brandName" ASC);

-- CreateIndex
CREATE INDEX "styles_cadStatus_idx" ON "public"."styles"("cadStatus" ASC);

-- CreateIndex
CREATE INDEX "styles_categoryId_idx" ON "public"."styles"("categoryId" ASC);

-- CreateIndex
CREATE INDEX "styles_createdAt_idx" ON "public"."styles"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "styles_createdById_idx" ON "public"."styles"("createdById" ASC);

-- CreateIndex
CREATE INDEX "styles_customerName_idx" ON "public"."styles"("customerName" ASC);

-- CreateIndex
CREATE INDEX "styles_internalCode_idx" ON "public"."styles"("internalCode" ASC);

-- CreateIndex
CREATE INDEX "styles_isActive_idx" ON "public"."styles"("isActive" ASC);

-- CreateIndex
CREATE INDEX "styles_product_category_id_idx" ON "public"."styles"("product_category_id" ASC);

-- CreateIndex
CREATE INDEX "styles_projectGroup_idx" ON "public"."styles"("projectGroup" ASC);

-- CreateIndex
CREATE INDEX "styles_seasonId_idx" ON "public"."styles"("seasonId" ASC);

-- CreateIndex
CREATE INDEX "styles_status_idx" ON "public"."styles"("status" ASC);

-- CreateIndex
CREATE INDEX "styles_styleCode_idx" ON "public"."styles"("styleCode" ASC);

-- CreateIndex
CREATE INDEX "styles_styleName_idx" ON "public"."styles"("styleName" ASC);

-- CreateIndex
CREATE INDEX "supplier_gst_numbers_billingCityId_idx" ON "public"."supplier_gst_numbers"("billingCityId" ASC);

-- CreateIndex
CREATE INDEX "supplier_gst_numbers_gstNumber_idx" ON "public"."supplier_gst_numbers"("gstNumber" ASC);

-- CreateIndex
CREATE INDEX "supplier_gst_numbers_stateId_idx" ON "public"."supplier_gst_numbers"("stateId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_gst_numbers_supplierId_gstNumber_key" ON "public"."supplier_gst_numbers"("supplierId" ASC, "gstNumber" ASC);

-- CreateIndex
CREATE INDEX "supplier_gst_numbers_supplierId_idx" ON "public"."supplier_gst_numbers"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "suppliers_code_idx" ON "public"."suppliers"("code" ASC);

-- CreateIndex
CREATE INDEX "suppliers_currencyCode_idx" ON "public"."suppliers"("currencyCode" ASC);

-- CreateIndex
CREATE INDEX "suppliers_isActive_idx" ON "public"."suppliers"("isActive" ASC);

-- CreateIndex
CREATE INDEX "suppliers_name_idx" ON "public"."suppliers"("name" ASC);

-- CreateIndex
CREATE INDEX "suppliers_paymentTermsId_idx" ON "public"."suppliers"("paymentTermsId" ASC);

-- CreateIndex
CREATE INDEX "suppliers_supplierCategories_idx" ON "public"."suppliers"("supplierCategories" ASC);

-- CreateIndex
CREATE INDEX "tax_masters_applicableFrom_idx" ON "public"."tax_masters"("applicableFrom" ASC);

-- CreateIndex
CREATE INDEX "tax_masters_taxCode_idx" ON "public"."tax_masters"("taxCode" ASC);

-- CreateIndex
CREATE INDEX "tax_masters_taxType_idx" ON "public"."tax_masters"("taxType" ASC);

-- CreateIndex
CREATE INDEX "tcs_entries_financialYear_quarter_idx" ON "public"."tcs_entries"("financialYear" ASC, "quarter" ASC);

-- CreateIndex
CREATE INDEX "tcs_entries_invoiceId_idx" ON "public"."tcs_entries"("invoiceId" ASC);

-- CreateIndex
CREATE INDEX "tcs_entries_status_idx" ON "public"."tcs_entries"("status" ASC);

-- CreateIndex
CREATE INDEX "tds_entries_financialYear_quarter_idx" ON "public"."tds_entries"("financialYear" ASC, "quarter" ASC);

-- CreateIndex
CREATE INDEX "tds_entries_invoiceId_idx" ON "public"."tds_entries"("invoiceId" ASC);

-- CreateIndex
CREATE INDEX "tds_entries_status_idx" ON "public"."tds_entries"("status" ASC);

-- CreateIndex
CREATE INDEX "test_templates_isActive_idx" ON "public"."test_templates"("isActive" ASC);

-- CreateIndex
CREATE INDEX "test_templates_templateCode_idx" ON "public"."test_templates"("templateCode" ASC);

-- CreateIndex
CREATE INDEX "test_templates_templateType_idx" ON "public"."test_templates"("templateType" ASC);

-- CreateIndex
CREATE INDEX "testing_labs_isActive_idx" ON "public"."testing_labs"("isActive" ASC);

-- CreateIndex
CREATE INDEX "testing_labs_labCode_idx" ON "public"."testing_labs"("labCode" ASC);

-- CreateIndex
CREATE INDEX "thread_master_colorId_idx" ON "public"."thread_master"("colorId" ASC);

-- CreateIndex
CREATE INDEX "thread_master_materialComposition_idx" ON "public"."thread_master"("materialComposition" ASC);

-- CreateIndex
CREATE INDEX "thread_master_packagingType_idx" ON "public"."thread_master"("packagingType" ASC);

-- CreateIndex
CREATE INDEX "thread_master_ply_idx" ON "public"."thread_master"("ply" ASC);

-- CreateIndex
CREATE INDEX "thread_master_supplierId_idx" ON "public"."thread_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "thread_master_threadCode_idx" ON "public"."thread_master"("threadCode" ASC);

-- CreateIndex
CREATE INDEX "thread_packaging_specs_packagingType_idx" ON "public"."thread_packaging_specs"("packagingType" ASC);

-- CreateIndex
CREATE INDEX "thread_packaging_specs_ply_idx" ON "public"."thread_packaging_specs"("ply" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "thread_packaging_specs_ply_packagingType_key" ON "public"."thread_packaging_specs"("ply" ASC, "packagingType" ASC);

-- CreateIndex
CREATE INDEX "thread_style_associations_styleId_idx" ON "public"."thread_style_associations"("styleId" ASC);

-- CreateIndex
CREATE INDEX "thread_style_associations_threadId_idx" ON "public"."thread_style_associations"("threadId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "thread_style_associations_threadId_styleId_key" ON "public"."thread_style_associations"("threadId" ASC, "styleId" ASC);

-- CreateIndex
CREATE INDEX "thread_suppliers_supplierId_idx" ON "public"."thread_suppliers"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "thread_suppliers_threadId_idx" ON "public"."thread_suppliers"("threadId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "thread_suppliers_threadId_supplierId_key" ON "public"."thread_suppliers"("threadId" ASC, "supplierId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "transfer_slip_skus_transferSlipId_colorId_sizeId_key" ON "public"."transfer_slip_skus"("transferSlipId" ASC, "colorId" ASC, "sizeId" ASC);

-- CreateIndex
CREATE INDEX "transfer_slip_skus_transferSlipId_idx" ON "public"."transfer_slip_skus"("transferSlipId" ASC);

-- CreateIndex
CREATE INDEX "transfer_slips_fromStage_toStage_idx" ON "public"."transfer_slips"("fromStage" ASC, "toStage" ASC);

-- CreateIndex
CREATE INDEX "transfer_slips_status_idx" ON "public"."transfer_slips"("status" ASC);

-- CreateIndex
CREATE INDEX "transfer_slips_workOrderId_idx" ON "public"."transfer_slips"("workOrderId" ASC);

-- CreateIndex
CREATE INDEX "users_email_idx" ON "public"."users"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email" ASC);

-- CreateIndex
CREATE INDEX "velcro_master_supplierId_idx" ON "public"."velcro_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "velcro_master_velcroCode_idx" ON "public"."velcro_master"("velcroCode" ASC);

-- CreateIndex
CREATE INDEX "warehouses_createdById_idx" ON "public"."warehouses"("createdById" ASC);

-- CreateIndex
CREATE INDEX "warehouses_warehouseCode_idx" ON "public"."warehouses"("warehouseCode" ASC);

-- CreateIndex
CREATE INDEX "warehouses_warehouseType_idx" ON "public"."warehouses"("warehouseType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "work_order_breakup_workOrderId_colorId_sizeId_key" ON "public"."work_order_breakup"("workOrderId" ASC, "colorId" ASC, "sizeId" ASC);

-- CreateIndex
CREATE INDEX "work_order_breakup_workOrderId_idx" ON "public"."work_order_breakup"("workOrderId" ASC);

-- CreateIndex
CREATE INDEX "work_order_service_requirements_preferredProcessorId_idx" ON "public"."work_order_service_requirements"("preferredProcessorId" ASC);

-- CreateIndex
CREATE INDEX "work_order_service_requirements_serviceType_idx" ON "public"."work_order_service_requirements"("serviceType" ASC);

-- CreateIndex
CREATE INDEX "work_order_service_requirements_status_idx" ON "public"."work_order_service_requirements"("status" ASC);

-- CreateIndex
CREATE INDEX "work_order_service_requirements_workOrderId_idx" ON "public"."work_order_service_requirements"("workOrderId" ASC);

-- CreateIndex
CREATE INDEX "work_orders_orderId_idx" ON "public"."work_orders"("orderId" ASC);

-- CreateIndex
CREATE INDEX "work_orders_orderId_status_idx" ON "public"."work_orders"("orderId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "work_orders_parentRunId_idx" ON "public"."work_orders"("parentRunId" ASC);

-- CreateIndex
CREATE INDEX "work_orders_status_idx" ON "public"."work_orders"("status" ASC);

-- CreateIndex
CREATE INDEX "work_orders_styleId_status_idx" ON "public"."work_orders"("styleId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "work_orders_warehouseId_idx" ON "public"."work_orders"("warehouseId" ASC);

-- CreateIndex
CREATE INDEX "work_orders_workOrderNumber_idx" ON "public"."work_orders"("workOrderNumber" ASC);

-- CreateIndex
CREATE INDEX "zipper_master_supplierId_idx" ON "public"."zipper_master"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "zipper_master_zipperCode_idx" ON "public"."zipper_master"("zipperCode" ASC);

-- CreateIndex
CREATE INDEX "zipper_suppliers_supplierId_idx" ON "public"."zipper_suppliers"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "zipper_suppliers_zipperId_idx" ON "public"."zipper_suppliers"("zipperId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "zipper_suppliers_zipperId_supplierId_key" ON "public"."zipper_suppliers"("zipperId" ASC, "supplierId" ASC);

-- AddForeignKey
ALTER TABLE "public"."agents" ADD CONSTRAINT "agents_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "public"."agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_conversations" ADD CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_feedback" ADD CONSTRAINT "ai_feedback_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."ai_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_feedback" ADD CONSTRAINT "ai_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."asn_applications" ADD CONSTRAINT "asn_applications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."asn_applications" ADD CONSTRAINT "asn_applications_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."asn_skus" ADD CONSTRAINT "asn_skus_asnId_fkey" FOREIGN KEY ("asnId") REFERENCES "public"."asn_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."asn_skus" ADD CONSTRAINT "asn_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."asn_skus" ADD CONSTRAINT "asn_skus_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bank_accounts" ADD CONSTRAINT "bank_accounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bead_master" ADD CONSTRAINT "bead_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bead_master" ADD CONSTRAINT "bead_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."belt_master" ADD CONSTRAINT "belt_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."belt_master" ADD CONSTRAINT "belt_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."brand_categories" ADD CONSTRAINT "brand_categories_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."brand_categories" ADD CONSTRAINT "brand_categories_productCategoryId_fkey" FOREIGN KEY ("productCategoryId") REFERENCES "public"."product_category_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."buckle_master" ADD CONSTRAINT "buckle_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."buckle_master" ADD CONSTRAINT "buckle_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."button_master" ADD CONSTRAINT "button_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."button_master" ADD CONSTRAINT "button_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."button_style_associations" ADD CONSTRAINT "button_style_associations_buttonId_fkey" FOREIGN KEY ("buttonId") REFERENCES "public"."button_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."button_style_associations" ADD CONSTRAINT "button_style_associations_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."button_suppliers" ADD CONSTRAINT "button_suppliers_buttonId_fkey" FOREIGN KEY ("buttonId") REFERENCES "public"."button_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."button_suppliers" ADD CONSTRAINT "button_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cad_size_breakdown" ADD CONSTRAINT "cad_size_breakdown_cadId_fkey" FOREIGN KEY ("cadId") REFERENCES "public"."fabric_width_cad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cad_size_breakdown" ADD CONSTRAINT "cad_size_breakdown_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."size_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."carton_packings" ADD CONSTRAINT "carton_packings_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "public"."style_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."carton_packings" ADD CONSTRAINT "carton_packings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."carton_packings" ADD CONSTRAINT "carton_packings_finishingIssueId_fkey" FOREIGN KEY ("finishingIssueId") REFERENCES "public"."finishing_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."carton_packings" ADD CONSTRAINT "carton_packings_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "public"."work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."carton_skus" ADD CONSTRAINT "carton_skus_cartonId_fkey" FOREIGN KEY ("cartonId") REFERENCES "public"."carton_packings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."carton_skus" ADD CONSTRAINT "carton_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."carton_skus" ADD CONSTRAINT "carton_skus_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."category_component_defaults" ADD CONSTRAINT "category_component_defaults_component_master_id_fkey" FOREIGN KEY ("component_master_id") REFERENCES "public"."component_masters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."category_component_defaults" ADD CONSTRAINT "category_component_defaults_product_category_id_fkey" FOREIGN KEY ("product_category_id") REFERENCES "public"."product_category_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."challan_items" ADD CONSTRAINT "challan_items_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "public"."challans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."challans" ADD CONSTRAINT "challans_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."challans" ADD CONSTRAINT "challans_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."challans" ADD CONSTRAINT "challans_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "public"."work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."challans" ADD CONSTRAINT "challans_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "public"."purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."challans" ADD CONSTRAINT "challans_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "public"."chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."color_options" ADD CONSTRAINT "color_options_colorMasterId_fkey" FOREIGN KEY ("colorMasterId") REFERENCES "public"."color_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."color_options" ADD CONSTRAINT "color_options_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."component_masters" ADD CONSTRAINT "component_masters_component_group_id_fkey" FOREIGN KEY ("component_group_id") REFERENCES "public"."component_group_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."component_masters" ADD CONSTRAINT "component_masters_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."component_pattern_parts" ADD CONSTRAINT "component_pattern_parts_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "public"."component_masters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."component_pattern_parts" ADD CONSTRAINT "component_pattern_parts_pattern_part_id_fkey" FOREIGN KEY ("pattern_part_id") REFERENCES "public"."pattern_part_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cost_centers" ADD CONSTRAINT "cost_centers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cost_centers" ADD CONSTRAINT "cost_centers_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cost_sheet_po_generation" ADD CONSTRAINT "cost_sheet_po_generation_costSheetId_fkey" FOREIGN KEY ("costSheetId") REFERENCES "public"."style_costing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cost_sheet_po_generation" ADD CONSTRAINT "cost_sheet_po_generation_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."credit_note_items" ADD CONSTRAINT "credit_note_items_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "public"."credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."credit_notes" ADD CONSTRAINT "credit_notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."credit_notes" ADD CONSTRAINT "credit_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."credit_notes" ADD CONSTRAINT "credit_notes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_accessories_preset_items" ADD CONSTRAINT "customer_accessories_preset_items_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "public"."label_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_accessories_preset_items" ADD CONSTRAINT "customer_accessories_preset_items_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "public"."materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_accessories_preset_items" ADD CONSTRAINT "customer_accessories_preset_items_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "public"."customer_accessories_presets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_accessories_presets" ADD CONSTRAINT "customer_accessories_presets_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_gst_numbers" ADD CONSTRAINT "customer_gst_numbers_billingCityId_fkey" FOREIGN KEY ("billingCityId") REFERENCES "public"."indian_cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_gst_numbers" ADD CONSTRAINT "customer_gst_numbers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_gst_numbers" ADD CONSTRAINT "customer_gst_numbers_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "public"."indian_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_size_category_presets" ADD CONSTRAINT "customer_size_category_presets_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_size_category_presets" ADD CONSTRAINT "customer_size_category_presets_sizeCategoryId_fkey" FOREIGN KEY ("sizeCategoryId") REFERENCES "public"."size_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "public"."agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_billingCityId_fkey" FOREIGN KEY ("billingCityId") REFERENCES "public"."indian_cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_billingStateId_fkey" FOREIGN KEY ("billingStateId") REFERENCES "public"."indian_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "public"."currencies"("currencyCode") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_defaultTestingLabId_fkey" FOREIGN KEY ("defaultTestingLabId") REFERENCES "public"."testing_labs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_fptTemplateId_fkey" FOREIGN KEY ("fptTemplateId") REFERENCES "public"."test_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_gptTemplateId_fkey" FOREIGN KEY ("gptTemplateId") REFERENCES "public"."test_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_paymentTermsId_fkey" FOREIGN KEY ("paymentTermsId") REFERENCES "public"."payment_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_shippingCityId_fkey" FOREIGN KEY ("shippingCityId") REFERENCES "public"."indian_cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_shippingStateId_fkey" FOREIGN KEY ("shippingStateId") REFERENCES "public"."indian_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cutting_batch_defects" ADD CONSTRAINT "cutting_batch_defects_cuttingBatchId_fkey" FOREIGN KEY ("cuttingBatchId") REFERENCES "public"."cutting_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cutting_batch_fabrics" ADD CONSTRAINT "cutting_batch_fabrics_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."cutting_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cutting_batch_fabrics" ADD CONSTRAINT "cutting_batch_fabrics_fabricStockId_fkey" FOREIGN KEY ("fabricStockId") REFERENCES "public"."fabric_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cutting_batch_skus" ADD CONSTRAINT "cutting_batch_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cutting_batch_skus" ADD CONSTRAINT "cutting_batch_skus_cuttingBatchId_fkey" FOREIGN KEY ("cuttingBatchId") REFERENCES "public"."cutting_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cutting_batch_skus" ADD CONSTRAINT "cutting_batch_skus_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cutting_batches" ADD CONSTRAINT "cutting_batches_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "public"."style_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cutting_batches" ADD CONSTRAINT "cutting_batches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cutting_batches" ADD CONSTRAINT "cutting_batches_cuttingOperatorId_fkey" FOREIGN KEY ("cuttingOperatorId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cutting_batches" ADD CONSTRAINT "cutting_batches_fabricStockId_fkey" FOREIGN KEY ("fabricStockId") REFERENCES "public"."fabric_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cutting_batches" ADD CONSTRAINT "cutting_batches_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "public"."work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cutting_lay_skus" ADD CONSTRAINT "cutting_lay_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cutting_lay_skus" ADD CONSTRAINT "cutting_lay_skus_cuttingLayId_fkey" FOREIGN KEY ("cuttingLayId") REFERENCES "public"."cutting_lays"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cutting_lay_skus" ADD CONSTRAINT "cutting_lay_skus_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cutting_lays" ADD CONSTRAINT "cutting_lays_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cutting_lays" ADD CONSTRAINT "cutting_lays_cuttingBatchFabricId_fkey" FOREIGN KEY ("cuttingBatchFabricId") REFERENCES "public"."cutting_batch_fabrics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cutting_lays" ADD CONSTRAINT "cutting_lays_cuttingBatchId_fkey" FOREIGN KEY ("cuttingBatchId") REFERENCES "public"."cutting_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."debit_note_items" ADD CONSTRAINT "debit_note_items_debitNoteId_fkey" FOREIGN KEY ("debitNoteId") REFERENCES "public"."debit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."debit_notes" ADD CONSTRAINT "debit_notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."debit_notes" ADD CONSTRAINT "debit_notes_poId_fkey" FOREIGN KEY ("poId") REFERENCES "public"."purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."debit_notes" ADD CONSTRAINT "debit_notes_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_note_items" ADD CONSTRAINT "delivery_note_items_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_note_items" ADD CONSTRAINT "delivery_note_items_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES "public"."delivery_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_note_items" ADD CONSTRAINT "delivery_note_items_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "public"."order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_note_items" ADD CONSTRAINT "delivery_note_items_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_note_items" ADD CONSTRAINT "delivery_note_items_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_note_items" ADD CONSTRAINT "delivery_note_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."style_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_notes" ADD CONSTRAINT "delivery_notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_notes" ADD CONSTRAINT "delivery_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_notes" ADD CONSTRAINT "delivery_notes_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_notes_ext" ADD CONSTRAINT "delivery_notes_ext_asnId_fkey" FOREIGN KEY ("asnId") REFERENCES "public"."asn_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_notes_ext" ADD CONSTRAINT "delivery_notes_ext_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES "public"."delivery_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispatch_cartons" ADD CONSTRAINT "dispatch_cartons_cartonId_fkey" FOREIGN KEY ("cartonId") REFERENCES "public"."carton_packings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispatch_cartons" ADD CONSTRAINT "dispatch_cartons_deliveryNoteExtId_fkey" FOREIGN KEY ("deliveryNoteExtId") REFERENCES "public"."delivery_notes_ext"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispatch_documents" ADD CONSTRAINT "dispatch_documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispatch_documents" ADD CONSTRAINT "dispatch_documents_deliveryNoteExtId_fkey" FOREIGN KEY ("deliveryNoteExtId") REFERENCES "public"."delivery_notes_ext"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispatch_pods" ADD CONSTRAINT "dispatch_pods_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispatch_pods" ADD CONSTRAINT "dispatch_pods_deliveryNoteExtId_fkey" FOREIGN KEY ("deliveryNoteExtId") REFERENCES "public"."delivery_notes_ext"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispatch_transports" ADD CONSTRAINT "dispatch_transports_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispatch_transports" ADD CONSTRAINT "dispatch_transports_deliveryNoteExtId_fkey" FOREIGN KEY ("deliveryNoteExtId") REFERENCES "public"."delivery_notes_ext"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."drawstring_master" ADD CONSTRAINT "drawstring_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."drawstring_master" ADD CONSTRAINT "drawstring_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."elastic_master" ADD CONSTRAINT "elastic_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."elastic_master" ADD CONSTRAINT "elastic_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."elastic_suppliers" ADD CONSTRAINT "elastic_suppliers_elasticId_fkey" FOREIGN KEY ("elasticId") REFERENCES "public"."elastic_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."elastic_suppliers" ADD CONSTRAINT "elastic_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."embroidery_cad_size_breakdown" ADD CONSTRAINT "embroidery_cad_size_breakdown_embroidery_cad_id_fkey" FOREIGN KEY ("embroidery_cad_id") REFERENCES "public"."embroidery_part_cad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."embroidery_cad_size_breakdown" ADD CONSTRAINT "embroidery_cad_size_breakdown_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "public"."size_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."embroidery_master" ADD CONSTRAINT "embroidery_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."embroidery_part_cad" ADD CONSTRAINT "embroidery_part_cad_embroidery_id_fkey" FOREIGN KEY ("embroidery_id") REFERENCES "public"."embroidery_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."embroidery_part_cad" ADD CONSTRAINT "embroidery_part_cad_fabric_width_cad_id_fkey" FOREIGN KEY ("fabric_width_cad_id") REFERENCES "public"."fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."embroidery_part_cad" ADD CONSTRAINT "embroidery_part_cad_style_fabric_id_fkey" FOREIGN KEY ("style_fabric_id") REFERENCES "public"."style_fabrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."embroidery_send_out" ADD CONSTRAINT "embroidery_send_out_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."embroidery_send_out" ADD CONSTRAINT "embroidery_send_out_embroideryId_fkey" FOREIGN KEY ("embroideryId") REFERENCES "public"."embroidery_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."embroidery_send_out" ADD CONSTRAINT "embroidery_send_out_forOrderId_fkey" FOREIGN KEY ("forOrderId") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."embroidery_send_out" ADD CONSTRAINT "embroidery_send_out_forStyleId_fkey" FOREIGN KEY ("forStyleId") REFERENCES "public"."styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."embroidery_send_out" ADD CONSTRAINT "embroidery_send_out_resultFabricStockId_fkey" FOREIGN KEY ("resultFabricStockId") REFERENCES "public"."fabric_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."embroidery_send_out" ADD CONSTRAINT "embroidery_send_out_sourceFabricStockId_fkey" FOREIGN KEY ("sourceFabricStockId") REFERENCES "public"."fabric_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."embroidery_send_out" ADD CONSTRAINT "embroidery_send_out_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."embroidery_send_out" ADD CONSTRAINT "embroidery_send_out_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "public"."work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."exchange_rates" ADD CONSTRAINT "exchange_rates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."exchange_rates" ADD CONSTRAINT "exchange_rates_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "public"."currencies"("currencyCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expense_types" ADD CONSTRAINT "expense_types_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expense_types" ADD CONSTRAINT "expense_types_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."export_templates" ADD CONSTRAINT "export_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_costing_run" ADD CONSTRAINT "fabric_costing_run_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_costing_run" ADD CONSTRAINT "fabric_costing_run_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_master" ADD CONSTRAINT "fabric_master_colorMasterId_fkey" FOREIGN KEY ("colorMasterId") REFERENCES "public"."color_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_master" ADD CONSTRAINT "fabric_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_master" ADD CONSTRAINT "fabric_master_greigeId_fkey" FOREIGN KEY ("greigeId") REFERENCES "public"."greige_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_master" ADD CONSTRAINT "fabric_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_physical_tests" ADD CONSTRAINT "fabric_physical_tests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_physical_tests" ADD CONSTRAINT "fabric_physical_tests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_physical_tests" ADD CONSTRAINT "fabric_physical_tests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_physical_tests" ADD CONSTRAINT "fabric_physical_tests_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "public"."fabric_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_physical_tests" ADD CONSTRAINT "fabric_physical_tests_fabricProcurementId_fkey" FOREIGN KEY ("fabricProcurementId") REFERENCES "public"."fabric_procurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_physical_tests" ADD CONSTRAINT "fabric_physical_tests_fabricStockLotId_fkey" FOREIGN KEY ("fabricStockLotId") REFERENCES "public"."fabric_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_physical_tests" ADD CONSTRAINT "fabric_physical_tests_originalTestId_fkey" FOREIGN KEY ("originalTestId") REFERENCES "public"."fabric_physical_tests"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."fabric_physical_tests" ADD CONSTRAINT "fabric_physical_tests_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_physical_tests" ADD CONSTRAINT "fabric_physical_tests_testingLabId_fkey" FOREIGN KEY ("testingLabId") REFERENCES "public"."testing_labs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_processing" ADD CONSTRAINT "fabric_processing_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_processing" ADD CONSTRAINT "fabric_processing_finishedFabricId_fkey" FOREIGN KEY ("finishedFabricId") REFERENCES "public"."fabric_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_processing" ADD CONSTRAINT "fabric_processing_greigeId_fkey" FOREIGN KEY ("greigeId") REFERENCES "public"."greige_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_processing" ADD CONSTRAINT "fabric_processing_processingMillId_fkey" FOREIGN KEY ("processingMillId") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_processing" ADD CONSTRAINT "fabric_processing_procurementId_fkey" FOREIGN KEY ("procurementId") REFERENCES "public"."fabric_procurement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_procurement" ADD CONSTRAINT "fabric_procurement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_procurement" ADD CONSTRAINT "fabric_procurement_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "public"."fabric_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_procurement" ADD CONSTRAINT "fabric_procurement_greigeId_fkey" FOREIGN KEY ("greigeId") REFERENCES "public"."greige_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_procurement" ADD CONSTRAINT "fabric_procurement_orderedForOrderId_fkey" FOREIGN KEY ("orderedForOrderId") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_procurement" ADD CONSTRAINT "fabric_procurement_orderedForStyleId_fkey" FOREIGN KEY ("orderedForStyleId") REFERENCES "public"."styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_procurement" ADD CONSTRAINT "fabric_procurement_processedFabricId_fkey" FOREIGN KEY ("processedFabricId") REFERENCES "public"."fabric_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_procurement" ADD CONSTRAINT "fabric_procurement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_stock" ADD CONSTRAINT "fabric_stock_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_stock" ADD CONSTRAINT "fabric_stock_embroideryId_fkey" FOREIGN KEY ("embroideryId") REFERENCES "public"."embroidery_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_stock" ADD CONSTRAINT "fabric_stock_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "public"."fabric_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_stock" ADD CONSTRAINT "fabric_stock_originOrderId_fkey" FOREIGN KEY ("originOrderId") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_stock" ADD CONSTRAINT "fabric_stock_originStyleId_fkey" FOREIGN KEY ("originStyleId") REFERENCES "public"."styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_stock" ADD CONSTRAINT "fabric_stock_pattern_part_id_fkey" FOREIGN KEY ("pattern_part_id") REFERENCES "public"."pattern_part_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_stock" ADD CONSTRAINT "fabric_stock_procurementId_fkey" FOREIGN KEY ("procurementId") REFERENCES "public"."fabric_procurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_stock_allocation" ADD CONSTRAINT "fabric_stock_allocation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_stock_allocation" ADD CONSTRAINT "fabric_stock_allocation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_stock_allocation" ADD CONSTRAINT "fabric_stock_allocation_originalStyleId_fkey" FOREIGN KEY ("originalStyleId") REFERENCES "public"."styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_stock_allocation" ADD CONSTRAINT "fabric_stock_allocation_production_cad_id_fkey" FOREIGN KEY ("production_cad_id") REFERENCES "public"."fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_stock_allocation" ADD CONSTRAINT "fabric_stock_allocation_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "public"."fabric_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_stock_allocation" ADD CONSTRAINT "fabric_stock_allocation_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_stock_transaction" ADD CONSTRAINT "fabric_stock_transaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_stock_transaction" ADD CONSTRAINT "fabric_stock_transaction_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "public"."fabric_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_suppliers" ADD CONSTRAINT "fabric_suppliers_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "public"."fabric_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_suppliers" ADD CONSTRAINT "fabric_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_cloned_from_cad_id_fkey" FOREIGN KEY ("cloned_from_cad_id") REFERENCES "public"."fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_cloned_from_order_id_fkey" FOREIGN KEY ("cloned_from_order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_copied_from_id_fkey" FOREIGN KEY ("copied_from_id") REFERENCES "public"."fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_costingStyleId_fkey" FOREIGN KEY ("costingStyleId") REFERENCES "public"."styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_costing_run_id_fkey" FOREIGN KEY ("costing_run_id") REFERENCES "public"."fabric_costing_run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "public"."fabric_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_fabric_stock_id_fkey" FOREIGN KEY ("fabric_stock_id") REFERENCES "public"."fabric_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_greigeId_fkey" FOREIGN KEY ("greigeId") REFERENCES "public"."greige_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_pattern_part_id_fkey" FOREIGN KEY ("pattern_part_id") REFERENCES "public"."pattern_part_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_processing_batch_group_color_id_fkey" FOREIGN KEY ("processing_batch_group_color_id") REFERENCES "public"."color_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_processorId_fkey" FOREIGN KEY ("processorId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_procurement_id_fkey" FOREIGN KEY ("procurement_id") REFERENCES "public"."fabric_procurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_style_costing_id_fkey" FOREIGN KEY ("style_costing_id") REFERENCES "public"."style_costing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_style_fabric_id_fkey" FOREIGN KEY ("style_fabric_id") REFERENCES "public"."style_fabrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "public"."fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_variance_approved_by_fkey" FOREIGN KEY ("variance_approved_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finished_goods_stock" ADD CONSTRAINT "finished_goods_stock_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finished_goods_stock" ADD CONSTRAINT "finished_goods_stock_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finished_goods_stock" ADD CONSTRAINT "finished_goods_stock_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finished_goods_stock" ADD CONSTRAINT "finished_goods_stock_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finished_goods_stock" ADD CONSTRAINT "finished_goods_stock_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."style_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finished_goods_stock" ADD CONSTRAINT "finished_goods_stock_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "public"."work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finishing_daily_outputs" ADD CONSTRAINT "finishing_daily_outputs_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "public"."style_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finishing_daily_outputs" ADD CONSTRAINT "finishing_daily_outputs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finishing_daily_outputs" ADD CONSTRAINT "finishing_daily_outputs_finishingIssueId_fkey" FOREIGN KEY ("finishingIssueId") REFERENCES "public"."finishing_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finishing_issue_components" ADD CONSTRAINT "finishing_issue_components_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "public"."style_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finishing_issue_components" ADD CONSTRAINT "finishing_issue_components_finishingIssueId_fkey" FOREIGN KEY ("finishingIssueId") REFERENCES "public"."finishing_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finishing_issue_skus" ADD CONSTRAINT "finishing_issue_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finishing_issue_skus" ADD CONSTRAINT "finishing_issue_skus_finishingIssueId_fkey" FOREIGN KEY ("finishingIssueId") REFERENCES "public"."finishing_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finishing_issue_skus" ADD CONSTRAINT "finishing_issue_skus_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finishing_issues" ADD CONSTRAINT "finishing_issues_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finishing_issues" ADD CONSTRAINT "finishing_issues_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finishing_issues" ADD CONSTRAINT "finishing_issues_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finishing_issues" ADD CONSTRAINT "finishing_issues_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "public"."work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finishing_output_skus" ADD CONSTRAINT "finishing_output_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finishing_output_skus" ADD CONSTRAINT "finishing_output_skus_dailyOutputId_fkey" FOREIGN KEY ("dailyOutputId") REFERENCES "public"."finishing_daily_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."finishing_output_skus" ADD CONSTRAINT "finishing_output_skus_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."garment_physical_tests" ADD CONSTRAINT "garment_physical_tests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."garment_physical_tests" ADD CONSTRAINT "garment_physical_tests_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."color_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."garment_physical_tests" ADD CONSTRAINT "garment_physical_tests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."garment_physical_tests" ADD CONSTRAINT "garment_physical_tests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."garment_physical_tests" ADD CONSTRAINT "garment_physical_tests_originalTestId_fkey" FOREIGN KEY ("originalTestId") REFERENCES "public"."garment_physical_tests"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."garment_physical_tests" ADD CONSTRAINT "garment_physical_tests_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."size_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."garment_physical_tests" ADD CONSTRAINT "garment_physical_tests_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."garment_physical_tests" ADD CONSTRAINT "garment_physical_tests_testingLabId_fkey" FOREIGN KEY ("testingLabId") REFERENCES "public"."testing_labs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."garment_physical_tests" ADD CONSTRAINT "garment_physical_tests_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "public"."work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_receiving_notes" ADD CONSTRAINT "goods_receiving_notes_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_receiving_notes" ADD CONSTRAINT "goods_receiving_notes_poId_fkey" FOREIGN KEY ("poId") REFERENCES "public"."purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_receiving_notes" ADD CONSTRAINT "goods_receiving_notes_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_receiving_notes" ADD CONSTRAINT "goods_receiving_notes_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_receiving_notes" ADD CONSTRAINT "goods_receiving_notes_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "public"."warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."greige_master" ADD CONSTRAINT "greige_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."greige_master" ADD CONSTRAINT "greige_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."greige_stock" ADD CONSTRAINT "greige_stock_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."greige_stock" ADD CONSTRAINT "greige_stock_greigeId_fkey" FOREIGN KEY ("greigeId") REFERENCES "public"."greige_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."greige_stock" ADD CONSTRAINT "greige_stock_procurementId_fkey" FOREIGN KEY ("procurementId") REFERENCES "public"."fabric_procurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."greige_stock" ADD CONSTRAINT "greige_stock_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."greige_suppliers" ADD CONSTRAINT "greige_suppliers_greigeId_fkey" FOREIGN KEY ("greigeId") REFERENCES "public"."greige_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."greige_suppliers" ADD CONSTRAINT "greige_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."grn_items" ADD CONSTRAINT "grn_items_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "public"."goods_receiving_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."grn_items" ADD CONSTRAINT "grn_items_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "public"."materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."grn_items" ADD CONSTRAINT "grn_items_poItemId_fkey" FOREIGN KEY ("poItemId") REFERENCES "public"."purchase_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hook_eye_master" ADD CONSTRAINT "hook_eye_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hook_eye_master" ADD CONSTRAINT "hook_eye_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."indian_cities" ADD CONSTRAINT "indian_cities_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "public"."indian_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."interlining_master" ADD CONSTRAINT "interlining_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."interlining_master" ADD CONSTRAINT "interlining_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_stock" ADD CONSTRAINT "inventory_stock_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_stock" ADD CONSTRAINT "inventory_stock_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "public"."materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoice_items" ADD CONSTRAINT "invoice_items_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_placeOfSupplyId_fkey" FOREIGN KEY ("placeOfSupplyId") REFERENCES "public"."indian_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."job_work_orders" ADD CONSTRAINT "job_work_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."job_work_orders" ADD CONSTRAINT "job_work_orders_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "public"."fabric_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."job_work_orders" ADD CONSTRAINT "job_work_orders_fabricStockLotId_fkey" FOREIGN KEY ("fabricStockLotId") REFERENCES "public"."fabric_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."job_work_orders" ADD CONSTRAINT "job_work_orders_finishedFabricId_fkey" FOREIGN KEY ("finishedFabricId") REFERENCES "public"."fabric_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."job_work_orders" ADD CONSTRAINT "job_work_orders_greigeStockLotId_fkey" FOREIGN KEY ("greigeStockLotId") REFERENCES "public"."greige_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."job_work_orders" ADD CONSTRAINT "job_work_orders_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "public"."goods_receiving_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."job_work_orders" ADD CONSTRAINT "job_work_orders_inwardChallanId_fkey" FOREIGN KEY ("inwardChallanId") REFERENCES "public"."challans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."job_work_orders" ADD CONSTRAINT "job_work_orders_labDipId_fkey" FOREIGN KEY ("labDipId") REFERENCES "public"."lab_dips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."job_work_orders" ADD CONSTRAINT "job_work_orders_millId_fkey" FOREIGN KEY ("millId") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."job_work_orders" ADD CONSTRAINT "job_work_orders_outwardChallanId_fkey" FOREIGN KEY ("outwardChallanId") REFERENCES "public"."challans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."job_work_orders" ADD CONSTRAINT "job_work_orders_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "public"."purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."job_work_orders" ADD CONSTRAINT "job_work_orders_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."job_work_orders" ADD CONSTRAINT "job_work_orders_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "public"."work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lab_dips" ADD CONSTRAINT "lab_dips_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lab_dips" ADD CONSTRAINT "lab_dips_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lab_dips" ADD CONSTRAINT "lab_dips_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "public"."fabric_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lab_dips" ADD CONSTRAINT "lab_dips_millId_fkey" FOREIGN KEY ("millId") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lab_dips" ADD CONSTRAINT "lab_dips_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lab_dips" ADD CONSTRAINT "lab_dips_targetColorId_fkey" FOREIGN KEY ("targetColorId") REFERENCES "public"."color_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."label_master" ADD CONSTRAINT "label_master_brandCategoryId_fkey" FOREIGN KEY ("brandCategoryId") REFERENCES "public"."brand_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."label_master" ADD CONSTRAINT "label_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."label_master" ADD CONSTRAINT "label_master_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."label_master" ADD CONSTRAINT "label_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."label_size_variants" ADD CONSTRAINT "label_size_variants_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "public"."label_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."label_size_variants" ADD CONSTRAINT "label_size_variants_sizeCategoryId_fkey" FOREIGN KEY ("sizeCategoryId") REFERENCES "public"."size_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."label_suppliers" ADD CONSTRAINT "label_suppliers_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "public"."label_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."label_suppliers" ADD CONSTRAINT "label_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_defect_log" ADD CONSTRAINT "lace_defect_log_discoveredById_fkey" FOREIGN KEY ("discoveredById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_issue_note" ADD CONSTRAINT "lace_issue_note_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_issue_note" ADD CONSTRAINT "lace_issue_note_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_issue_note" ADD CONSTRAINT "lace_issue_note_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "public"."lace_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_issue_note" ADD CONSTRAINT "lace_issue_note_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_lab_dip" ADD CONSTRAINT "lace_lab_dip_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_lab_dip" ADD CONSTRAINT "lace_lab_dip_greigeLaceId_fkey" FOREIGN KEY ("greigeLaceId") REFERENCES "public"."lace_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_lab_dip" ADD CONSTRAINT "lace_lab_dip_processorId_fkey" FOREIGN KEY ("processorId") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_lab_dip" ADD CONSTRAINT "lace_lab_dip_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_master" ADD CONSTRAINT "lace_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_master" ADD CONSTRAINT "lace_master_sourceGreigeLaceId_fkey" FOREIGN KEY ("sourceGreigeLaceId") REFERENCES "public"."lace_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_master" ADD CONSTRAINT "lace_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_stock" ADD CONSTRAINT "lace_stock_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_stock" ADD CONSTRAINT "lace_stock_laceId_fkey" FOREIGN KEY ("laceId") REFERENCES "public"."lace_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_stock" ADD CONSTRAINT "lace_stock_originOrderId_fkey" FOREIGN KEY ("originOrderId") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_stock" ADD CONSTRAINT "lace_stock_originStyleId_fkey" FOREIGN KEY ("originStyleId") REFERENCES "public"."styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_stock" ADD CONSTRAINT "lace_stock_processingBatchId_fkey" FOREIGN KEY ("processingBatchId") REFERENCES "public"."processing_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_stock_allocation" ADD CONSTRAINT "lace_stock_allocation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_stock_allocation" ADD CONSTRAINT "lace_stock_allocation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_stock_allocation" ADD CONSTRAINT "lace_stock_allocation_originalOrderId_fkey" FOREIGN KEY ("originalOrderId") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_stock_allocation" ADD CONSTRAINT "lace_stock_allocation_originalStyleId_fkey" FOREIGN KEY ("originalStyleId") REFERENCES "public"."styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_stock_allocation" ADD CONSTRAINT "lace_stock_allocation_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "public"."lace_stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_stock_allocation" ADD CONSTRAINT "lace_stock_allocation_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_stock_transaction" ADD CONSTRAINT "lace_stock_transaction_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_stock_transaction" ADD CONSTRAINT "lace_stock_transaction_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "public"."lace_stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_style_associations" ADD CONSTRAINT "lace_style_associations_laceId_fkey" FOREIGN KEY ("laceId") REFERENCES "public"."lace_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_style_associations" ADD CONSTRAINT "lace_style_associations_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_suppliers" ADD CONSTRAINT "lace_suppliers_laceId_fkey" FOREIGN KEY ("laceId") REFERENCES "public"."lace_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lace_suppliers" ADD CONSTRAINT "lace_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lookup_values" ADD CONSTRAINT "lookup_values_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."machine_part_master" ADD CONSTRAINT "machine_part_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."machine_part_master" ADD CONSTRAINT "machine_part_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."machine_part_suppliers" ADD CONSTRAINT "machine_part_suppliers_machinePartId_fkey" FOREIGN KEY ("machinePartId") REFERENCES "public"."machine_part_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."machine_part_suppliers" ADD CONSTRAINT "machine_part_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_categories" ADD CONSTRAINT "material_categories_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "public"."material_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_master" ADD CONSTRAINT "material_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_master" ADD CONSTRAINT "material_master_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "public"."currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_requirements" ADD CONSTRAINT "material_requirements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_requirements" ADD CONSTRAINT "material_requirements_linkedRequirementId_fkey" FOREIGN KEY ("linkedRequirementId") REFERENCES "public"."material_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_requirements" ADD CONSTRAINT "material_requirements_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "public"."materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_requirements" ADD CONSTRAINT "material_requirements_orderBomId_fkey" FOREIGN KEY ("orderBomId") REFERENCES "public"."order_bom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_requirements" ADD CONSTRAINT "material_requirements_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_requirements" ADD CONSTRAINT "material_requirements_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "public"."order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_requirements" ADD CONSTRAINT "material_requirements_preferredSupplierId_fkey" FOREIGN KEY ("preferredSupplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_requirements" ADD CONSTRAINT "material_requirements_processorId_fkey" FOREIGN KEY ("processorId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_requirements" ADD CONSTRAINT "material_requirements_splitFromId_fkey" FOREIGN KEY ("splitFromId") REFERENCES "public"."material_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_requisition_items" ADD CONSTRAINT "material_requisition_items_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "public"."materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_requisition_items" ADD CONSTRAINT "material_requisition_items_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "public"."material_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_requisitions" ADD CONSTRAINT "material_requisitions_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_requisitions" ADD CONSTRAINT "material_requisitions_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_requisitions" ADD CONSTRAINT "material_requisitions_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "public"."work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_supplier_mapping" ADD CONSTRAINT "material_supplier_mapping_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "public"."material_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_supplier_mapping" ADD CONSTRAINT "material_supplier_mapping_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_suppliers" ADD CONSTRAINT "material_suppliers_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "public"."materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."material_suppliers" ADD CONSTRAINT "material_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."materials" ADD CONSTRAINT "materials_buttonId_fkey" FOREIGN KEY ("buttonId") REFERENCES "public"."button_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."materials" ADD CONSTRAINT "materials_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."material_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."materials" ADD CONSTRAINT "materials_elasticId_fkey" FOREIGN KEY ("elasticId") REFERENCES "public"."elastic_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."materials" ADD CONSTRAINT "materials_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "public"."fabric_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."materials" ADD CONSTRAINT "materials_greigeId_fkey" FOREIGN KEY ("greigeId") REFERENCES "public"."greige_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."materials" ADD CONSTRAINT "materials_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "public"."label_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."materials" ADD CONSTRAINT "materials_laceId_fkey" FOREIGN KEY ("laceId") REFERENCES "public"."lace_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."materials" ADD CONSTRAINT "materials_machinePartId_fkey" FOREIGN KEY ("machinePartId") REFERENCES "public"."machine_part_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."materials" ADD CONSTRAINT "materials_otherMaterialId_fkey" FOREIGN KEY ("otherMaterialId") REFERENCES "public"."other_material_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."materials" ADD CONSTRAINT "materials_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "public"."packaging_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."materials" ADD CONSTRAINT "materials_sizeVariantId_fkey" FOREIGN KEY ("sizeVariantId") REFERENCES "public"."label_size_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."materials" ADD CONSTRAINT "materials_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."thread_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."materials" ADD CONSTRAINT "materials_zipperId_fkey" FOREIGN KEY ("zipperId") REFERENCES "public"."zipper_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mood_board_items" ADD CONSTRAINT "mood_board_items_mood_board_id_fkey" FOREIGN KEY ("mood_board_id") REFERENCES "public"."mood_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mood_boards" ADD CONSTRAINT "mood_boards_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mood_boards" ADD CONSTRAINT "mood_boards_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."season_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."motif_master" ADD CONSTRAINT "motif_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."motif_master" ADD CONSTRAINT "motif_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_bom" ADD CONSTRAINT "order_bom_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_bom" ADD CONSTRAINT "order_bom_copiedFromOrderId_fkey" FOREIGN KEY ("copiedFromOrderId") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_bom" ADD CONSTRAINT "order_bom_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_bom" ADD CONSTRAINT "order_bom_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_bom" ADD CONSTRAINT "order_bom_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "public"."order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_bom" ADD CONSTRAINT "order_bom_sourceCostSheetId_fkey" FOREIGN KEY ("sourceCostSheetId") REFERENCES "public"."style_costing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_bom" ADD CONSTRAINT "order_bom_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_bom_items" ADD CONSTRAINT "order_bom_items_buttonId_fkey" FOREIGN KEY ("buttonId") REFERENCES "public"."button_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_bom_items" ADD CONSTRAINT "order_bom_items_elasticId_fkey" FOREIGN KEY ("elasticId") REFERENCES "public"."elastic_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_bom_items" ADD CONSTRAINT "order_bom_items_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "public"."fabric_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_bom_items" ADD CONSTRAINT "order_bom_items_greigeId_fkey" FOREIGN KEY ("greigeId") REFERENCES "public"."greige_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_bom_items" ADD CONSTRAINT "order_bom_items_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "public"."label_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_bom_items" ADD CONSTRAINT "order_bom_items_laceId_fkey" FOREIGN KEY ("laceId") REFERENCES "public"."lace_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_bom_items" ADD CONSTRAINT "order_bom_items_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "public"."materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_bom_items" ADD CONSTRAINT "order_bom_items_orderBomId_fkey" FOREIGN KEY ("orderBomId") REFERENCES "public"."order_bom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_bom_items" ADD CONSTRAINT "order_bom_items_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "public"."packaging_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_bom_items" ADD CONSTRAINT "order_bom_items_processorId_fkey" FOREIGN KEY ("processorId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_bom_items" ADD CONSTRAINT "order_bom_items_rateCardId_fkey" FOREIGN KEY ("rateCardId") REFERENCES "public"."processor_rate_card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_bom_items" ADD CONSTRAINT "order_bom_items_selectedCadId_fkey" FOREIGN KEY ("selectedCadId") REFERENCES "public"."fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_bom_items" ADD CONSTRAINT "order_bom_items_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."thread_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_bom_items" ADD CONSTRAINT "order_bom_items_zipperId_fkey" FOREIGN KEY ("zipperId") REFERENCES "public"."zipper_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_inspections" ADD CONSTRAINT "order_inspections_inspectedById_fkey" FOREIGN KEY ("inspectedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_inspections" ADD CONSTRAINT "order_inspections_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "public"."order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_item_breakup" ADD CONSTRAINT "order_item_breakup_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."color_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_item_breakup" ADD CONSTRAINT "order_item_breakup_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "public"."order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_item_breakup" ADD CONSTRAINT "order_item_breakup_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_item_breakup" ADD CONSTRAINT "order_item_breakup_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."style_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_item_costing" ADD CONSTRAINT "order_item_costing_baseCostingId_fkey" FOREIGN KEY ("baseCostingId") REFERENCES "public"."style_costing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_item_costing" ADD CONSTRAINT "order_item_costing_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "public"."order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_item_costing" ADD CONSTRAINT "order_item_costing_selectedCadId_fkey" FOREIGN KEY ("selectedCadId") REFERENCES "public"."fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_selectedCadId_fkey" FOREIGN KEY ("selectedCadId") REFERENCES "public"."fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_label_override" ADD CONSTRAINT "order_label_override_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "public"."order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_label_override" ADD CONSTRAINT "order_label_override_styleMaterialBomId_fkey" FOREIGN KEY ("styleMaterialBomId") REFERENCES "public"."style_material_bom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_label_size_override" ADD CONSTRAINT "order_label_size_override_orderLabelOverrideId_fkey" FOREIGN KEY ("orderLabelOverrideId") REFERENCES "public"."order_label_override"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_samples" ADD CONSTRAINT "order_samples_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_samples" ADD CONSTRAINT "order_samples_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "public"."order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_thread_requirements" ADD CONSTRAINT "order_thread_requirements_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."color_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_thread_requirements" ADD CONSTRAINT "order_thread_requirements_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_thread_requirements" ADD CONSTRAINT "order_thread_requirements_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."thread_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."other_decorative_master" ADD CONSTRAINT "other_decorative_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."other_decorative_master" ADD CONSTRAINT "other_decorative_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."other_fastener_master" ADD CONSTRAINT "other_fastener_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."other_fastener_master" ADD CONSTRAINT "other_fastener_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."other_functional_master" ADD CONSTRAINT "other_functional_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."other_functional_master" ADD CONSTRAINT "other_functional_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."other_material_master" ADD CONSTRAINT "other_material_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."other_material_master" ADD CONSTRAINT "other_material_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."other_material_suppliers" ADD CONSTRAINT "other_material_suppliers_otherMaterialId_fkey" FOREIGN KEY ("otherMaterialId") REFERENCES "public"."other_material_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."other_material_suppliers" ADD CONSTRAINT "other_material_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."other_tape_master" ADD CONSTRAINT "other_tape_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."other_tape_master" ADD CONSTRAINT "other_tape_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."packaging_master" ADD CONSTRAINT "packaging_master_brandCategoryId_fkey" FOREIGN KEY ("brandCategoryId") REFERENCES "public"."brand_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."packaging_master" ADD CONSTRAINT "packaging_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."packaging_master" ADD CONSTRAINT "packaging_master_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."packaging_master" ADD CONSTRAINT "packaging_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."packaging_suppliers" ADD CONSTRAINT "packaging_suppliers_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "public"."packaging_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."packaging_suppliers" ADD CONSTRAINT "packaging_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."padding_master" ADD CONSTRAINT "padding_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."padding_master" ADD CONSTRAINT "padding_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pattern_part_groups" ADD CONSTRAINT "pattern_part_groups_component_group_id_fkey" FOREIGN KEY ("component_group_id") REFERENCES "public"."component_group_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pattern_part_groups" ADD CONSTRAINT "pattern_part_groups_pattern_part_id_fkey" FOREIGN KEY ("pattern_part_id") REFERENCES "public"."pattern_part_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payment_terms" ADD CONSTRAINT "payment_terms_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."po_source_links" ADD CONSTRAINT "po_source_links_costSheetGenerationId_fkey" FOREIGN KEY ("costSheetGenerationId") REFERENCES "public"."cost_sheet_po_generation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."po_source_links" ADD CONSTRAINT "po_source_links_materialRequirementId_fkey" FOREIGN KEY ("materialRequirementId") REFERENCES "public"."material_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."po_source_links" ADD CONSTRAINT "po_source_links_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "public"."work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."po_source_links" ADD CONSTRAINT "po_source_links_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."po_source_links" ADD CONSTRAINT "po_source_links_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "public"."purchase_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."po_source_links" ADD CONSTRAINT "po_source_links_serviceRequirementId_fkey" FOREIGN KEY ("serviceRequirementId") REFERENCES "public"."work_order_service_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."polybag_entries" ADD CONSTRAINT "polybag_entries_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "public"."style_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."polybag_entries" ADD CONSTRAINT "polybag_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."polybag_entries" ADD CONSTRAINT "polybag_entries_finishingIssueId_fkey" FOREIGN KEY ("finishingIssueId") REFERENCES "public"."finishing_issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."polybag_skus" ADD CONSTRAINT "polybag_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."polybag_skus" ADD CONSTRAINT "polybag_skus_polybagEntryId_fkey" FOREIGN KEY ("polybagEntryId") REFERENCES "public"."polybag_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."polybag_skus" ADD CONSTRAINT "polybag_skus_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processing_batch" ADD CONSTRAINT "processing_batch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processing_batch" ADD CONSTRAINT "processing_batch_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "public"."fabric_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processing_batch" ADD CONSTRAINT "processing_batch_greigeId_fkey" FOREIGN KEY ("greigeId") REFERENCES "public"."greige_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processing_batch" ADD CONSTRAINT "processing_batch_laceId_fkey" FOREIGN KEY ("laceId") REFERENCES "public"."lace_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processing_batch" ADD CONSTRAINT "processing_batch_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "public"."work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processing_delivery" ADD CONSTRAINT "processing_delivery_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."processing_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processing_delivery" ADD CONSTRAINT "processing_delivery_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "public"."challans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processing_delivery" ADD CONSTRAINT "processing_delivery_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processing_delivery" ADD CONSTRAINT "processing_delivery_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "public"."processing_stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processing_movement" ADD CONSTRAINT "processing_movement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."processing_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processing_movement" ADD CONSTRAINT "processing_movement_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "public"."challans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processing_movement" ADD CONSTRAINT "processing_movement_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processing_movement" ADD CONSTRAINT "processing_movement_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "public"."processing_stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processing_stage" ADD CONSTRAINT "processing_stage_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."processing_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processing_stage" ADD CONSTRAINT "processing_stage_processorId_fkey" FOREIGN KEY ("processorId") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processor_quantity_slabs" ADD CONSTRAINT "processor_quantity_slabs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processor_quantity_slabs" ADD CONSTRAINT "processor_quantity_slabs_processorId_fkey" FOREIGN KEY ("processorId") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processor_rate_card" ADD CONSTRAINT "processor_rate_card_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processor_rate_card" ADD CONSTRAINT "processor_rate_card_greigeId_fkey" FOREIGN KEY ("greigeId") REFERENCES "public"."greige_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processor_rate_card" ADD CONSTRAINT "processor_rate_card_laceId_fkey" FOREIGN KEY ("laceId") REFERENCES "public"."lace_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processor_rate_card" ADD CONSTRAINT "processor_rate_card_processorId_fkey" FOREIGN KEY ("processorId") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processor_rate_card" ADD CONSTRAINT "processor_rate_card_slabId_fkey" FOREIGN KEY ("slabId") REFERENCES "public"."processor_quantity_slabs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_category_master" ADD CONSTRAINT "product_category_master_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."product_category_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."production_plans" ADD CONSTRAINT "production_plans_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."production_plans" ADD CONSTRAINT "production_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."production_tracking" ADD CONSTRAINT "production_tracking_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."production_tracking" ADD CONSTRAINT "production_tracking_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "public"."work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "public"."materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_poId_fkey" FOREIGN KEY ("poId") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_costSheetGenerationId_fkey" FOREIGN KEY ("costSheetGenerationId") REFERENCES "public"."cost_sheet_po_generation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_linkedGreigePOId_fkey" FOREIGN KEY ("linkedGreigePOId") REFERENCES "public"."purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_serviceWorkOrderId_fkey" FOREIGN KEY ("serviceWorkOrderId") REFERENCES "public"."work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quality_defects" ADD CONSTRAINT "quality_defects_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "public"."quality_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quality_inspection" ADD CONSTRAINT "quality_inspection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quality_inspection" ADD CONSTRAINT "quality_inspection_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "public"."fabric_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quality_inspection" ADD CONSTRAINT "quality_inspection_fabricProcurementId_fkey" FOREIGN KEY ("fabricProcurementId") REFERENCES "public"."fabric_procurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quality_inspection" ADD CONSTRAINT "quality_inspection_fabricStockId_fkey" FOREIGN KEY ("fabricStockId") REFERENCES "public"."fabric_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quality_inspection" ADD CONSTRAINT "quality_inspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quality_inspections" ADD CONSTRAINT "quality_inspections_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quality_inspections" ADD CONSTRAINT "quality_inspections_inspectedById_fkey" FOREIGN KEY ("inspectedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quality_inspections" ADD CONSTRAINT "quality_inspections_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quality_inspections" ADD CONSTRAINT "quality_inspections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quality_inspections" ADD CONSTRAINT "quality_inspections_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "public"."work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quality_inspections_mfg" ADD CONSTRAINT "quality_inspections_mfg_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quality_inspections_mfg" ADD CONSTRAINT "quality_inspections_mfg_finishingIssueId_fkey" FOREIGN KEY ("finishingIssueId") REFERENCES "public"."finishing_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quality_inspections_mfg" ADD CONSTRAINT "quality_inspections_mfg_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quality_inspections_mfg" ADD CONSTRAINT "quality_inspections_mfg_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "public"."work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotation_items" ADD CONSTRAINT "quotation_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "public"."quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotation_items" ADD CONSTRAINT "quotation_items_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotations" ADD CONSTRAINT "quotations_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotations" ADD CONSTRAINT "quotations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotations" ADD CONSTRAINT "quotations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotations" ADD CONSTRAINT "quotations_placeOfSupplyId_fkey" FOREIGN KEY ("placeOfSupplyId") REFERENCES "public"."indian_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requirement_po_links" ADD CONSTRAINT "requirement_po_links_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "public"."purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requirement_po_links" ADD CONSTRAINT "requirement_po_links_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "public"."purchase_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requirement_po_links" ADD CONSTRAINT "requirement_po_links_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "public"."material_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ribbon_master" ADD CONSTRAINT "ribbon_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ribbon_master" ADD CONSTRAINT "ribbon_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sample_colorways" ADD CONSTRAINT "sample_colorways_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sample_colorways" ADD CONSTRAINT "sample_colorways_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "public"."samples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sample_colorways" ADD CONSTRAINT "sample_colorways_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."size_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sample_measurements" ADD CONSTRAINT "sample_measurements_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "public"."samples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sample_measurements" ADD CONSTRAINT "sample_measurements_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."size_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sample_size_sets" ADD CONSTRAINT "sample_size_sets_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sample_size_sets" ADD CONSTRAINT "sample_size_sets_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "public"."samples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sample_size_sets" ADD CONSTRAINT "sample_size_sets_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."samples" ADD CONSTRAINT "samples_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."samples" ADD CONSTRAINT "samples_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."samples" ADD CONSTRAINT "samples_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sequin_master" ADD CONSTRAINT "sequin_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sequin_master" ADD CONSTRAINT "sequin_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."service_requirement_po_links" ADD CONSTRAINT "service_requirement_po_links_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "public"."purchase_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."service_requirement_po_links" ADD CONSTRAINT "service_requirement_po_links_serviceRequirementId_fkey" FOREIGN KEY ("serviceRequirementId") REFERENCES "public"."work_order_service_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."size_options" ADD CONSTRAINT "size_options_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."snap_button_master" ADD CONSTRAINT "snap_button_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."snap_button_master" ADD CONSTRAINT "snap_button_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stage_receipt_skus" ADD CONSTRAINT "stage_receipt_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stage_receipt_skus" ADD CONSTRAINT "stage_receipt_skus_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stage_receipt_skus" ADD CONSTRAINT "stage_receipt_skus_stageReceiptId_fkey" FOREIGN KEY ("stageReceiptId") REFERENCES "public"."stage_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stage_receipts" ADD CONSTRAINT "stage_receipts_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stage_receipts" ADD CONSTRAINT "stage_receipts_transferSlipId_fkey" FOREIGN KEY ("transferSlipId") REFERENCES "public"."transfer_slips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stage_receipts" ADD CONSTRAINT "stage_receipts_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "public"."work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stage_transition_overrides" ADD CONSTRAINT "stage_transition_overrides_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "public"."order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stage_transition_overrides" ADD CONSTRAINT "stage_transition_overrides_overriddenById_fkey" FOREIGN KEY ("overriddenById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stage_transition_overrides" ADD CONSTRAINT "stage_transition_overrides_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "public"."samples"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stage_transition_overrides" ADD CONSTRAINT "stage_transition_overrides_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "public"."work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stitching_daily_outputs" ADD CONSTRAINT "stitching_daily_outputs_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "public"."style_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stitching_daily_outputs" ADD CONSTRAINT "stitching_daily_outputs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stitching_daily_outputs" ADD CONSTRAINT "stitching_daily_outputs_stitchingIssueId_fkey" FOREIGN KEY ("stitchingIssueId") REFERENCES "public"."stitching_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stitching_issue_components" ADD CONSTRAINT "stitching_issue_components_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "public"."style_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stitching_issue_components" ADD CONSTRAINT "stitching_issue_components_stitchingIssueId_fkey" FOREIGN KEY ("stitchingIssueId") REFERENCES "public"."stitching_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stitching_issue_skus" ADD CONSTRAINT "stitching_issue_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stitching_issue_skus" ADD CONSTRAINT "stitching_issue_skus_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stitching_issue_skus" ADD CONSTRAINT "stitching_issue_skus_stitchingIssueId_fkey" FOREIGN KEY ("stitchingIssueId") REFERENCES "public"."stitching_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stitching_issues" ADD CONSTRAINT "stitching_issues_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stitching_issues" ADD CONSTRAINT "stitching_issues_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stitching_issues" ADD CONSTRAINT "stitching_issues_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stitching_issues" ADD CONSTRAINT "stitching_issues_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "public"."work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stitching_output_skus" ADD CONSTRAINT "stitching_output_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stitching_output_skus" ADD CONSTRAINT "stitching_output_skus_dailyOutputId_fkey" FOREIGN KEY ("dailyOutputId") REFERENCES "public"."stitching_daily_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stitching_output_skus" ADD CONSTRAINT "stitching_output_skus_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_count_items" ADD CONSTRAINT "stock_count_items_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "public"."materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_count_items" ADD CONSTRAINT "stock_count_items_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES "public"."stock_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_counts" ADD CONSTRAINT "stock_counts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "public"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_levels" ADD CONSTRAINT "stock_levels_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "public"."materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_levels" ADD CONSTRAINT "stock_levels_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "public"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_movements" ADD CONSTRAINT "stock_movements_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "public"."materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_movements" ADD CONSTRAINT "stock_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "public"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_reservations" ADD CONSTRAINT "stock_reservations_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "public"."materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_reservations" ADD CONSTRAINT "stock_reservations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "public"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_transactions" ADD CONSTRAINT "stock_transactions_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "public"."materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_accessories" ADD CONSTRAINT "style_accessories_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "public"."style_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_comments" ADD CONSTRAINT "style_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."style_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_comments" ADD CONSTRAINT "style_comments_style_id_fkey" FOREIGN KEY ("style_id") REFERENCES "public"."styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_comments" ADD CONSTRAINT "style_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_components" ADD CONSTRAINT "style_components_component_master_id_fkey" FOREIGN KEY ("component_master_id") REFERENCES "public"."component_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_components" ADD CONSTRAINT "style_components_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing" ADD CONSTRAINT "style_costing_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing" ADD CONSTRAINT "style_costing_copied_from_costing_id_fkey" FOREIGN KEY ("copied_from_costing_id") REFERENCES "public"."style_costing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing" ADD CONSTRAINT "style_costing_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing" ADD CONSTRAINT "style_costing_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing" ADD CONSTRAINT "style_costing_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "public"."order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing" ADD CONSTRAINT "style_costing_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing" ADD CONSTRAINT "style_costing_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "public"."style_costing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing" ADD CONSTRAINT "style_costing_variance_approved_by_fkey" FOREIGN KEY ("variance_approved_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing_fabric_items" ADD CONSTRAINT "style_costing_fabric_items_costingId_fkey" FOREIGN KEY ("costingId") REFERENCES "public"."style_costing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing_fabric_items" ADD CONSTRAINT "style_costing_fabric_items_fabricCADId_fkey" FOREIGN KEY ("fabricCADId") REFERENCES "public"."fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing_fabric_items" ADD CONSTRAINT "style_costing_fabric_items_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "public"."fabric_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing_fabric_items" ADD CONSTRAINT "style_costing_fabric_items_greigeId_fkey" FOREIGN KEY ("greigeId") REFERENCES "public"."greige_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing_fabric_items" ADD CONSTRAINT "style_costing_fabric_items_processorId_fkey" FOREIGN KEY ("processorId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing_fabric_items" ADD CONSTRAINT "style_costing_fabric_items_procurementId_fkey" FOREIGN KEY ("procurementId") REFERENCES "public"."fabric_procurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing_fabric_items" ADD CONSTRAINT "style_costing_fabric_items_rateCardId_fkey" FOREIGN KEY ("rateCardId") REFERENCES "public"."processor_rate_card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing_fabric_items" ADD CONSTRAINT "style_costing_fabric_items_stockLotId_fkey" FOREIGN KEY ("stockLotId") REFERENCES "public"."fabric_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing_lace_items" ADD CONSTRAINT "style_costing_lace_items_costingId_fkey" FOREIGN KEY ("costingId") REFERENCES "public"."style_costing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing_lace_items" ADD CONSTRAINT "style_costing_lace_items_greigeLaceId_fkey" FOREIGN KEY ("greigeLaceId") REFERENCES "public"."lace_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing_lace_items" ADD CONSTRAINT "style_costing_lace_items_labDipId_fkey" FOREIGN KEY ("labDipId") REFERENCES "public"."lace_lab_dip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing_lace_items" ADD CONSTRAINT "style_costing_lace_items_laceId_fkey" FOREIGN KEY ("laceId") REFERENCES "public"."lace_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing_lace_items" ADD CONSTRAINT "style_costing_lace_items_processorId_fkey" FOREIGN KEY ("processorId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing_lace_items" ADD CONSTRAINT "style_costing_lace_items_rateCardId_fkey" FOREIGN KEY ("rateCardId") REFERENCES "public"."processor_rate_card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing_lace_items" ADD CONSTRAINT "style_costing_lace_items_stockLotId_fkey" FOREIGN KEY ("stockLotId") REFERENCES "public"."lace_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing_thread_items" ADD CONSTRAINT "style_costing_thread_items_costingId_fkey" FOREIGN KEY ("costingId") REFERENCES "public"."style_costing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_costing_thread_items" ADD CONSTRAINT "style_costing_thread_items_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."thread_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_fabrics" ADD CONSTRAINT "style_fabrics_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "public"."style_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_fabrics" ADD CONSTRAINT "style_fabrics_embroideryId_fkey" FOREIGN KEY ("embroideryId") REFERENCES "public"."embroidery_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_fabrics" ADD CONSTRAINT "style_fabrics_fabricCADId_fkey" FOREIGN KEY ("fabricCADId") REFERENCES "public"."fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_fabrics" ADD CONSTRAINT "style_fabrics_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "public"."fabric_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_fabrics" ADD CONSTRAINT "style_fabrics_selectedGreigeId_fkey" FOREIGN KEY ("selectedGreigeId") REFERENCES "public"."greige_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_images" ADD CONSTRAINT "style_images_style_id_fkey" FOREIGN KEY ("style_id") REFERENCES "public"."styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_label_size_config" ADD CONSTRAINT "style_label_size_config_styleMaterialBomId_fkey" FOREIGN KEY ("styleMaterialBomId") REFERENCES "public"."style_material_bom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_material_bom" ADD CONSTRAINT "style_material_bom_buttonId_fkey" FOREIGN KEY ("buttonId") REFERENCES "public"."button_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_material_bom" ADD CONSTRAINT "style_material_bom_elasticId_fkey" FOREIGN KEY ("elasticId") REFERENCES "public"."elastic_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_material_bom" ADD CONSTRAINT "style_material_bom_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "public"."label_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_material_bom" ADD CONSTRAINT "style_material_bom_laceId_fkey" FOREIGN KEY ("laceId") REFERENCES "public"."lace_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_material_bom" ADD CONSTRAINT "style_material_bom_machinePartId_fkey" FOREIGN KEY ("machinePartId") REFERENCES "public"."machine_part_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_material_bom" ADD CONSTRAINT "style_material_bom_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "public"."materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_material_bom" ADD CONSTRAINT "style_material_bom_otherMaterialId_fkey" FOREIGN KEY ("otherMaterialId") REFERENCES "public"."other_material_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_material_bom" ADD CONSTRAINT "style_material_bom_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "public"."packaging_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_material_bom" ADD CONSTRAINT "style_material_bom_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_material_bom" ADD CONSTRAINT "style_material_bom_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."thread_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_material_bom" ADD CONSTRAINT "style_material_bom_zipperId_fkey" FOREIGN KEY ("zipperId") REFERENCES "public"."zipper_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_packaging" ADD CONSTRAINT "style_packaging_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_pattern_parts" ADD CONSTRAINT "style_pattern_parts_pattern_part_id_fkey" FOREIGN KEY ("pattern_part_id") REFERENCES "public"."pattern_part_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_pattern_parts" ADD CONSTRAINT "style_pattern_parts_style_fabric_id_fkey" FOREIGN KEY ("style_fabric_id") REFERENCES "public"."style_fabrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_processes" ADD CONSTRAINT "style_processes_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_processes" ADD CONSTRAINT "style_processes_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_production_tracking" ADD CONSTRAINT "style_production_tracking_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_tech_specs" ADD CONSTRAINT "style_tech_specs_style_id_fkey" FOREIGN KEY ("style_id") REFERENCES "public"."styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_value_additions" ADD CONSTRAINT "style_value_additions_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_variants" ADD CONSTRAINT "style_variants_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."color_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_variants" ADD CONSTRAINT "style_variants_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."size_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."style_variants" ADD CONSTRAINT "style_variants_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."styles" ADD CONSTRAINT "styles_brandCategoryId_fkey" FOREIGN KEY ("brandCategoryId") REFERENCES "public"."brand_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."styles" ADD CONSTRAINT "styles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."style_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."styles" ADD CONSTRAINT "styles_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."styles" ADD CONSTRAINT "styles_product_category_id_fkey" FOREIGN KEY ("product_category_id") REFERENCES "public"."product_category_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."styles" ADD CONSTRAINT "styles_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."season_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_gst_numbers" ADD CONSTRAINT "supplier_gst_numbers_billingCityId_fkey" FOREIGN KEY ("billingCityId") REFERENCES "public"."indian_cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_gst_numbers" ADD CONSTRAINT "supplier_gst_numbers_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "public"."indian_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_gst_numbers" ADD CONSTRAINT "supplier_gst_numbers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."suppliers" ADD CONSTRAINT "suppliers_billingCityId_fkey" FOREIGN KEY ("billingCityId") REFERENCES "public"."indian_cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."suppliers" ADD CONSTRAINT "suppliers_billingStateId_fkey" FOREIGN KEY ("billingStateId") REFERENCES "public"."indian_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."suppliers" ADD CONSTRAINT "suppliers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."suppliers" ADD CONSTRAINT "suppliers_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "public"."currencies"("currencyCode") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."suppliers" ADD CONSTRAINT "suppliers_paymentTermsId_fkey" FOREIGN KEY ("paymentTermsId") REFERENCES "public"."payment_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."suppliers" ADD CONSTRAINT "suppliers_shippingCityId_fkey" FOREIGN KEY ("shippingCityId") REFERENCES "public"."indian_cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."suppliers" ADD CONSTRAINT "suppliers_shippingStateId_fkey" FOREIGN KEY ("shippingStateId") REFERENCES "public"."indian_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tax_masters" ADD CONSTRAINT "tax_masters_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."test_templates" ADD CONSTRAINT "test_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."testing_labs" ADD CONSTRAINT "testing_labs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."thread_master" ADD CONSTRAINT "thread_master_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."color_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."thread_master" ADD CONSTRAINT "thread_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."thread_master" ADD CONSTRAINT "thread_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."thread_style_associations" ADD CONSTRAINT "thread_style_associations_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."thread_style_associations" ADD CONSTRAINT "thread_style_associations_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."thread_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."thread_suppliers" ADD CONSTRAINT "thread_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."thread_suppliers" ADD CONSTRAINT "thread_suppliers_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."thread_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transfer_slip_skus" ADD CONSTRAINT "transfer_slip_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transfer_slip_skus" ADD CONSTRAINT "transfer_slip_skus_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transfer_slip_skus" ADD CONSTRAINT "transfer_slip_skus_transferSlipId_fkey" FOREIGN KEY ("transferSlipId") REFERENCES "public"."transfer_slips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transfer_slips" ADD CONSTRAINT "transfer_slips_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "public"."style_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transfer_slips" ADD CONSTRAINT "transfer_slips_cuttingBatchId_fkey" FOREIGN KEY ("cuttingBatchId") REFERENCES "public"."cutting_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transfer_slips" ADD CONSTRAINT "transfer_slips_issuedToId_fkey" FOREIGN KEY ("issuedToId") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transfer_slips" ADD CONSTRAINT "transfer_slips_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transfer_slips" ADD CONSTRAINT "transfer_slips_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transfer_slips" ADD CONSTRAINT "transfer_slips_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "public"."work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."velcro_master" ADD CONSTRAINT "velcro_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."velcro_master" ADD CONSTRAINT "velcro_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."warehouses" ADD CONSTRAINT "warehouses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_order_breakup" ADD CONSTRAINT "work_order_breakup_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."color_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_order_breakup" ADD CONSTRAINT "work_order_breakup_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_order_breakup" ADD CONSTRAINT "work_order_breakup_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_order_service_requirements" ADD CONSTRAINT "work_order_service_requirements_assignedProcessorId_fkey" FOREIGN KEY ("assignedProcessorId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_order_service_requirements" ADD CONSTRAINT "work_order_service_requirements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_order_service_requirements" ADD CONSTRAINT "work_order_service_requirements_embroiderySendOutId_fkey" FOREIGN KEY ("embroiderySendOutId") REFERENCES "public"."embroidery_send_out"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_order_service_requirements" ADD CONSTRAINT "work_order_service_requirements_jobWorkOrderId_fkey" FOREIGN KEY ("jobWorkOrderId") REFERENCES "public"."job_work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_order_service_requirements" ADD CONSTRAINT "work_order_service_requirements_preferredProcessorId_fkey" FOREIGN KEY ("preferredProcessorId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_order_service_requirements" ADD CONSTRAINT "work_order_service_requirements_processId_fkey" FOREIGN KEY ("processId") REFERENCES "public"."style_processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_order_service_requirements" ADD CONSTRAINT "work_order_service_requirements_processingBatchId_fkey" FOREIGN KEY ("processingBatchId") REFERENCES "public"."processing_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_order_service_requirements" ADD CONSTRAINT "work_order_service_requirements_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "public"."purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_order_service_requirements" ADD CONSTRAINT "work_order_service_requirements_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_orders" ADD CONSTRAINT "work_orders_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_orders" ADD CONSTRAINT "work_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_orders" ADD CONSTRAINT "work_orders_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_orders" ADD CONSTRAINT "work_orders_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "public"."order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_orders" ADD CONSTRAINT "work_orders_parentRunId_fkey" FOREIGN KEY ("parentRunId") REFERENCES "public"."work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_orders" ADD CONSTRAINT "work_orders_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_orders" ADD CONSTRAINT "work_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_orders" ADD CONSTRAINT "work_orders_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "public"."warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."zipper_master" ADD CONSTRAINT "zipper_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."zipper_master" ADD CONSTRAINT "zipper_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."zipper_suppliers" ADD CONSTRAINT "zipper_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."zipper_suppliers" ADD CONSTRAINT "zipper_suppliers_zipperId_fkey" FOREIGN KEY ("zipperId") REFERENCES "public"."zipper_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

