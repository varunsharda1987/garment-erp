-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LaceLabDipStatus" AS ENUM ('PENDING', 'SENT_TO_PROCESSOR', 'SAMPLE_RECEIVED', 'AWAITING_BUYER_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AgeGroup" AS ENUM ('ADULT', 'KIDS_1_3Y', 'KIDS_4_7Y', 'KIDS_8_14Y');

-- CreateEnum
CREATE TYPE "CustomerCategory" AS ENUM ('DOMESTIC', 'EXPORT', 'WHOLESALER', 'RETAILER');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('BUYER');

-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('B2B', 'B2C');

-- CreateEnum
CREATE TYPE "MarketType" AS ENUM ('INTERNATIONAL', 'DOMESTIC');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'DELIVERED');

-- CreateEnum
CREATE TYPE "GRNStatus" AS ENUM ('PENDING_QC', 'ACCEPTED', 'REJECTED', 'PARTIALLY_ACCEPTED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MEN', 'WOMEN', 'KIDS', 'UNISEX');

-- CreateEnum
CREATE TYPE "StyleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CADStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'APPROVED');

-- CreateEnum
CREATE TYPE "CadPurpose" AS ENUM ('COSTING', 'RAW_MATERIAL_CALCULATION', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "CostSheetApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CostSheetPurpose" AS ENUM ('COSTING', 'RAW_MATERIAL_CALCULATION', 'PRODUCTION', 'PROCUREMENT_PRODUCTION');

-- CreateEnum
CREATE TYPE "CostSheetVarianceStatus" AS ENUM ('PENDING', 'WITHIN_BUDGET', 'REQUIRES_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OrderBOMStatus" AS ENUM ('DRAFT', 'APPROVED', 'LOCKED');

-- CreateEnum
CREATE TYPE "VarianceApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GreigeRateSource" AS ENUM ('PROCUREMENT', 'STOCK_VALUATION', 'GREIGE_MASTER', 'MANUAL_OVERRIDE');

-- CreateEnum
CREATE TYPE "FabricFinishType" AS ENUM ('DYED', 'PRINTED', 'YARN_DYED', 'RAW');

-- CreateEnum
CREATE TYPE "ProcessType" AS ENUM ('PRINTING', 'DYEING', 'EMBROIDERY', 'CUTTING', 'STITCHING', 'FINISHING', 'WASHING', 'TRANSPORTATION', 'HANDWORK', 'SMOCKING');

-- CreateEnum
CREATE TYPE "PrintingType" AS ENUM ('PIGMENT', 'PROCIAN', 'DISCHARGE', 'PIGMENT_DISCHARGE');

-- CreateEnum
CREATE TYPE "PrintDirection" AS ENUM ('ONE_WAY', 'TWO_WAY');

-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('INLINE', 'FINAL', 'AQL', 'RANDOM', 'MIDLINE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('FACTORY', 'WAREHOUSE', 'OFFICE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'WARNING', 'ALERT', 'SUCCESS');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'IN_PRODUCTION', 'COMPLETED', 'DISPATCHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CHEQUE', 'BANK_TRANSFER', 'UPI');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ProductionStage" AS ENUM ('CUTTING', 'STITCHING', 'FINISHING', 'CHECKING', 'PACKING', 'ORDER_RECEIVED', 'PENDING_COSTING', 'PENDING_GREIGE_ORDER', 'TRIMS_NOT_ORDERED', 'IN_PRINTING', 'IN_DYING', 'IN_EMBROIDERY', 'IN_HANDWORK', 'IN_CUTTING', 'IN_STITCHING', 'IN_FINISHING', 'READY_TO_SHIP', 'SHIPPED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED', 'PENDING_GREIGE', 'READY_FOR_PROCESSING');

-- CreateEnum
CREATE TYPE "POCategory" AS ENUM ('FABRIC', 'GREIGE', 'PROCESSING', 'TRIMS', 'LACE', 'GREIGE_LACE', 'LACE_PROCESSING', 'GENERAL', 'EMBROIDERY_SERVICE', 'PRINTING_SERVICE', 'DYEING_SERVICE', 'WASHING_SERVICE', 'FINISHING_SERVICE', 'CUTTING_SERVICE', 'STITCHING_SERVICE', 'HANDWORK_SERVICE', 'SMOCKING_SERVICE', 'TRANSPORTATION_SERVICE');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('EMBROIDERY', 'PRINTING', 'DYEING', 'WASHING', 'FINISHING', 'CUTTING', 'STITCHING', 'HANDWORK', 'SMOCKING', 'TRANSPORTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ServiceRequirementStatus" AS ENUM ('PENDING', 'PO_GENERATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QualityStatus" AS ENUM ('PASS', 'FAIL', 'CONDITIONAL_PASS');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RequisitionStatus" AS ENUM ('PENDING', 'ISSUED', 'RECEIVED');

-- CreateEnum
CREATE TYPE "SampleStatus" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'SENT', 'FEEDBACK_PENDING', 'REVISION_NEEDED', 'APPROVED_WITH_COMMENTS');

-- CreateEnum
CREATE TYPE "SampleType" AS ENUM ('FIT_SAMPLE', 'PHOTO_SAMPLE', 'PRODUCTION_SAMPLE', 'PP_SAMPLE', 'SIZE_SET_SAMPLE', 'SHIPMENT_SAMPLE');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SupplierCategory" AS ENUM ('FABRIC_SUPPLIER', 'TRIMS_SUPPLIER', 'THREAD_SUPPLIER', 'PACKAGING_SUPPLIER', 'LACE_SUPPLIER', 'DYEING_PRINTING', 'EMBROIDERY', 'HAND_WORK', 'SMOCKING', 'CMT_UNIT', 'FINISHING_CONTRACTOR', 'STITCHING_CONTRACTOR', 'WASHING', 'DORI_PIPING_CONTRACTOR', 'MACHINE_PARTS_SUPPLIER', 'OTHER_SERVICES');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('METER', 'PIECE', 'KILOGRAM', 'SET', 'YARD', 'DOZEN', 'GROSS', 'TUBE', 'CONE', 'SPOOL', 'BOX');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('GENERIC', 'GREIGE_FABRIC', 'FINISHED_FABRIC', 'TRIMS', 'LACE', 'BUTTON', 'THREAD', 'ZIPPER', 'ELASTIC', 'LABEL', 'PACKAGING', 'ACCESSORIES', 'SERVICE', 'MACHINE_PART', 'OTHER', 'FABRIC', 'GREIGE', 'HOOK_EYE', 'SNAP_BUTTON', 'BUCKLE', 'BELT', 'VELCRO', 'DRAWSTRING', 'RIBBON', 'SEQUIN', 'BEAD', 'MOTIF', 'INTERLINING', 'PADDING', 'OTHER_FASTENER', 'OTHER_TAPE', 'OTHER_DECORATIVE', 'OTHER_FUNCTIONAL', 'OTHER_MATERIAL');

-- CreateEnum
CREATE TYPE "MaterialUsageCategory" AS ENUM ('GARMENT_TRIM', 'VALUE_ADDITION', 'PACKAGING');

-- CreateEnum
CREATE TYPE "ThreadPackagingType" AS ENUM ('CONE', 'TUBE', 'SPOOL', 'CONE_5K', 'CONE_10K');

-- CreateEnum
CREATE TYPE "ThreadPly" AS ENUM ('TWO_PLY', 'THREE_PLY');

-- CreateEnum
CREATE TYPE "ThreadMaterial" AS ENUM ('POLYESTER', 'COTTON');

-- CreateEnum
CREATE TYPE "ThreadQuantityInput" AS ENUM ('UNITS', 'BOXES');

-- CreateEnum
CREATE TYPE "LabelCategory" AS ENUM ('SEWN_IN', 'HANGTAG', 'PRICE_TAG');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PRODUCTION_MANAGER', 'SALES', 'INVENTORY', 'ACCOUNTS', 'QUALITY', 'PURCHASE', 'FACTORY_SUPERVISOR', 'MERCHANDISER');

-- CreateEnum
CREATE TYPE "TestTemplateType" AS ENUM ('FPT', 'GPT');

-- CreateEnum
CREATE TYPE "TestResult" AS ENUM ('PENDING', 'PASS', 'FAIL', 'RETEST_REQUIRED', 'CONDITIONAL_PASS');

-- CreateEnum
CREATE TYPE "WarehouseType" AS ENUM ('RAW_MATERIAL', 'FINISHED_GOODS', 'WORK_IN_PROGRESS', 'GENERAL', 'TRANSIT', 'JOB_WORK');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('STOCK_IN', 'STOCK_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT');

-- CreateEnum
CREATE TYPE "StateType" AS ENUM ('STATE', 'UNION_TERRITORY');

-- CreateEnum
CREATE TYPE "CityTier" AS ENUM ('TIER_1', 'TIER_2', 'TIER_3');

-- CreateEnum
CREATE TYPE "ReservationType" AS ENUM ('ORDER', 'WORK_ORDER', 'MATERIAL_REQUISITION');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CountType" AS ENUM ('FULL', 'PARTIAL', 'CYCLE', 'SPOT_CHECK');

-- CreateEnum
CREATE TYPE "CountStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COUNTED', 'VERIFIED', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockTransactionType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "AccountGroup" AS ENUM ('CURRENT_ASSET', 'FIXED_ASSET', 'CURRENT_LIABILITY', 'LONG_TERM_LIABILITY', 'EQUITY', 'DIRECT_REVENUE', 'INDIRECT_REVENUE', 'DIRECT_EXPENSE', 'INDIRECT_EXPENSE', 'OVERHEAD');

-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('GST', 'IGST', 'SGST', 'CGST', 'VAT', 'CUSTOMS_DUTY', 'EXCISE_DUTY', 'SERVICE_TAX');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('DIRECT', 'INDIRECT', 'OVERHEAD', 'ADMINISTRATIVE', 'MARKETING');

-- CreateEnum
CREATE TYPE "BankAccountType" AS ENUM ('CURRENT', 'SAVINGS', 'OD', 'CC');

-- CreateEnum
CREATE TYPE "RateType" AS ENUM ('BUYING', 'SELLING', 'AVERAGE');

-- CreateEnum
CREATE TYPE "MaterialRequirementStatus" AS ENUM ('PENDING', 'FULFILLED_STOCK', 'PARTIAL_STOCK', 'PO_REQUIRED', 'PO_GENERATED', 'PO_SENT', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequirementSource" AS ENUM ('SALES_ORDER', 'WORK_ORDER', 'MANUAL');

-- CreateEnum
CREATE TYPE "CuttingBatchStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "StitchingIssueStatus" AS ENUM ('PENDING_RECEIPT', 'RECEIVED', 'ISSUED_TO_MANAGER', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "FinishingStatus" AS ENUM ('PENDING_RECEIPT', 'RECEIVED', 'IN_PROGRESS', 'PACKING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TransferSlipStatus" AS ENUM ('CREATED', 'PRINTED', 'CONFIRMED', 'RECEIVED', 'DEVIATION_RECORDED');

-- CreateEnum
CREATE TYPE "PackingType" AS ENUM ('SOLID', 'ASSORTED');

-- CreateEnum
CREATE TYPE "LabDipStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RESUBMIT');

-- CreateEnum
CREATE TYPE "JobWorkStatus" AS ENUM ('LAB_DIP_PENDING', 'LAB_DIP_SUBMITTED', 'LAB_DIP_APPROVED', 'READY_TO_SEND', 'SENT_TO_MILL', 'AT_MILL', 'RECEIVED', 'QUALITY_CHECKED', 'STOCK_UPDATED');

-- CreateEnum
CREATE TYPE "PrintMethod" AS ENUM ('SCREEN_MACHINE', 'SCREEN_HAND', 'ROTARY', 'BLOCK');

-- CreateEnum
CREATE TYPE "PrintChemistry" AS ENUM ('PIGMENT', 'PROCIAN', 'DISCHARGE');

-- CreateEnum
CREATE TYPE "ASNStatus" AS ENUM ('PENDING', 'APPLIED', 'APPROVED', 'REJECTED', 'RESCHEDULE');

-- CreateEnum
CREATE TYPE "DeliveryConfirmation" AS ENUM ('DELIVERED', 'PARTIAL', 'REJECTED');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('PASS', 'FAIL', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "AIMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'EXECUTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "FeedbackRating" AS ENUM ('HELPFUL', 'NOT_HELPFUL');

-- CreateEnum
CREATE TYPE "SeasonType" AS ENUM ('SS', 'AW');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
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
CREATE TABLE "material_master" (
    "id" SERIAL NOT NULL,
    "materialType" "MaterialType" NOT NULL,
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
CREATE TABLE "material_supplier_mapping" (
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
CREATE TABLE "order_bom" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "styleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" "OrderBOMStatus" NOT NULL DEFAULT 'DRAFT',
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
CREATE TABLE "order_bom_items" (
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

    CONSTRAINT "order_bom_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "color_master" (
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
CREATE TABLE "season_master" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "seasonType" "SeasonType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "season_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "color_options" (
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
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CustomerType" NOT NULL,
    "category" "CustomerCategory" NOT NULL,
    "businessType" "BusinessType" NOT NULL DEFAULT 'B2B',
    "market" "MarketType" NOT NULL DEFAULT 'DOMESTIC',
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
    "agentId" TEXT,
    "agentCommissionPercent" DECIMAL(5,2),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_categories" (
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
CREATE TABLE "customer_gst_numbers" (
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
CREATE TABLE "supplier_gst_numbers" (
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
CREATE TABLE "indian_states" (
    "id" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "stateType" "StateType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indian_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indian_cities" (
    "id" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "tier" "CityTier" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indian_cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_accessories_presets" (
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
CREATE TABLE "customer_accessories_preset_items" (
    "id" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "materialType" "MaterialType" NOT NULL,
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
CREATE TABLE "customer_size_category_presets" (
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
CREATE TABLE "delivery_note_items" (
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
CREATE TABLE "delivery_notes" (
    "id" TEXT NOT NULL,
    "deliveryNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vehicleNumber" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "delivery_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finished_goods_stock" (
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
CREATE TABLE "goods_receiving_notes" (
    "id" TEXT NOT NULL,
    "grnNumber" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "receivingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "status" "GRNStatus" NOT NULL DEFAULT 'PENDING_QC',
    "remarks" TEXT,
    "receivedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receiving_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grn_items" (
    "id" TEXT NOT NULL,
    "grnId" TEXT NOT NULL,
    "poItemId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "orderedQuantity" DECIMAL(10,3) NOT NULL,
    "receivedQuantity" DECIMAL(10,3) NOT NULL,
    "acceptedQuantity" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "rejectedQuantity" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "unit" "Unit" NOT NULL,
    "remarks" TEXT,

    CONSTRAINT "grn_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stock" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" "Unit" NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
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

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "locationCode" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "locationType" "LocationType" NOT NULL,
    "address" TEXT,
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_categories" (
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
CREATE TABLE "material_requisition_items" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "requiredQuantity" DECIMAL(10,3) NOT NULL,
    "issuedQuantity" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "unit" "Unit" NOT NULL,
    "remarks" TEXT,

    CONSTRAINT "material_requisition_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_requisitions" (
    "id" TEXT NOT NULL,
    "requisitionNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "requisitionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT NOT NULL,
    "receivedById" TEXT,
    "status" "RequisitionStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "material_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT,
    "specifications" TEXT,
    "unit" "Unit" NOT NULL,
    "reorderLevel" INTEGER,
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categoryData" JSONB,
    "materialType" "MaterialType" NOT NULL DEFAULT 'GENERIC',
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

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationType" "NotificationType" NOT NULL,
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
CREATE TABLE "order_item_breakup" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "colorId" TEXT,
    "sizeId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "order_item_breakup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "itemDescription" TEXT,
    "totalQuantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "deliveryDate" TIMESTAMP(3),
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "inheritInspections" BOOLEAN NOT NULL DEFAULT true,
    "inheritStyleSamples" BOOLEAN NOT NULL DEFAULT true,
    "selectedCadId" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDeliveryDate" TIMESTAMP(3) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
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
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "referenceNumber" TEXT,
    "remarks" TEXT,
    "receivedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_plans" (
    "id" TEXT NOT NULL,
    "planNumber" TEXT NOT NULL,
    "planDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "production_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_tracking" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "productionStage" "ProductionStage" NOT NULL,
    "updateDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantityCompleted" INTEGER NOT NULL,
    "remarks" TEXT,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "orderedQuantity" DECIMAL(10,3) NOT NULL,
    "receivedQuantity" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "unit" "Unit" NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "remarks" TEXT,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "poDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDeliveryDate" TIMESTAMP(3) NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(12,2),
    "paymentTerms" TEXT,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "poCategory" "POCategory" DEFAULT 'GENERAL',
    "linkedGreigePOId" TEXT,
    "costSheetGenerationId" TEXT,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_defects" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "defectType" TEXT NOT NULL,
    "defectDescription" TEXT,
    "severity" "Severity" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "image" TEXT,
    "actionTaken" TEXT,

    CONSTRAINT "quality_defects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_inspections" (
    "id" TEXT NOT NULL,
    "inspectionNumber" TEXT NOT NULL,
    "inspectionType" "InspectionType" NOT NULL,
    "workOrderId" TEXT,
    "styleId" TEXT NOT NULL,
    "inspectionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspectedQuantity" INTEGER NOT NULL,
    "passedQuantity" INTEGER NOT NULL,
    "failedQuantity" INTEGER NOT NULL,
    "reworkQuantity" INTEGER NOT NULL,
    "status" "QualityStatus" NOT NULL,
    "remarks" TEXT,
    "inspectedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "quality_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "description" TEXT,
    "totalQuantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "deliveryDays" INTEGER,
    "remarks" TEXT,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "quotationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
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
CREATE TABLE "samples" (
    "id" TEXT NOT NULL,
    "sampleNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "styleId" TEXT,
    "sampleType" "SampleType" NOT NULL,
    "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requiredDate" TIMESTAMP(3) NOT NULL,
    "completionDate" TIMESTAMP(3),
    "status" "SampleStatus" NOT NULL DEFAULT 'REQUESTED',
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
CREATE TABLE "size_options" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "sizeName" TEXT NOT NULL,
    "sizeCode" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "size_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_variants" (
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
CREATE TABLE "style_accessories" (
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
CREATE TABLE "style_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "style_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_category_master" (
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
CREATE TABLE "style_components" (
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
CREATE TABLE "style_costing" (
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
    "laceTotal" DECIMAL(10,2) DEFAULT 0,
    "valueLossPercent" DECIMAL(5,2) DEFAULT 2,
    "valueLossAmount" DECIMAL(10,2) DEFAULT 0,
    "markupPercent" DECIMAL(5,2) DEFAULT 15,
    "markupAmount" DECIMAL(10,2) DEFAULT 0,
    "subtotal" DECIMAL(15,2) DEFAULT 0,
    "totalProductCost" DECIMAL(15,2) DEFAULT 0,
    "closed_cost" DECIMAL(15,2),
    "closed_cost_currency" TEXT DEFAULT 'INR',
    "closed_cost_notes" TEXT,
    "closed_cost_approved_at" TIMESTAMP(3),
    "closed_cost_approved_by_id" TEXT,
    "costVariancePercent" DECIMAL(5,2),
    "lockedForOrders" BOOLEAN NOT NULL DEFAULT false,
    "supersededById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "versionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "versionReason" TEXT,
    "approvalStatus" "CostSheetApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionNotes" TEXT,
    "width_combination_description" TEXT,
    "width_combination_hash" TEXT,
    "orderId" TEXT,
    "orderItemId" TEXT,
    "purpose" "CostSheetPurpose" NOT NULL DEFAULT 'COSTING',
    "copied_from_costing_id" TEXT,
    "fabric_budget" DECIMAL(10,2),
    "trims_budget" DECIMAL(10,2),
    "cmt_budget" DECIMAL(10,2),
    "embroidery_budget" DECIMAL(10,2),
    "accessories_budget" DECIMAL(10,2),
    "total_budget" DECIMAL(10,2),
    "fabric_buffer_percent" DECIMAL(5,2) DEFAULT 5.0,
    "trims_buffer_percent" DECIMAL(5,2) DEFAULT 10.0,
    "cmt_buffer_percent" DECIMAL(5,2) DEFAULT 5.0,
    "embroidery_buffer_percent" DECIMAL(5,2) DEFAULT 8.0,
    "accessories_buffer_percent" DECIMAL(5,2) DEFAULT 10.0,
    "fabric_actual" DECIMAL(10,2),
    "trims_actual" DECIMAL(10,2),
    "cmt_actual" DECIMAL(10,2),
    "embroidery_actual" DECIMAL(10,2),
    "accessories_actual" DECIMAL(10,2),
    "total_actual" DECIMAL(10,2),
    "fabric_variance" DECIMAL(10,2),
    "fabric_variance_percent" DECIMAL(5,2),
    "trims_variance" DECIMAL(10,2),
    "trims_variance_percent" DECIMAL(5,2),
    "cmt_variance" DECIMAL(10,2),
    "cmt_variance_percent" DECIMAL(5,2),
    "embroidery_variance" DECIMAL(10,2),
    "embroidery_variance_percent" DECIMAL(5,2),
    "accessories_variance" DECIMAL(10,2),
    "accessories_variance_percent" DECIMAL(5,2),
    "total_variance" DECIMAL(10,2),
    "total_variance_percent" DECIMAL(5,2),
    "variance_status" "CostSheetVarianceStatus" DEFAULT 'PENDING',
    "variance_approved_by" TEXT,
    "variance_approved_at" TIMESTAMP(3),
    "variance_notes" TEXT,

    CONSTRAINT "style_costing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_sheet_po_generation" (
    "id" TEXT NOT NULL,
    "costSheetId" TEXT NOT NULL,
    "totalOrderQuantity" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT NOT NULL,
    "fabricPOId" TEXT,
    "greigePOId" TEXT,
    "processingPOId" TEXT,
    "trimsPOId" TEXT,
    "lacePOId" TEXT,
    "greigeLacePOId" TEXT,
    "laceProcessingPOId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_sheet_po_generation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_costing_fabric_items" (
    "id" TEXT NOT NULL,
    "costingId" TEXT NOT NULL,
    "fabricId" TEXT NOT NULL,
    "fabricCADId" TEXT,
    "fabricName" TEXT NOT NULL,
    "colorName" TEXT,
    "width" DECIMAL(10,2) NOT NULL,
    "cadMeters" DECIMAL(10,4) NOT NULL,
    "cadWastagePercent" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "effectiveCad" DECIMAL(10,4) NOT NULL,
    "costPerMeter" DECIMAL(10,2) NOT NULL,
    "totalCost" DECIMAL(10,2) NOT NULL,
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

    CONSTRAINT "style_costing_fabric_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_costing_lace_items" (
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
CREATE TABLE "style_fabrics" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "fabricId" TEXT,
    "fabricCADId" TEXT,
    "fabricFinishType" "FabricFinishType",
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
CREATE TABLE "embroidery_master" (
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
CREATE TABLE "embroidery_send_out" (
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
    "workOrderId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "embroidery_send_out_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_packaging" (
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
CREATE TABLE "style_processes" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "processName" TEXT NOT NULL,
    "processType" "ProcessType" NOT NULL,
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
CREATE TABLE "style_production_tracking" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "currentStage" "ProductionStage" NOT NULL,
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
    "lastUpdatedStage" "ProductionStage",
    "lastUpdatedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_production_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_value_additions" (
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
CREATE TABLE "style_material_bom" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "materialId" TEXT,
    "materialType" "MaterialType" NOT NULL,
    "laceId" TEXT,
    "buttonId" TEXT,
    "threadId" TEXT,
    "zipperId" TEXT,
    "elasticId" TEXT,
    "labelId" TEXT,
    "packagingId" TEXT,
    "usageCategory" "MaterialUsageCategory" NOT NULL,
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
CREATE TABLE "styles" (
    "id" TEXT NOT NULL,
    "styleCode" TEXT NOT NULL,
    "styleName" TEXT NOT NULL,
    "categoryId" TEXT,
    "brandCategoryId" TEXT,
    "gender" "Gender",
    "ageGroup" "AgeGroup",
    "description" TEXT,
    "specifications" TEXT,
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" "StyleStatus" NOT NULL DEFAULT 'DRAFT',
    "cadStatus" "CADStatus" NOT NULL DEFAULT 'PENDING',
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
    "seasonId" TEXT,
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

    CONSTRAINT "styles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
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
    "supplierCategories" "SupplierCategory"[],
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
CREATE TABLE "processor_quantity_slabs" (
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
CREATE TABLE "processor_rate_card" (
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
    "printingType" "PrintingType",
    "shrinkagePercent" DECIMAL(5,2),
    "screenCostPerScreen" DECIMAL(10,2),
    "screenType" TEXT,
    "laceId" TEXT,

    CONSTRAINT "processor_rate_card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "greige_suppliers" (
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
CREATE TABLE "fabric_suppliers" (
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
CREATE TABLE "material_suppliers" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL,
    "department" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_breakup" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "colorId" TEXT,
    "sizeId" TEXT NOT NULL,
    "plannedQuantity" INTEGER NOT NULL,
    "completedQuantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "work_order_breakup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "workOrderNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "locationId" TEXT,
    "plannedStartDate" TIMESTAMP(3) NOT NULL,
    "plannedEndDate" TIMESTAMP(3) NOT NULL,
    "actualStartDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "totalQuantity" INTEGER NOT NULL,
    "completedQuantity" INTEGER NOT NULL DEFAULT 0,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_service_requirements" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "processId" TEXT,
    "quantityRequired" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "preferredProcessorId" TEXT,
    "assignedProcessorId" TEXT,
    "estimatedRate" DECIMAL(10,2),
    "estimatedTotal" DECIMAL(10,2),
    "status" "ServiceRequirementStatus" NOT NULL DEFAULT 'PENDING',
    "purchaseOrderId" TEXT,
    "jobWorkOrderId" TEXT,
    "embroiderySendOutId" TEXT,
    "processingBatchId" TEXT,
    "source" "RequirementSource" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "work_order_service_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_requirement_po_links" (
    "id" TEXT NOT NULL,
    "serviceRequirementId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT NOT NULL,
    "quantityLinked" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_requirement_po_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "warehouseCode" TEXT NOT NULL,
    "warehouseName" TEXT NOT NULL,
    "warehouseType" "WarehouseType" NOT NULL,
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
CREATE TABLE "stock_levels" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" "Unit" NOT NULL,
    "reorderLevel" DECIMAL(10,3),
    "maxLevel" DECIMAL(10,3),
    "minLevel" DECIMAL(10,3),
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valuationRate" DECIMAL(10,2),
    "stockValue" DECIMAL(12,2),

    CONSTRAINT "stock_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "movementType" "MovementType" NOT NULL,
    "materialId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" "Unit" NOT NULL,
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
CREATE TABLE "stock_transactions" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "transactionType" "StockTransactionType" NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" "Unit" NOT NULL,
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
CREATE TABLE "stock_reservations" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "reservationType" "ReservationType" NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "reservedQuantity" DECIMAL(10,3) NOT NULL,
    "consumedQuantity" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "unit" "Unit" NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
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
CREATE TABLE "stock_counts" (
    "id" TEXT NOT NULL,
    "countNumber" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "countType" "CountType" NOT NULL,
    "countDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "CountStatus" NOT NULL DEFAULT 'DRAFT',
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
CREATE TABLE "stock_count_items" (
    "id" TEXT NOT NULL,
    "stockCountId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "systemQuantity" DECIMAL(10,3) NOT NULL,
    "physicalQuantity" DECIMAL(10,3),
    "variance" DECIMAL(10,3),
    "unit" "Unit" NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_count_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_requirements" (
    "id" TEXT NOT NULL,
    "requirementNumber" TEXT NOT NULL,
    "source" "RequirementSource" NOT NULL,
    "orderId" TEXT,
    "orderItemId" TEXT,
    "materialId" TEXT NOT NULL,
    "orderQuantity" INTEGER NOT NULL,
    "quantityPerUnit" DECIMAL(10,4) NOT NULL,
    "wastagePercent" DECIMAL(5,2) NOT NULL,
    "totalRequired" DECIMAL(12,3) NOT NULL,
    "unit" "Unit" NOT NULL,
    "availableStock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "allocatedFromStock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "shortfall" DECIMAL(12,3) NOT NULL,
    "preferredSupplierId" TEXT,
    "status" "MaterialRequirementStatus" NOT NULL DEFAULT 'PENDING',
    "requiredDate" TIMESTAMP(3) NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orderBomId" TEXT,
    "cadId" TEXT,
    "fabricWidth" DECIMAL(10,2),
    "splitFromId" TEXT,

    CONSTRAINT "material_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_po_links" (
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
CREATE TABLE "chart_of_accounts" (
    "id" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "accountGroup" "AccountGroup" NOT NULL,
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
CREATE TABLE "cost_centers" (
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
CREATE TABLE "expense_types" (
    "id" TEXT NOT NULL,
    "expenseCode" TEXT NOT NULL,
    "expenseName" TEXT NOT NULL,
    "expenseCategory" "ExpenseCategory" NOT NULL,
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
CREATE TABLE "tax_masters" (
    "id" TEXT NOT NULL,
    "taxCode" TEXT NOT NULL,
    "taxName" TEXT NOT NULL,
    "taxType" "TaxType" NOT NULL,
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
CREATE TABLE "payment_terms" (
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
CREATE TABLE "component_masters" (
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
CREATE TABLE "category_component_defaults" (
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
CREATE TABLE "component_group_master" (
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
CREATE TABLE "pattern_part_master" (
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
CREATE TABLE "pattern_part_groups" (
    "id" TEXT NOT NULL,
    "pattern_part_id" TEXT NOT NULL,
    "component_group_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pattern_part_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_pattern_parts" (
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
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "ifscCode" TEXT,
    "swiftCode" TEXT,
    "accountType" "BankAccountType" NOT NULL,
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
CREATE TABLE "currencies" (
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
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "rateType" "RateType" NOT NULL,
    "exchangeRate" DECIMAL(10,4) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_templates" (
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
CREATE TABLE "greige_master" (
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
CREATE TABLE "fabric_master" (
    "id" TEXT NOT NULL,
    "fabricCode" TEXT NOT NULL,
    "fabricName" TEXT NOT NULL,
    "greigeId" TEXT,
    "greigeName" TEXT,
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

    CONSTRAINT "fabric_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fabric_width_cad" (
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
    "printDirection" "PrintDirection" NOT NULL DEFAULT 'TWO_WAY',
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
    "greige_rate_source" "GreigeRateSource",
    "greige_rate_source_date" TIMESTAMP(3),
    "purpose_enum" "CadPurpose",
    "variance_approval_notes" TEXT,
    "variance_approval_status" "VarianceApprovalStatus" DEFAULT 'NOT_REQUIRED',
    "variance_approved_at" TIMESTAMP(3),
    "variance_approved_by" TEXT,
    "processing_batch_group_color_id" TEXT,
    "copied_from_id" TEXT,

    CONSTRAINT "fabric_width_cad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cad_size_breakdown" (
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
CREATE TABLE "order_item_costing" (
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
CREATE TABLE "order_samples" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "sampleType" "SampleType" NOT NULL,
    "status" "SampleStatus" NOT NULL DEFAULT 'REQUESTED',
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
CREATE TABLE "order_inspections" (
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
CREATE TABLE "fabric_procurement" (
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
CREATE TABLE "fabric_stock" (
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

    CONSTRAINT "fabric_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fabric_processing" (
    "id" TEXT NOT NULL,
    "procurementId" TEXT NOT NULL,
    "processingMillId" TEXT NOT NULL,
    "processingType" TEXT NOT NULL,
    "batchNumber" TEXT,
    "processSpecifications" TEXT,
    "greigeId" TEXT NOT NULL,
    "greigeQuantitySent" DECIMAL(10,2) NOT NULL,
    "greigeWidth" DECIMAL(10,2) NOT NULL,
    "expectedFinishedWidthMin" DECIMAL(10,2) NOT NULL,
    "expectedFinishedWidthMax" DECIMAL(10,2) NOT NULL,
    "expectedShrinkagePercent" DECIMAL(5,2) NOT NULL,
    "actualFinishedWidth" DECIMAL(10,2),
    "actualQuantityReceived" DECIMAL(10,2),
    "actualShrinkagePercent" DECIMAL(5,2),
    "processingLossMeters" DECIMAL(10,2),
    "widthVarianceInches" DECIMAL(10,2),
    "shrinkageVariancePercent" DECIMAL(5,2),
    "millAvgShrinkage" DECIMAL(5,2),
    "varianceFromMillAvg" DECIMAL(5,2),
    "greigeCost" DECIMAL(10,2) NOT NULL,
    "processingCost" DECIMAL(10,2) NOT NULL,
    "totalFinishedCost" DECIMAL(10,2) NOT NULL,
    "costPerMeter" DECIMAL(10,2) NOT NULL,
    "finishedFabricId" TEXT,
    "sentDate" TIMESTAMP(3) NOT NULL,
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
CREATE TABLE "fabric_stock_allocation" (
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
CREATE TABLE "fabric_stock_transaction" (
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
CREATE TABLE "quality_inspection" (
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
CREATE TABLE "style_import_staging" (
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
CREATE TABLE "lace_master" (
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
    "isGreige" BOOLEAN NOT NULL DEFAULT false,
    "sourceGreigeLaceId" TEXT,
    "expectedShrinkagePercent" DECIMAL(5,2),
    "costPerMeterGreige" DECIMAL(10,2),

    CONSTRAINT "lace_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "button_master" (
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
CREATE TABLE "thread_master" (
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
    "packagingType" "ThreadPackagingType",
    "piecesPerBox" INTEGER,
    "ply" "ThreadPly",
    "materialComposition" "ThreadMaterial",
    "colorId" TEXT,
    "unitsPerBox" INTEGER,

    CONSTRAINT "thread_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thread_packaging_specs" (
    "id" TEXT NOT NULL,
    "ply" "ThreadPly" NOT NULL,
    "packagingType" "ThreadPackagingType" NOT NULL,
    "unitsPerBox" INTEGER NOT NULL,
    "metersPerUnit" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thread_packaging_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_costing_thread_items" (
    "id" TEXT NOT NULL,
    "costingId" TEXT NOT NULL,
    "threadId" TEXT,
    "threadName" TEXT NOT NULL,
    "ply" "ThreadPly",
    "materialComposition" "ThreadMaterial",
    "colorName" TEXT,
    "packagingType" "ThreadPackagingType",
    "costPerGarment" DECIMAL(10,2) NOT NULL DEFAULT 4.00,
    "totalCost" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_costing_thread_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_thread_requirements" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "ply" "ThreadPly" NOT NULL,
    "materialComposition" "ThreadMaterial" NOT NULL,
    "colorId" TEXT NOT NULL,
    "colorName" TEXT NOT NULL,
    "packagingType" "ThreadPackagingType" NOT NULL,
    "inputType" "ThreadQuantityInput" NOT NULL,
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
CREATE TABLE "lace_style_associations" (
    "id" TEXT NOT NULL,
    "laceId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lace_style_associations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "button_style_associations" (
    "id" TEXT NOT NULL,
    "buttonId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "button_style_associations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thread_style_associations" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thread_style_associations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zipper_master" (
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
CREATE TABLE "elastic_master" (
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
CREATE TABLE "label_master" (
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
    "labelCategory" "LabelCategory" NOT NULL DEFAULT 'SEWN_IN',
    "customerId" TEXT,
    "fabricContent" TEXT,
    "washcareInstructions" TEXT,
    "brandCategoryId" TEXT,

    CONSTRAINT "label_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "size_categories" (
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
CREATE TABLE "label_size_variants" (
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
CREATE TABLE "packaging_master" (
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
CREATE TABLE "packaging_suppliers" (
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
CREATE TABLE "machine_part_master" (
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
CREATE TABLE "machine_part_suppliers" (
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
CREATE TABLE "other_material_master" (
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
CREATE TABLE "other_material_suppliers" (
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
CREATE TABLE "processing_batch" (
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
    "laceId" TEXT,
    "colorToApply" TEXT,
    "dyeLotNumber" TEXT,
    "shadeNote" TEXT,
    "finishedLaceId" TEXT,
    "expectedShrinkagePercent" DECIMAL(5,2),
    "workOrderId" TEXT,

    CONSTRAINT "processing_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_stage" (
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
CREATE TABLE "processing_movement" (
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

    CONSTRAINT "processing_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_delivery" (
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

    CONSTRAINT "processing_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lookup_values" (
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
CREATE TABLE "lace_suppliers" (
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
CREATE TABLE "button_suppliers" (
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
CREATE TABLE "zipper_suppliers" (
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

-- CreateTable
CREATE TABLE "thread_suppliers" (
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
CREATE TABLE "elastic_suppliers" (
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
CREATE TABLE "label_suppliers" (
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
CREATE TABLE "sample_measurements" (
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
CREATE TABLE "sample_colorways" (
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
CREATE TABLE "sample_size_sets" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "sample_size_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cutting_batches" (
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
    "status" "CuttingBatchStatus" NOT NULL DEFAULT 'PENDING',
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
CREATE TABLE "cutting_batch_skus" (
    "id" TEXT NOT NULL,
    "cuttingBatchId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
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
CREATE TABLE "cutting_batch_defects" (
    "id" TEXT NOT NULL,
    "cuttingBatchId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "defectType" TEXT NOT NULL,
    "defectQty" INTEGER NOT NULL,
    "remarks" TEXT,

    CONSTRAINT "cutting_batch_defects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_slips" (
    "id" TEXT NOT NULL,
    "slipNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "componentId" TEXT,
    "fromStage" TEXT NOT NULL,
    "toStage" TEXT NOT NULL,
    "fromDepartment" TEXT NOT NULL,
    "toDepartment" TEXT NOT NULL,
    "transferDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "TransferSlipStatus" NOT NULL DEFAULT 'CREATED',
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

    CONSTRAINT "transfer_slips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_slip_skus" (
    "id" TEXT NOT NULL,
    "transferSlipId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "transfer_slip_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_receipts" (
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
CREATE TABLE "stage_receipt_skus" (
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
CREATE TABLE "stitching_issues" (
    "id" TEXT NOT NULL,
    "issueNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "managerId" TEXT NOT NULL,
    "expectedCompletionDate" TIMESTAMP(3),
    "status" "StitchingIssueStatus" NOT NULL DEFAULT 'PENDING_RECEIPT',
    "remarks" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "stitching_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stitching_issue_components" (
    "id" TEXT NOT NULL,
    "stitchingIssueId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,

    CONSTRAINT "stitching_issue_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stitching_issue_skus" (
    "id" TEXT NOT NULL,
    "stitchingIssueId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "availableQty" INTEGER NOT NULL,
    "issuedQty" INTEGER NOT NULL,

    CONSTRAINT "stitching_issue_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stitching_daily_outputs" (
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
CREATE TABLE "stitching_output_skus" (
    "id" TEXT NOT NULL,
    "dailyOutputId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "goodQty" INTEGER NOT NULL DEFAULT 0,
    "defectQty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "stitching_output_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finishing_issues" (
    "id" TEXT NOT NULL,
    "issueNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "managerId" TEXT NOT NULL,
    "expectedCompletionDate" TIMESTAMP(3),
    "status" "FinishingStatus" NOT NULL DEFAULT 'PENDING_RECEIPT',
    "remarks" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "finishing_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finishing_issue_components" (
    "id" TEXT NOT NULL,
    "finishingIssueId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,

    CONSTRAINT "finishing_issue_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finishing_issue_skus" (
    "id" TEXT NOT NULL,
    "finishingIssueId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "availableQty" INTEGER NOT NULL,
    "issuedQty" INTEGER NOT NULL,

    CONSTRAINT "finishing_issue_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finishing_daily_outputs" (
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
CREATE TABLE "finishing_output_skus" (
    "id" TEXT NOT NULL,
    "dailyOutputId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "finishedQty" INTEGER NOT NULL DEFAULT 0,
    "defectQty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "finishing_output_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_inspections_mfg" (
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
    "status" "InspectionStatus" NOT NULL,
    "reworkRequired" INTEGER DEFAULT 0,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_inspections_mfg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "polybag_entries" (
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
CREATE TABLE "polybag_skus" (
    "id" TEXT NOT NULL,
    "polybagEntryId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "packedQty" INTEGER NOT NULL,

    CONSTRAINT "polybag_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carton_packings" (
    "id" TEXT NOT NULL,
    "cartonNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "finishingIssueId" TEXT,
    "componentId" TEXT,
    "cartonDate" TIMESTAMP(3) NOT NULL,
    "packingType" "PackingType" NOT NULL,
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
CREATE TABLE "carton_skus" (
    "id" TEXT NOT NULL,
    "cartonId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "carton_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_dips" (
    "id" TEXT NOT NULL,
    "labDipNumber" TEXT NOT NULL,
    "processType" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "fabricId" TEXT NOT NULL,
    "designArtwork" TEXT,
    "printMethod" "PrintMethod",
    "printChemistry" "PrintChemistry",
    "targetColorId" TEXT,
    "colorReference" TEXT,
    "millId" TEXT NOT NULL,
    "submissionDate" TIMESTAMP(3) NOT NULL,
    "expectedDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "status" "LabDipStatus" NOT NULL DEFAULT 'PENDING',
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
CREATE TABLE "job_work_orders" (
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
    "status" "JobWorkStatus" NOT NULL DEFAULT 'READY_TO_SEND',
    "remarks" TEXT,
    "workOrderId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "job_work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asn_applications" (
    "id" TEXT NOT NULL,
    "asnNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "plannedDispatchQty" INTEGER NOT NULL,
    "cartonsPlanned" INTEGER NOT NULL,
    "requestedShipDate" TIMESTAMP(3) NOT NULL,
    "applicationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ASNStatus" NOT NULL DEFAULT 'PENDING',
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
CREATE TABLE "asn_skus" (
    "id" TEXT NOT NULL,
    "asnId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "plannedQty" INTEGER NOT NULL,

    CONSTRAINT "asn_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_notes_ext" (
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
CREATE TABLE "dispatch_cartons" (
    "id" TEXT NOT NULL,
    "deliveryNoteExtId" TEXT NOT NULL,
    "cartonId" TEXT NOT NULL,

    CONSTRAINT "dispatch_cartons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_documents" (
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
CREATE TABLE "dispatch_transports" (
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
CREATE TABLE "dispatch_pods" (
    "id" TEXT NOT NULL,
    "deliveryNoteExtId" TEXT NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "deliveryTime" TEXT,
    "receivedBy" TEXT NOT NULL,
    "designation" TEXT,
    "customerSignOff" BOOLEAN NOT NULL DEFAULT false,
    "podDocumentUrl" TEXT,
    "deliveryStatus" "DeliveryConfirmation" NOT NULL,
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
CREATE TABLE "testing_labs" (
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
CREATE TABLE "test_templates" (
    "id" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "templateType" "TestTemplateType" NOT NULL,
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
CREATE TABLE "fabric_physical_tests" (
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
    "gsmTestResult" "TestResult" DEFAULT 'PENDING',
    "gsmVariance" DECIMAL(5,2),
    "testedConstruction" TEXT,
    "constructionTestResult" "TestResult" DEFAULT 'PENDING',
    "testedCount" TEXT,
    "countTestResult" "TestResult" DEFAULT 'PENDING',
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
    "overallTestResult" "TestResult" NOT NULL DEFAULT 'PENDING',
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
CREATE TABLE "garment_physical_tests" (
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
    "shrinkageTestResult" "TestResult" DEFAULT 'PENDING',
    "seamStrength" DECIMAL(10,2),
    "seamTestResult" "TestResult" DEFAULT 'PENDING',
    "colorFastnessWash" TEXT,
    "colorFastnessRub" TEXT,
    "colorFastnessLight" TEXT,
    "colorTestResult" "TestResult" DEFAULT 'PENDING',
    "pilling" TEXT,
    "spirality" DECIMAL(5,2),
    "apparenceAfterWash" TEXT,
    "testReportUrl" TEXT,
    "overallTestResult" "TestResult" NOT NULL DEFAULT 'PENDING',
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
CREATE TABLE "hook_eye_master" (
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
CREATE TABLE "snap_button_master" (
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
CREATE TABLE "buckle_master" (
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
CREATE TABLE "belt_master" (
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
CREATE TABLE "velcro_master" (
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
CREATE TABLE "drawstring_master" (
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
CREATE TABLE "ribbon_master" (
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
CREATE TABLE "sequin_master" (
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
CREATE TABLE "bead_master" (
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
CREATE TABLE "motif_master" (
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
CREATE TABLE "interlining_master" (
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
CREATE TABLE "padding_master" (
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
CREATE TABLE "other_fastener_master" (
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
CREATE TABLE "other_tape_master" (
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
CREATE TABLE "other_decorative_master" (
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
CREATE TABLE "other_functional_master" (
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
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AIMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "tokensUsed" INTEGER,
    "latencyMs" INTEGER,
    "actionType" TEXT,
    "actionEntity" TEXT,
    "actionPayload" JSONB,
    "actionStatus" "ActionStatus",
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_feedback" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" "FeedbackRating" NOT NULL,
    "issueType" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_transition_overrides" (
    "id" TEXT NOT NULL,
    "blockType" TEXT NOT NULL,
    "workOrderId" TEXT,
    "orderItemId" TEXT,
    "sampleId" TEXT,
    "fromStage" "ProductionStage",
    "toStage" "ProductionStage" NOT NULL,
    "blockedSampleType" "SampleType",
    "prerequisiteSampleType" "SampleType",
    "overrideReason" TEXT NOT NULL,
    "overriddenById" TEXT NOT NULL,
    "overriddenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stage_transition_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_label_size_config" (
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
CREATE TABLE "order_label_override" (
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
CREATE TABLE "order_label_size_override" (
    "id" TEXT NOT NULL,
    "orderLabelOverrideId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "barcodeValue" TEXT,
    "mrp" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_label_size_override_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_pattern_parts" (
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
CREATE TABLE "embroidery_part_cad" (
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
    "printDirection" "PrintDirection" NOT NULL DEFAULT 'TWO_WAY',
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "embroidery_part_cad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embroidery_cad_size_breakdown" (
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
CREATE TABLE "lace_stock" (
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
CREATE TABLE "lace_stock_allocation" (
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
CREATE TABLE "lace_stock_transaction" (
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
CREATE TABLE "lace_lab_dip" (
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
    "status" "LaceLabDipStatus" NOT NULL DEFAULT 'PENDING',
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
CREATE TABLE "lace_defect_log" (
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
CREATE TABLE "lace_issue_note" (
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

-- CreateIndex
CREATE INDEX "audit_logs_entityType_idx" ON "audit_logs"("entityType");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_code_key" ON "material_master"("code");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyLaceId_key" ON "material_master"("legacyLaceId");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyButtonId_key" ON "material_master"("legacyButtonId");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyThreadId_key" ON "material_master"("legacyThreadId");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyZipperId_key" ON "material_master"("legacyZipperId");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyElasticId_key" ON "material_master"("legacyElasticId");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyLabelId_key" ON "material_master"("legacyLabelId");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyPackagingId_key" ON "material_master"("legacyPackagingId");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyMachinePartId_key" ON "material_master"("legacyMachinePartId");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyHookEyeId_key" ON "material_master"("legacyHookEyeId");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacySnapButtonId_key" ON "material_master"("legacySnapButtonId");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyBuckleId_key" ON "material_master"("legacyBuckleId");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyBeltId_key" ON "material_master"("legacyBeltId");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyVelcroId_key" ON "material_master"("legacyVelcroId");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyDrawstringId_key" ON "material_master"("legacyDrawstringId");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyRibbonId_key" ON "material_master"("legacyRibbonId");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacySequinId_key" ON "material_master"("legacySequinId");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyBeadId_key" ON "material_master"("legacyBeadId");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyMotifId_key" ON "material_master"("legacyMotifId");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyInterliningId_key" ON "material_master"("legacyInterliningId");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacyPaddingId_key" ON "material_master"("legacyPaddingId");

-- CreateIndex
CREATE INDEX "material_master_materialType_idx" ON "material_master"("materialType");

-- CreateIndex
CREATE INDEX "material_master_code_idx" ON "material_master"("code");

-- CreateIndex
CREATE INDEX "material_master_isActive_idx" ON "material_master"("isActive");

-- CreateIndex
CREATE INDEX "material_master_createdById_idx" ON "material_master"("createdById");

-- CreateIndex
CREATE INDEX "material_supplier_mapping_supplierId_idx" ON "material_supplier_mapping"("supplierId");

-- CreateIndex
CREATE INDEX "material_supplier_mapping_isPrimary_idx" ON "material_supplier_mapping"("isPrimary");

-- CreateIndex
CREATE INDEX "material_supplier_mapping_isActive_idx" ON "material_supplier_mapping"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "material_supplier_mapping_materialId_supplierId_key" ON "material_supplier_mapping"("materialId", "supplierId");

-- CreateIndex
CREATE INDEX "order_bom_orderId_idx" ON "order_bom"("orderId");

-- CreateIndex
CREATE INDEX "order_bom_styleId_idx" ON "order_bom"("styleId");

-- CreateIndex
CREATE INDEX "order_bom_status_idx" ON "order_bom"("status");

-- CreateIndex
CREATE UNIQUE INDEX "order_bom_orderId_styleId_version_key" ON "order_bom"("orderId", "styleId", "version");

-- CreateIndex
CREATE INDEX "order_bom_items_orderBomId_idx" ON "order_bom_items"("orderBomId");

-- CreateIndex
CREATE INDEX "order_bom_items_materialType_idx" ON "order_bom_items"("materialType");

-- CreateIndex
CREATE INDEX "color_master_colorFamily_idx" ON "color_master"("colorFamily");

-- CreateIndex
CREATE INDEX "color_master_colorName_idx" ON "color_master"("colorName");

-- CreateIndex
CREATE INDEX "color_master_isActive_idx" ON "color_master"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "season_master_code_key" ON "season_master"("code");

-- CreateIndex
CREATE INDEX "season_master_year_seasonType_idx" ON "season_master"("year", "seasonType");

-- CreateIndex
CREATE INDEX "season_master_isActive_idx" ON "season_master"("isActive");

-- CreateIndex
CREATE INDEX "season_master_sortOrder_idx" ON "season_master"("sortOrder");

-- CreateIndex
CREATE INDEX "color_options_styleId_idx" ON "color_options"("styleId");

-- CreateIndex
CREATE INDEX "color_options_colorMasterId_idx" ON "color_options"("colorMasterId");

-- CreateIndex
CREATE INDEX "customers_code_idx" ON "customers"("code");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE INDEX "customers_billingName_idx" ON "customers"("billingName");

-- CreateIndex
CREATE INDEX "customers_brandNames_idx" ON "customers"("brandNames");

-- CreateIndex
CREATE INDEX "customers_isActive_idx" ON "customers"("isActive");

-- CreateIndex
CREATE INDEX "customers_type_idx" ON "customers"("type");

-- CreateIndex
CREATE INDEX "customers_paymentTermsId_idx" ON "customers"("paymentTermsId");

-- CreateIndex
CREATE INDEX "customers_currencyCode_idx" ON "customers"("currencyCode");

-- CreateIndex
CREATE INDEX "customers_fptTemplateId_idx" ON "customers"("fptTemplateId");

-- CreateIndex
CREATE INDEX "customers_gptTemplateId_idx" ON "customers"("gptTemplateId");

-- CreateIndex
CREATE INDEX "customers_defaultTestingLabId_idx" ON "customers"("defaultTestingLabId");

-- CreateIndex
CREATE INDEX "customers_billingStateId_idx" ON "customers"("billingStateId");

-- CreateIndex
CREATE INDEX "customers_shippingStateId_idx" ON "customers"("shippingStateId");

-- CreateIndex
CREATE INDEX "customers_agentId_idx" ON "customers"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "agents_code_key" ON "agents"("code");

-- CreateIndex
CREATE INDEX "agents_code_idx" ON "agents"("code");

-- CreateIndex
CREATE INDEX "agents_name_idx" ON "agents"("name");

-- CreateIndex
CREATE INDEX "agents_isActive_idx" ON "agents"("isActive");

-- CreateIndex
CREATE INDEX "brand_categories_customerId_idx" ON "brand_categories"("customerId");

-- CreateIndex
CREATE INDEX "brand_categories_brandName_idx" ON "brand_categories"("brandName");

-- CreateIndex
CREATE INDEX "brand_categories_productCategoryId_idx" ON "brand_categories"("productCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "brand_categories_customerId_brandName_category_subCategory__key" ON "brand_categories"("customerId", "brandName", "category", "subCategory", "subSubCategory");

-- CreateIndex
CREATE INDEX "customer_gst_numbers_customerId_idx" ON "customer_gst_numbers"("customerId");

-- CreateIndex
CREATE INDEX "customer_gst_numbers_gstNumber_idx" ON "customer_gst_numbers"("gstNumber");

-- CreateIndex
CREATE INDEX "customer_gst_numbers_stateId_idx" ON "customer_gst_numbers"("stateId");

-- CreateIndex
CREATE INDEX "customer_gst_numbers_billingCityId_idx" ON "customer_gst_numbers"("billingCityId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_gst_numbers_customerId_gstNumber_key" ON "customer_gst_numbers"("customerId", "gstNumber");

-- CreateIndex
CREATE INDEX "supplier_gst_numbers_supplierId_idx" ON "supplier_gst_numbers"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_gst_numbers_gstNumber_idx" ON "supplier_gst_numbers"("gstNumber");

-- CreateIndex
CREATE INDEX "supplier_gst_numbers_stateId_idx" ON "supplier_gst_numbers"("stateId");

-- CreateIndex
CREATE INDEX "supplier_gst_numbers_billingCityId_idx" ON "supplier_gst_numbers"("billingCityId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_gst_numbers_supplierId_gstNumber_key" ON "supplier_gst_numbers"("supplierId", "gstNumber");

-- CreateIndex
CREATE UNIQUE INDEX "indian_states_stateName_key" ON "indian_states"("stateName");

-- CreateIndex
CREATE UNIQUE INDEX "indian_states_stateCode_key" ON "indian_states"("stateCode");

-- CreateIndex
CREATE INDEX "indian_states_stateCode_idx" ON "indian_states"("stateCode");

-- CreateIndex
CREATE INDEX "indian_states_isActive_idx" ON "indian_states"("isActive");

-- CreateIndex
CREATE INDEX "indian_cities_stateId_idx" ON "indian_cities"("stateId");

-- CreateIndex
CREATE INDEX "indian_cities_isActive_idx" ON "indian_cities"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "indian_cities_stateId_cityName_key" ON "indian_cities"("stateId", "cityName");

-- CreateIndex
CREATE INDEX "customer_accessories_presets_customerId_idx" ON "customer_accessories_presets"("customerId");

-- CreateIndex
CREATE INDEX "customer_accessories_presets_isDefault_idx" ON "customer_accessories_presets"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "customer_accessories_presets_customerId_presetName_key" ON "customer_accessories_presets"("customerId", "presetName");

-- CreateIndex
CREATE INDEX "customer_accessories_preset_items_presetId_idx" ON "customer_accessories_preset_items"("presetId");

-- CreateIndex
CREATE INDEX "customer_accessories_preset_items_materialId_idx" ON "customer_accessories_preset_items"("materialId");

-- CreateIndex
CREATE INDEX "customer_accessories_preset_items_labelId_idx" ON "customer_accessories_preset_items"("labelId");

-- CreateIndex
CREATE INDEX "customer_accessories_preset_items_materialType_idx" ON "customer_accessories_preset_items"("materialType");

-- CreateIndex
CREATE INDEX "customer_size_category_presets_customerId_idx" ON "customer_size_category_presets"("customerId");

-- CreateIndex
CREATE INDEX "customer_size_category_presets_sizeCategoryId_idx" ON "customer_size_category_presets"("sizeCategoryId");

-- CreateIndex
CREATE INDEX "customer_size_category_presets_isDefault_idx" ON "customer_size_category_presets"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "customer_size_category_presets_customerId_presetName_key" ON "customer_size_category_presets"("customerId", "presetName");

-- CreateIndex
CREATE INDEX "delivery_note_items_deliveryNoteId_idx" ON "delivery_note_items"("deliveryNoteId");

-- CreateIndex
CREATE INDEX "delivery_note_items_orderItemId_idx" ON "delivery_note_items"("orderItemId");

-- CreateIndex
CREATE INDEX "delivery_notes_deliveryNumber_idx" ON "delivery_notes"("deliveryNumber");

-- CreateIndex
CREATE INDEX "delivery_notes_orderId_idx" ON "delivery_notes"("orderId");

-- CreateIndex
CREATE INDEX "delivery_notes_createdById_idx" ON "delivery_notes"("createdById");

-- CreateIndex
CREATE INDEX "delivery_notes_customerId_idx" ON "delivery_notes"("customerId");

-- CreateIndex
CREATE INDEX "finished_goods_stock_locationId_idx" ON "finished_goods_stock"("locationId");

-- CreateIndex
CREATE INDEX "finished_goods_stock_styleId_idx" ON "finished_goods_stock"("styleId");

-- CreateIndex
CREATE UNIQUE INDEX "finished_goods_stock_styleId_colorId_sizeId_locationId_key" ON "finished_goods_stock"("styleId", "colorId", "sizeId", "locationId");

-- CreateIndex
CREATE INDEX "goods_receiving_notes_grnNumber_idx" ON "goods_receiving_notes"("grnNumber");

-- CreateIndex
CREATE INDEX "goods_receiving_notes_poId_idx" ON "goods_receiving_notes"("poId");

-- CreateIndex
CREATE INDEX "goods_receiving_notes_warehouseId_idx" ON "goods_receiving_notes"("warehouseId");

-- CreateIndex
CREATE INDEX "goods_receiving_notes_receivedById_idx" ON "goods_receiving_notes"("receivedById");

-- CreateIndex
CREATE INDEX "goods_receiving_notes_approvedById_idx" ON "goods_receiving_notes"("approvedById");

-- CreateIndex
CREATE INDEX "goods_receiving_notes_supplierId_idx" ON "goods_receiving_notes"("supplierId");

-- CreateIndex
CREATE INDEX "grn_items_grnId_idx" ON "grn_items"("grnId");

-- CreateIndex
CREATE INDEX "grn_items_poItemId_idx" ON "grn_items"("poItemId");

-- CreateIndex
CREATE INDEX "inventory_stock_locationId_idx" ON "inventory_stock"("locationId");

-- CreateIndex
CREATE INDEX "inventory_stock_materialId_idx" ON "inventory_stock"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_stock_materialId_locationId_key" ON "inventory_stock"("materialId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoices_customerId_idx" ON "invoices"("customerId");

-- CreateIndex
CREATE INDEX "invoices_invoiceNumber_idx" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoices_orderId_idx" ON "invoices"("orderId");

-- CreateIndex
CREATE INDEX "invoices_placeOfSupplyId_idx" ON "invoices"("placeOfSupplyId");

-- CreateIndex
CREATE UNIQUE INDEX "locations_locationCode_key" ON "locations"("locationCode");

-- CreateIndex
CREATE INDEX "locations_locationCode_idx" ON "locations"("locationCode");

-- CreateIndex
CREATE INDEX "material_categories_parentCategoryId_idx" ON "material_categories"("parentCategoryId");

-- CreateIndex
CREATE INDEX "material_categories_level_idx" ON "material_categories"("level");

-- CreateIndex
CREATE INDEX "material_requisition_items_materialId_idx" ON "material_requisition_items"("materialId");

-- CreateIndex
CREATE INDEX "material_requisition_items_requisitionId_idx" ON "material_requisition_items"("requisitionId");

-- CreateIndex
CREATE INDEX "material_requisitions_requisitionNumber_idx" ON "material_requisitions"("requisitionNumber");

-- CreateIndex
CREATE INDEX "material_requisitions_workOrderId_idx" ON "material_requisitions"("workOrderId");

-- CreateIndex
CREATE INDEX "material_requisitions_issuedById_idx" ON "material_requisitions"("issuedById");

-- CreateIndex
CREATE INDEX "material_requisitions_receivedById_idx" ON "material_requisitions"("receivedById");

-- CreateIndex
CREATE UNIQUE INDEX "materials_sizeVariantId_key" ON "materials"("sizeVariantId");

-- CreateIndex
CREATE INDEX "materials_categoryId_idx" ON "materials"("categoryId");

-- CreateIndex
CREATE INDEX "materials_code_idx" ON "materials"("code");

-- CreateIndex
CREATE INDEX "materials_name_idx" ON "materials"("name");

-- CreateIndex
CREATE INDEX "materials_isActive_idx" ON "materials"("isActive");

-- CreateIndex
CREATE INDEX "materials_materialType_idx" ON "materials"("materialType");

-- CreateIndex
CREATE INDEX "materials_greigeId_idx" ON "materials"("greigeId");

-- CreateIndex
CREATE INDEX "materials_fabricId_idx" ON "materials"("fabricId");

-- CreateIndex
CREATE INDEX "materials_laceId_idx" ON "materials"("laceId");

-- CreateIndex
CREATE INDEX "materials_buttonId_idx" ON "materials"("buttonId");

-- CreateIndex
CREATE INDEX "materials_threadId_idx" ON "materials"("threadId");

-- CreateIndex
CREATE INDEX "materials_zipperId_idx" ON "materials"("zipperId");

-- CreateIndex
CREATE INDEX "materials_elasticId_idx" ON "materials"("elasticId");

-- CreateIndex
CREATE INDEX "materials_labelId_idx" ON "materials"("labelId");

-- CreateIndex
CREATE INDEX "materials_packagingId_idx" ON "materials"("packagingId");

-- CreateIndex
CREATE INDEX "materials_sizeVariantId_idx" ON "materials"("sizeVariantId");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "order_item_breakup_orderItemId_idx" ON "order_item_breakup"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "order_item_breakup_orderItemId_colorId_sizeId_key" ON "order_item_breakup"("orderItemId", "colorId", "sizeId");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "order_items_styleId_idx" ON "order_items"("styleId");

-- CreateIndex
CREATE INDEX "order_items_selectedCadId_idx" ON "order_items"("selectedCadId");

-- CreateIndex
CREATE INDEX "order_items_orderId_status_idx" ON "order_items"("orderId", "status");

-- CreateIndex
CREATE INDEX "order_items_styleId_status_idx" ON "order_items"("styleId", "status");

-- CreateIndex
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");

-- CreateIndex
CREATE INDEX "orders_orderNumber_idx" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_customerId_status_idx" ON "orders"("customerId", "status");

-- CreateIndex
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- CreateIndex
CREATE INDEX "payments_paymentDate_idx" ON "payments"("paymentDate");

-- CreateIndex
CREATE INDEX "production_plans_planNumber_idx" ON "production_plans"("planNumber");

-- CreateIndex
CREATE INDEX "production_plans_createdById_idx" ON "production_plans"("createdById");

-- CreateIndex
CREATE INDEX "production_plans_approvedById_idx" ON "production_plans"("approvedById");

-- CreateIndex
CREATE INDEX "production_tracking_productionStage_idx" ON "production_tracking"("productionStage");

-- CreateIndex
CREATE INDEX "production_tracking_updateDate_idx" ON "production_tracking"("updateDate");

-- CreateIndex
CREATE INDEX "production_tracking_workOrderId_idx" ON "production_tracking"("workOrderId");

-- CreateIndex
CREATE INDEX "purchase_order_items_materialId_idx" ON "purchase_order_items"("materialId");

-- CreateIndex
CREATE INDEX "purchase_order_items_poId_idx" ON "purchase_order_items"("poId");

-- CreateIndex
CREATE INDEX "purchase_orders_poNumber_idx" ON "purchase_orders"("poNumber");

-- CreateIndex
CREATE INDEX "purchase_orders_supplierId_idx" ON "purchase_orders"("supplierId");

-- CreateIndex
CREATE INDEX "purchase_orders_poCategory_idx" ON "purchase_orders"("poCategory");

-- CreateIndex
CREATE INDEX "purchase_orders_linkedGreigePOId_idx" ON "purchase_orders"("linkedGreigePOId");

-- CreateIndex
CREATE INDEX "purchase_orders_costSheetGenerationId_idx" ON "purchase_orders"("costSheetGenerationId");

-- CreateIndex
CREATE INDEX "purchase_orders_supplierId_status_idx" ON "purchase_orders"("supplierId", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_status_createdAt_idx" ON "purchase_orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX "purchase_orders_expectedDeliveryDate_idx" ON "purchase_orders"("expectedDeliveryDate");

-- CreateIndex
CREATE INDEX "quality_defects_inspectionId_idx" ON "quality_defects"("inspectionId");

-- CreateIndex
CREATE UNIQUE INDEX "quality_inspections_inspectionNumber_key" ON "quality_inspections"("inspectionNumber");

-- CreateIndex
CREATE INDEX "quality_inspections_inspectionNumber_idx" ON "quality_inspections"("inspectionNumber");

-- CreateIndex
CREATE INDEX "quality_inspections_workOrderId_idx" ON "quality_inspections"("workOrderId");

-- CreateIndex
CREATE INDEX "quotation_items_quotationId_idx" ON "quotation_items"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_items_styleId_idx" ON "quotation_items"("styleId");

-- CreateIndex
CREATE INDEX "quotations_customerId_idx" ON "quotations"("customerId");

-- CreateIndex
CREATE INDEX "quotations_quotationNumber_idx" ON "quotations"("quotationNumber");

-- CreateIndex
CREATE INDEX "quotations_placeOfSupplyId_idx" ON "quotations"("placeOfSupplyId");

-- CreateIndex
CREATE INDEX "samples_customerId_idx" ON "samples"("customerId");

-- CreateIndex
CREATE INDEX "samples_sampleNumber_idx" ON "samples"("sampleNumber");

-- CreateIndex
CREATE INDEX "size_options_styleId_idx" ON "size_options"("styleId");

-- CreateIndex
CREATE UNIQUE INDEX "style_variants_sku_key" ON "style_variants"("sku");

-- CreateIndex
CREATE INDEX "style_variants_styleId_idx" ON "style_variants"("styleId");

-- CreateIndex
CREATE INDEX "style_accessories_componentId_idx" ON "style_accessories"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "style_categories_name_key" ON "style_categories"("name");

-- CreateIndex
CREATE INDEX "product_category_master_parent_id_idx" ON "product_category_master"("parent_id");

-- CreateIndex
CREATE INDEX "product_category_master_level_idx" ON "product_category_master"("level");

-- CreateIndex
CREATE INDEX "product_category_master_is_active_idx" ON "product_category_master"("is_active");

-- CreateIndex
CREATE INDEX "style_components_styleId_idx" ON "style_components"("styleId");

-- CreateIndex
CREATE INDEX "style_components_component_master_id_idx" ON "style_components"("component_master_id");

-- CreateIndex
CREATE INDEX "style_costing_styleId_version_idx" ON "style_costing"("styleId", "version");

-- CreateIndex
CREATE INDEX "style_costing_supersededById_idx" ON "style_costing"("supersededById");

-- CreateIndex
CREATE INDEX "style_costing_lockedForOrders_idx" ON "style_costing"("lockedForOrders");

-- CreateIndex
CREATE INDEX "style_costing_approvalStatus_idx" ON "style_costing"("approvalStatus");

-- CreateIndex
CREATE INDEX "style_costing_orderId_idx" ON "style_costing"("orderId");

-- CreateIndex
CREATE INDEX "style_costing_orderItemId_idx" ON "style_costing"("orderItemId");

-- CreateIndex
CREATE INDEX "style_costing_width_combination_hash_idx" ON "style_costing"("width_combination_hash");

-- CreateIndex
CREATE INDEX "style_costing_purpose_idx" ON "style_costing"("purpose");

-- CreateIndex
CREATE INDEX "style_costing_copied_from_costing_id_idx" ON "style_costing"("copied_from_costing_id");

-- CreateIndex
CREATE INDEX "style_costing_variance_status_idx" ON "style_costing"("variance_status");

-- CreateIndex
CREATE UNIQUE INDEX "style_costing_styleId_purpose_version_key" ON "style_costing"("styleId", "purpose", "version");

-- CreateIndex
CREATE UNIQUE INDEX "cost_sheet_po_generation_fabricPOId_key" ON "cost_sheet_po_generation"("fabricPOId");

-- CreateIndex
CREATE UNIQUE INDEX "cost_sheet_po_generation_greigePOId_key" ON "cost_sheet_po_generation"("greigePOId");

-- CreateIndex
CREATE UNIQUE INDEX "cost_sheet_po_generation_processingPOId_key" ON "cost_sheet_po_generation"("processingPOId");

-- CreateIndex
CREATE UNIQUE INDEX "cost_sheet_po_generation_trimsPOId_key" ON "cost_sheet_po_generation"("trimsPOId");

-- CreateIndex
CREATE UNIQUE INDEX "cost_sheet_po_generation_lacePOId_key" ON "cost_sheet_po_generation"("lacePOId");

-- CreateIndex
CREATE UNIQUE INDEX "cost_sheet_po_generation_greigeLacePOId_key" ON "cost_sheet_po_generation"("greigeLacePOId");

-- CreateIndex
CREATE UNIQUE INDEX "cost_sheet_po_generation_laceProcessingPOId_key" ON "cost_sheet_po_generation"("laceProcessingPOId");

-- CreateIndex
CREATE INDEX "cost_sheet_po_generation_costSheetId_idx" ON "cost_sheet_po_generation"("costSheetId");

-- CreateIndex
CREATE INDEX "cost_sheet_po_generation_generatedById_idx" ON "cost_sheet_po_generation"("generatedById");

-- CreateIndex
CREATE INDEX "cost_sheet_po_generation_status_idx" ON "cost_sheet_po_generation"("status");

-- CreateIndex
CREATE INDEX "style_costing_fabric_items_costingId_idx" ON "style_costing_fabric_items"("costingId");

-- CreateIndex
CREATE INDEX "style_costing_fabric_items_fabricId_idx" ON "style_costing_fabric_items"("fabricId");

-- CreateIndex
CREATE INDEX "style_costing_fabric_items_fabricCADId_idx" ON "style_costing_fabric_items"("fabricCADId");

-- CreateIndex
CREATE INDEX "style_costing_fabric_items_processorId_rateCardId_stockLotI_idx" ON "style_costing_fabric_items"("processorId", "rateCardId", "stockLotId", "sourcingStrategy");

-- CreateIndex
CREATE INDEX "style_costing_fabric_items_sourcingStrategy_idx" ON "style_costing_fabric_items"("sourcingStrategy");

-- CreateIndex
CREATE INDEX "style_costing_lace_items_costingId_idx" ON "style_costing_lace_items"("costingId");

-- CreateIndex
CREATE INDEX "style_costing_lace_items_laceId_idx" ON "style_costing_lace_items"("laceId");

-- CreateIndex
CREATE INDEX "style_costing_lace_items_greigeLaceId_idx" ON "style_costing_lace_items"("greigeLaceId");

-- CreateIndex
CREATE INDEX "style_costing_lace_items_processorId_rateCardId_stockLotId__idx" ON "style_costing_lace_items"("processorId", "rateCardId", "stockLotId", "sourcingStrategy");

-- CreateIndex
CREATE INDEX "style_costing_lace_items_sourcingStrategy_idx" ON "style_costing_lace_items"("sourcingStrategy");

-- CreateIndex
CREATE INDEX "style_costing_lace_items_labDipId_idx" ON "style_costing_lace_items"("labDipId");

-- CreateIndex
CREATE INDEX "style_fabrics_componentId_idx" ON "style_fabrics"("componentId");

-- CreateIndex
CREATE INDEX "style_fabrics_fabricId_idx" ON "style_fabrics"("fabricId");

-- CreateIndex
CREATE INDEX "style_fabrics_fabricCADId_idx" ON "style_fabrics"("fabricCADId");

-- CreateIndex
CREATE INDEX "style_fabrics_cadGroupKey_idx" ON "style_fabrics"("cadGroupKey");

-- CreateIndex
CREATE INDEX "style_fabrics_embroideryId_idx" ON "style_fabrics"("embroideryId");

-- CreateIndex
CREATE INDEX "style_fabrics_selectedGreigeId_idx" ON "style_fabrics"("selectedGreigeId");

-- CreateIndex
CREATE INDEX "embroidery_master_embroideryCode_idx" ON "embroidery_master"("embroideryCode");

-- CreateIndex
CREATE INDEX "embroidery_master_supplierId_idx" ON "embroidery_master"("supplierId");

-- CreateIndex
CREATE INDEX "embroidery_master_isActive_idx" ON "embroidery_master"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "embroidery_send_out_resultFabricStockId_key" ON "embroidery_send_out"("resultFabricStockId");

-- CreateIndex
CREATE INDEX "embroidery_send_out_sourceFabricStockId_idx" ON "embroidery_send_out"("sourceFabricStockId");

-- CreateIndex
CREATE INDEX "embroidery_send_out_embroideryId_idx" ON "embroidery_send_out"("embroideryId");

-- CreateIndex
CREATE INDEX "embroidery_send_out_supplierId_idx" ON "embroidery_send_out"("supplierId");

-- CreateIndex
CREATE INDEX "embroidery_send_out_status_idx" ON "embroidery_send_out"("status");

-- CreateIndex
CREATE INDEX "embroidery_send_out_sendDate_idx" ON "embroidery_send_out"("sendDate");

-- CreateIndex
CREATE INDEX "embroidery_send_out_forStyleId_idx" ON "embroidery_send_out"("forStyleId");

-- CreateIndex
CREATE INDEX "embroidery_send_out_forOrderId_idx" ON "embroidery_send_out"("forOrderId");

-- CreateIndex
CREATE INDEX "embroidery_send_out_workOrderId_idx" ON "embroidery_send_out"("workOrderId");

-- CreateIndex
CREATE INDEX "style_packaging_styleId_idx" ON "style_packaging"("styleId");

-- CreateIndex
CREATE INDEX "style_processes_styleId_idx" ON "style_processes"("styleId");

-- CreateIndex
CREATE INDEX "style_processes_supplierId_idx" ON "style_processes"("supplierId");

-- CreateIndex
CREATE INDEX "style_production_tracking_currentStage_idx" ON "style_production_tracking"("currentStage");

-- CreateIndex
CREATE INDEX "style_production_tracking_styleId_idx" ON "style_production_tracking"("styleId");

-- CreateIndex
CREATE INDEX "style_value_additions_styleId_idx" ON "style_value_additions"("styleId");

-- CreateIndex
CREATE INDEX "style_material_bom_styleId_idx" ON "style_material_bom"("styleId");

-- CreateIndex
CREATE INDEX "style_material_bom_materialId_idx" ON "style_material_bom"("materialId");

-- CreateIndex
CREATE INDEX "style_material_bom_usageCategory_idx" ON "style_material_bom"("usageCategory");

-- CreateIndex
CREATE INDEX "style_material_bom_materialType_idx" ON "style_material_bom"("materialType");

-- CreateIndex
CREATE INDEX "styles_customerName_idx" ON "styles"("customerName");

-- CreateIndex
CREATE INDEX "styles_categoryId_idx" ON "styles"("categoryId");

-- CreateIndex
CREATE INDEX "styles_product_category_id_idx" ON "styles"("product_category_id");

-- CreateIndex
CREATE INDEX "styles_createdAt_idx" ON "styles"("createdAt");

-- CreateIndex
CREATE INDEX "styles_styleCode_idx" ON "styles"("styleCode");

-- CreateIndex
CREATE INDEX "styles_styleName_idx" ON "styles"("styleName");

-- CreateIndex
CREATE INDEX "styles_brandName_idx" ON "styles"("brandName");

-- CreateIndex
CREATE INDEX "styles_status_idx" ON "styles"("status");

-- CreateIndex
CREATE INDEX "styles_isActive_idx" ON "styles"("isActive");

-- CreateIndex
CREATE INDEX "styles_projectGroup_idx" ON "styles"("projectGroup");

-- CreateIndex
CREATE INDEX "styles_seasonId_idx" ON "styles"("seasonId");

-- CreateIndex
CREATE INDEX "styles_cadStatus_idx" ON "styles"("cadStatus");

-- CreateIndex
CREATE INDEX "styles_internalCode_idx" ON "styles"("internalCode");

-- CreateIndex
CREATE INDEX "styles_brandCategoryId_idx" ON "styles"("brandCategoryId");

-- CreateIndex
CREATE INDEX "styles_createdById_idx" ON "styles"("createdById");

-- CreateIndex
CREATE INDEX "suppliers_code_idx" ON "suppliers"("code");

-- CreateIndex
CREATE INDEX "suppliers_name_idx" ON "suppliers"("name");

-- CreateIndex
CREATE INDEX "suppliers_isActive_idx" ON "suppliers"("isActive");

-- CreateIndex
CREATE INDEX "suppliers_supplierCategories_idx" ON "suppliers"("supplierCategories");

-- CreateIndex
CREATE INDEX "suppliers_paymentTermsId_idx" ON "suppliers"("paymentTermsId");

-- CreateIndex
CREATE INDEX "suppliers_currencyCode_idx" ON "suppliers"("currencyCode");

-- CreateIndex
CREATE INDEX "processor_quantity_slabs_processorId_processingType_idx" ON "processor_quantity_slabs"("processorId", "processingType");

-- CreateIndex
CREATE INDEX "processor_quantity_slabs_isActive_idx" ON "processor_quantity_slabs"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "processor_quantity_slabs_processorId_processingType_slabOrd_key" ON "processor_quantity_slabs"("processorId", "processingType", "slabOrder");

-- CreateIndex
CREATE INDEX "processor_rate_card_processorId_processingType_idx" ON "processor_rate_card"("processorId", "processingType");

-- CreateIndex
CREATE INDEX "processor_rate_card_processorId_processingType_printingType_idx" ON "processor_rate_card"("processorId", "processingType", "printingType");

-- CreateIndex
CREATE INDEX "processor_rate_card_greigeId_idx" ON "processor_rate_card"("greigeId");

-- CreateIndex
CREATE INDEX "processor_rate_card_laceId_idx" ON "processor_rate_card"("laceId");

-- CreateIndex
CREATE INDEX "processor_rate_card_slabId_idx" ON "processor_rate_card"("slabId");

-- CreateIndex
CREATE INDEX "processor_rate_card_isActive_idx" ON "processor_rate_card"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "processor_rate_card_processorId_processingType_printingType_key" ON "processor_rate_card"("processorId", "processingType", "printingType", "greigeId", "laceId", "slabId");

-- CreateIndex
CREATE INDEX "greige_suppliers_greigeId_idx" ON "greige_suppliers"("greigeId");

-- CreateIndex
CREATE INDEX "greige_suppliers_supplierId_idx" ON "greige_suppliers"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "greige_suppliers_greigeId_supplierId_key" ON "greige_suppliers"("greigeId", "supplierId");

-- CreateIndex
CREATE INDEX "fabric_suppliers_fabricId_idx" ON "fabric_suppliers"("fabricId");

-- CreateIndex
CREATE INDEX "fabric_suppliers_supplierId_idx" ON "fabric_suppliers"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "fabric_suppliers_fabricId_supplierId_key" ON "fabric_suppliers"("fabricId", "supplierId");

-- CreateIndex
CREATE INDEX "material_suppliers_materialId_idx" ON "material_suppliers"("materialId");

-- CreateIndex
CREATE INDEX "material_suppliers_supplierId_idx" ON "material_suppliers"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "material_suppliers_materialId_supplierId_key" ON "material_suppliers"("materialId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "work_order_breakup_workOrderId_idx" ON "work_order_breakup"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "work_order_breakup_workOrderId_colorId_sizeId_key" ON "work_order_breakup"("workOrderId", "colorId", "sizeId");

-- CreateIndex
CREATE INDEX "work_orders_locationId_idx" ON "work_orders"("locationId");

-- CreateIndex
CREATE INDEX "work_orders_orderId_idx" ON "work_orders"("orderId");

-- CreateIndex
CREATE INDEX "work_orders_status_idx" ON "work_orders"("status");

-- CreateIndex
CREATE INDEX "work_orders_workOrderNumber_idx" ON "work_orders"("workOrderNumber");

-- CreateIndex
CREATE INDEX "work_orders_orderId_status_idx" ON "work_orders"("orderId", "status");

-- CreateIndex
CREATE INDEX "work_orders_styleId_status_idx" ON "work_orders"("styleId", "status");

-- CreateIndex
CREATE INDEX "work_order_service_requirements_workOrderId_idx" ON "work_order_service_requirements"("workOrderId");

-- CreateIndex
CREATE INDEX "work_order_service_requirements_serviceType_idx" ON "work_order_service_requirements"("serviceType");

-- CreateIndex
CREATE INDEX "work_order_service_requirements_status_idx" ON "work_order_service_requirements"("status");

-- CreateIndex
CREATE INDEX "work_order_service_requirements_preferredProcessorId_idx" ON "work_order_service_requirements"("preferredProcessorId");

-- CreateIndex
CREATE INDEX "service_requirement_po_links_serviceRequirementId_idx" ON "service_requirement_po_links"("serviceRequirementId");

-- CreateIndex
CREATE INDEX "service_requirement_po_links_purchaseOrderItemId_idx" ON "service_requirement_po_links"("purchaseOrderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "service_requirement_po_links_serviceRequirementId_purchaseO_key" ON "service_requirement_po_links"("serviceRequirementId", "purchaseOrderItemId");

-- CreateIndex
CREATE INDEX "warehouses_warehouseCode_idx" ON "warehouses"("warehouseCode");

-- CreateIndex
CREATE INDEX "warehouses_warehouseType_idx" ON "warehouses"("warehouseType");

-- CreateIndex
CREATE INDEX "warehouses_createdById_idx" ON "warehouses"("createdById");

-- CreateIndex
CREATE INDEX "stock_levels_materialId_idx" ON "stock_levels"("materialId");

-- CreateIndex
CREATE INDEX "stock_levels_warehouseId_idx" ON "stock_levels"("warehouseId");

-- CreateIndex
CREATE INDEX "stock_levels_quantity_idx" ON "stock_levels"("quantity");

-- CreateIndex
CREATE UNIQUE INDEX "stock_levels_materialId_warehouseId_key" ON "stock_levels"("materialId", "warehouseId");

-- CreateIndex
CREATE INDEX "stock_movements_materialId_idx" ON "stock_movements"("materialId");

-- CreateIndex
CREATE INDEX "stock_movements_warehouseId_idx" ON "stock_movements"("warehouseId");

-- CreateIndex
CREATE INDEX "stock_movements_movementType_idx" ON "stock_movements"("movementType");

-- CreateIndex
CREATE INDEX "stock_movements_movementDate_idx" ON "stock_movements"("movementDate");

-- CreateIndex
CREATE INDEX "stock_movements_referenceType_referenceId_idx" ON "stock_movements"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "stock_transactions_materialId_idx" ON "stock_transactions"("materialId");

-- CreateIndex
CREATE INDEX "stock_transactions_warehouseId_idx" ON "stock_transactions"("warehouseId");

-- CreateIndex
CREATE INDEX "stock_transactions_transactionType_idx" ON "stock_transactions"("transactionType");

-- CreateIndex
CREATE INDEX "stock_transactions_transactionDate_idx" ON "stock_transactions"("transactionDate");

-- CreateIndex
CREATE INDEX "stock_reservations_materialId_idx" ON "stock_reservations"("materialId");

-- CreateIndex
CREATE INDEX "stock_reservations_warehouseId_idx" ON "stock_reservations"("warehouseId");

-- CreateIndex
CREATE INDEX "stock_reservations_status_idx" ON "stock_reservations"("status");

-- CreateIndex
CREATE INDEX "stock_reservations_referenceType_referenceId_idx" ON "stock_reservations"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_counts_countNumber_key" ON "stock_counts"("countNumber");

-- CreateIndex
CREATE INDEX "stock_counts_countNumber_idx" ON "stock_counts"("countNumber");

-- CreateIndex
CREATE INDEX "stock_counts_warehouseId_idx" ON "stock_counts"("warehouseId");

-- CreateIndex
CREATE INDEX "stock_counts_status_idx" ON "stock_counts"("status");

-- CreateIndex
CREATE INDEX "stock_counts_countDate_idx" ON "stock_counts"("countDate");

-- CreateIndex
CREATE INDEX "stock_count_items_stockCountId_idx" ON "stock_count_items"("stockCountId");

-- CreateIndex
CREATE INDEX "stock_count_items_materialId_idx" ON "stock_count_items"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_count_items_stockCountId_materialId_key" ON "stock_count_items"("stockCountId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX "material_requirements_requirementNumber_key" ON "material_requirements"("requirementNumber");

-- CreateIndex
CREATE INDEX "material_requirements_orderId_idx" ON "material_requirements"("orderId");

-- CreateIndex
CREATE INDEX "material_requirements_orderItemId_idx" ON "material_requirements"("orderItemId");

-- CreateIndex
CREATE INDEX "material_requirements_materialId_idx" ON "material_requirements"("materialId");

-- CreateIndex
CREATE INDEX "material_requirements_status_idx" ON "material_requirements"("status");

-- CreateIndex
CREATE INDEX "material_requirements_requiredDate_idx" ON "material_requirements"("requiredDate");

-- CreateIndex
CREATE INDEX "material_requirements_splitFromId_idx" ON "material_requirements"("splitFromId");

-- CreateIndex
CREATE INDEX "material_requirements_orderId_status_requiredDate_idx" ON "material_requirements"("orderId", "status", "requiredDate");

-- CreateIndex
CREATE INDEX "material_requirements_status_requiredDate_idx" ON "material_requirements"("status", "requiredDate");

-- CreateIndex
CREATE INDEX "material_requirements_preferredSupplierId_status_idx" ON "material_requirements"("preferredSupplierId", "status");

-- CreateIndex
CREATE INDEX "requirement_po_links_purchaseOrderId_idx" ON "requirement_po_links"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "requirement_po_links_requirementId_idx" ON "requirement_po_links"("requirementId");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_po_links_requirementId_purchaseOrderItemId_key" ON "requirement_po_links"("requirementId", "purchaseOrderItemId");

-- CreateIndex
CREATE INDEX "chart_of_accounts_accountCode_idx" ON "chart_of_accounts"("accountCode");

-- CreateIndex
CREATE INDEX "chart_of_accounts_accountType_idx" ON "chart_of_accounts"("accountType");

-- CreateIndex
CREATE INDEX "chart_of_accounts_parentAccountId_idx" ON "chart_of_accounts"("parentAccountId");

-- CreateIndex
CREATE INDEX "cost_centers_costCenterCode_idx" ON "cost_centers"("costCenterCode");

-- CreateIndex
CREATE INDEX "cost_centers_locationId_idx" ON "cost_centers"("locationId");

-- CreateIndex
CREATE INDEX "expense_types_expenseCode_idx" ON "expense_types"("expenseCode");

-- CreateIndex
CREATE INDEX "expense_types_accountId_idx" ON "expense_types"("accountId");

-- CreateIndex
CREATE INDEX "tax_masters_taxCode_idx" ON "tax_masters"("taxCode");

-- CreateIndex
CREATE INDEX "tax_masters_taxType_idx" ON "tax_masters"("taxType");

-- CreateIndex
CREATE INDEX "tax_masters_applicableFrom_idx" ON "tax_masters"("applicableFrom");

-- CreateIndex
CREATE INDEX "payment_terms_termCode_idx" ON "payment_terms"("termCode");

-- CreateIndex
CREATE UNIQUE INDEX "component_masters_name_key" ON "component_masters"("name");

-- CreateIndex
CREATE INDEX "component_masters_isActive_idx" ON "component_masters"("isActive");

-- CreateIndex
CREATE INDEX "component_masters_componentCategory_idx" ON "component_masters"("componentCategory");

-- CreateIndex
CREATE INDEX "component_masters_component_group_id_idx" ON "component_masters"("component_group_id");

-- CreateIndex
CREATE INDEX "category_component_defaults_product_category_id_idx" ON "category_component_defaults"("product_category_id");

-- CreateIndex
CREATE INDEX "category_component_defaults_component_master_id_idx" ON "category_component_defaults"("component_master_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_component_defaults_product_category_id_component_m_key" ON "category_component_defaults"("product_category_id", "component_master_id");

-- CreateIndex
CREATE INDEX "component_group_master_isActive_idx" ON "component_group_master"("isActive");

-- CreateIndex
CREATE INDEX "component_group_master_sortOrder_idx" ON "component_group_master"("sortOrder");

-- CreateIndex
CREATE INDEX "pattern_part_master_isActive_idx" ON "pattern_part_master"("isActive");

-- CreateIndex
CREATE INDEX "pattern_part_master_sortOrder_idx" ON "pattern_part_master"("sortOrder");

-- CreateIndex
CREATE INDEX "pattern_part_groups_pattern_part_id_idx" ON "pattern_part_groups"("pattern_part_id");

-- CreateIndex
CREATE INDEX "pattern_part_groups_component_group_id_idx" ON "pattern_part_groups"("component_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "pattern_part_groups_pattern_part_id_component_group_id_key" ON "pattern_part_groups"("pattern_part_id", "component_group_id");

-- CreateIndex
CREATE INDEX "component_pattern_parts_component_id_idx" ON "component_pattern_parts"("component_id");

-- CreateIndex
CREATE INDEX "component_pattern_parts_pattern_part_id_idx" ON "component_pattern_parts"("pattern_part_id");

-- CreateIndex
CREATE UNIQUE INDEX "component_pattern_parts_component_id_pattern_part_id_key" ON "component_pattern_parts"("component_id", "pattern_part_id");

-- CreateIndex
CREATE INDEX "bank_accounts_accountNumber_idx" ON "bank_accounts"("accountNumber");

-- CreateIndex
CREATE INDEX "bank_accounts_bankName_idx" ON "bank_accounts"("bankName");

-- CreateIndex
CREATE UNIQUE INDEX "currencies_currencyCode_key" ON "currencies"("currencyCode");

-- CreateIndex
CREATE INDEX "currencies_currencyCode_idx" ON "currencies"("currencyCode");

-- CreateIndex
CREATE INDEX "exchange_rates_currencyCode_idx" ON "exchange_rates"("currencyCode");

-- CreateIndex
CREATE INDEX "exchange_rates_effectiveDate_idx" ON "exchange_rates"("effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_currencyCode_effectiveDate_rateType_key" ON "exchange_rates"("currencyCode", "effectiveDate", "rateType");

-- CreateIndex
CREATE INDEX "export_templates_moduleName_idx" ON "export_templates"("moduleName");

-- CreateIndex
CREATE INDEX "export_templates_createdById_idx" ON "export_templates"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "export_templates_moduleName_templateName_key" ON "export_templates"("moduleName", "templateName");

-- CreateIndex
CREATE INDEX "greige_master_supplierId_idx" ON "greige_master"("supplierId");

-- CreateIndex
CREATE INDEX "greige_master_greigeCode_idx" ON "greige_master"("greigeCode");

-- CreateIndex
CREATE INDEX "greige_master_isActive_idx" ON "greige_master"("isActive");

-- CreateIndex
CREATE INDEX "fabric_master_fabricCode_idx" ON "fabric_master"("fabricCode");

-- CreateIndex
CREATE INDEX "fabric_master_greigeId_idx" ON "fabric_master"("greigeId");

-- CreateIndex
CREATE INDEX "fabric_master_supplierId_idx" ON "fabric_master"("supplierId");

-- CreateIndex
CREATE INDEX "fabric_master_isActive_idx" ON "fabric_master"("isActive");

-- CreateIndex
CREATE INDEX "fabric_master_styleReference_idx" ON "fabric_master"("styleReference");

-- CreateIndex
CREATE INDEX "fabric_width_cad_fabricId_idx" ON "fabric_width_cad"("fabricId");

-- CreateIndex
CREATE INDEX "fabric_width_cad_isPreferred_idx" ON "fabric_width_cad"("isPreferred");

-- CreateIndex
CREATE INDEX "fabric_width_cad_greigeId_idx" ON "fabric_width_cad"("greigeId");

-- CreateIndex
CREATE INDEX "fabric_width_cad_processorId_idx" ON "fabric_width_cad"("processorId");

-- CreateIndex
CREATE INDEX "fabric_width_cad_costingStyleId_idx" ON "fabric_width_cad"("costingStyleId");

-- CreateIndex
CREATE INDEX "fabric_width_cad_pattern_part_id_idx" ON "fabric_width_cad"("pattern_part_id");

-- CreateIndex
CREATE INDEX "fabric_width_cad_purpose_idx" ON "fabric_width_cad"("purpose");

-- CreateIndex
CREATE INDEX "fabric_width_cad_approval_status_idx" ON "fabric_width_cad"("approval_status");

-- CreateIndex
CREATE INDEX "fabric_width_cad_is_locked_idx" ON "fabric_width_cad"("is_locked");

-- CreateIndex
CREATE INDEX "fabric_width_cad_version_idx" ON "fabric_width_cad"("version");

-- CreateIndex
CREATE INDEX "fabric_width_cad_superseded_by_id_idx" ON "fabric_width_cad"("superseded_by_id");

-- CreateIndex
CREATE INDEX "fabric_width_cad_fabric_stock_id_idx" ON "fabric_width_cad"("fabric_stock_id");

-- CreateIndex
CREATE INDEX "fabric_width_cad_procurement_id_idx" ON "fabric_width_cad"("procurement_id");

-- CreateIndex
CREATE INDEX "fabric_width_cad_style_costing_id_idx" ON "fabric_width_cad"("style_costing_id");

-- CreateIndex
CREATE INDEX "fabric_width_cad_createdById_idx" ON "fabric_width_cad"("createdById");

-- CreateIndex
CREATE INDEX "fabric_width_cad_copied_from_id_idx" ON "fabric_width_cad"("copied_from_id");

-- CreateIndex
CREATE INDEX "fabric_width_cad_approved_by_idx" ON "fabric_width_cad"("approved_by");

-- CreateIndex
CREATE INDEX "fabric_width_cad_style_fabric_id_idx" ON "fabric_width_cad"("style_fabric_id");

-- CreateIndex
CREATE INDEX "fabric_width_cad_purpose_enum_idx" ON "fabric_width_cad"("purpose_enum");

-- CreateIndex
CREATE INDEX "fabric_width_cad_variance_approval_status_idx" ON "fabric_width_cad"("variance_approval_status");

-- CreateIndex
CREATE INDEX "fabric_width_cad_variance_approved_by_idx" ON "fabric_width_cad"("variance_approved_by");

-- CreateIndex
CREATE INDEX "fabric_width_cad_greige_rate_source_idx" ON "fabric_width_cad"("greige_rate_source");

-- CreateIndex
CREATE INDEX "fabric_width_cad_cloned_from_order_id_idx" ON "fabric_width_cad"("cloned_from_order_id");

-- CreateIndex
CREATE INDEX "fabric_width_cad_cloned_from_cad_id_idx" ON "fabric_width_cad"("cloned_from_cad_id");

-- CreateIndex
CREATE INDEX "fabric_width_cad_style_fabric_id_cadMeters_idx" ON "fabric_width_cad"("style_fabric_id", "cadMeters");

-- CreateIndex
CREATE INDEX "fabric_width_cad_greigeId_isPreferred_idx" ON "fabric_width_cad"("greigeId", "isPreferred");

-- CreateIndex
CREATE UNIQUE INDEX "fabric_width_cad_costingStyleId_componentName_style_fabric__key" ON "fabric_width_cad"("costingStyleId", "componentName", "style_fabric_id", "cutableWidth", "purpose", "approval_status");

-- CreateIndex
CREATE INDEX "cad_size_breakdown_cadId_idx" ON "cad_size_breakdown"("cadId");

-- CreateIndex
CREATE INDEX "cad_size_breakdown_sizeId_idx" ON "cad_size_breakdown"("sizeId");

-- CreateIndex
CREATE UNIQUE INDEX "cad_size_breakdown_cadId_sizeName_key" ON "cad_size_breakdown"("cadId", "sizeName");

-- CreateIndex
CREATE UNIQUE INDEX "order_item_costing_orderItemId_key" ON "order_item_costing"("orderItemId");

-- CreateIndex
CREATE INDEX "order_item_costing_orderItemId_idx" ON "order_item_costing"("orderItemId");

-- CreateIndex
CREATE INDEX "order_item_costing_selectedCadId_idx" ON "order_item_costing"("selectedCadId");

-- CreateIndex
CREATE INDEX "order_item_costing_baseCostingId_idx" ON "order_item_costing"("baseCostingId");

-- CreateIndex
CREATE INDEX "order_samples_orderItemId_idx" ON "order_samples"("orderItemId");

-- CreateIndex
CREATE INDEX "order_samples_sampleType_idx" ON "order_samples"("sampleType");

-- CreateIndex
CREATE INDEX "order_samples_status_idx" ON "order_samples"("status");

-- CreateIndex
CREATE INDEX "order_inspections_orderItemId_idx" ON "order_inspections"("orderItemId");

-- CreateIndex
CREATE INDEX "order_inspections_inspectionType_idx" ON "order_inspections"("inspectionType");

-- CreateIndex
CREATE INDEX "order_inspections_status_idx" ON "order_inspections"("status");

-- CreateIndex
CREATE INDEX "fabric_procurement_orderedForStyleId_idx" ON "fabric_procurement"("orderedForStyleId");

-- CreateIndex
CREATE INDEX "fabric_procurement_orderedForOrderId_idx" ON "fabric_procurement"("orderedForOrderId");

-- CreateIndex
CREATE INDEX "fabric_procurement_supplierId_idx" ON "fabric_procurement"("supplierId");

-- CreateIndex
CREATE INDEX "fabric_procurement_procurementType_idx" ON "fabric_procurement"("procurementType");

-- CreateIndex
CREATE INDEX "fabric_procurement_status_idx" ON "fabric_procurement"("status");

-- CreateIndex
CREATE INDEX "fabric_procurement_purchaseDate_idx" ON "fabric_procurement"("purchaseDate");

-- CreateIndex
CREATE INDEX "fabric_stock_fabricId_finishedWidth_cutableWidth_status_idx" ON "fabric_stock"("fabricId", "finishedWidth", "cutableWidth", "status");

-- CreateIndex
CREATE INDEX "fabric_stock_originStyleId_idx" ON "fabric_stock"("originStyleId");

-- CreateIndex
CREATE INDEX "fabric_stock_originOrderId_idx" ON "fabric_stock"("originOrderId");

-- CreateIndex
CREATE INDEX "fabric_stock_status_idx" ON "fabric_stock"("status");

-- CreateIndex
CREATE INDEX "fabric_stock_agingDays_idx" ON "fabric_stock"("agingDays");

-- CreateIndex
CREATE INDEX "fabric_stock_qualityGrade_idx" ON "fabric_stock"("qualityGrade");

-- CreateIndex
CREATE INDEX "fabric_stock_stockType_idx" ON "fabric_stock"("stockType");

-- CreateIndex
CREATE INDEX "fabric_stock_embroideryId_idx" ON "fabric_stock"("embroideryId");

-- CreateIndex
CREATE INDEX "fabric_stock_procurementId_status_idx" ON "fabric_stock"("procurementId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "fabric_stock_fabricId_procurementId_finishedWidth_cutableWi_key" ON "fabric_stock"("fabricId", "procurementId", "finishedWidth", "cutableWidth", "qualityGrade", "embroideryId");

-- CreateIndex
CREATE INDEX "fabric_processing_processingMillId_greigeId_idx" ON "fabric_processing"("processingMillId", "greigeId");

-- CreateIndex
CREATE INDEX "fabric_processing_processingStatus_idx" ON "fabric_processing"("processingStatus");

-- CreateIndex
CREATE INDEX "fabric_processing_sentDate_idx" ON "fabric_processing"("sentDate");

-- CreateIndex
CREATE INDEX "fabric_processing_procurementId_idx" ON "fabric_processing"("procurementId");

-- CreateIndex
CREATE INDEX "fabric_stock_allocation_stockId_idx" ON "fabric_stock_allocation"("stockId");

-- CreateIndex
CREATE INDEX "fabric_stock_allocation_production_cad_id_idx" ON "fabric_stock_allocation"("production_cad_id");

-- CreateIndex
CREATE INDEX "fabric_stock_allocation_orderId_idx" ON "fabric_stock_allocation"("orderId");

-- CreateIndex
CREATE INDEX "fabric_stock_allocation_styleId_idx" ON "fabric_stock_allocation"("styleId");

-- CreateIndex
CREATE INDEX "fabric_stock_allocation_allocationType_idx" ON "fabric_stock_allocation"("allocationType");

-- CreateIndex
CREATE INDEX "fabric_stock_allocation_allocationStatus_idx" ON "fabric_stock_allocation"("allocationStatus");

-- CreateIndex
CREATE INDEX "fabric_stock_transaction_stockId_idx" ON "fabric_stock_transaction"("stockId");

-- CreateIndex
CREATE INDEX "fabric_stock_transaction_transactionType_idx" ON "fabric_stock_transaction"("transactionType");

-- CreateIndex
CREATE INDEX "fabric_stock_transaction_transactionDate_idx" ON "fabric_stock_transaction"("transactionDate");

-- CreateIndex
CREATE INDEX "fabric_stock_transaction_referenceType_referenceId_idx" ON "fabric_stock_transaction"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "quality_inspection_fabricId_idx" ON "quality_inspection"("fabricId");

-- CreateIndex
CREATE INDEX "quality_inspection_qualityGrade_idx" ON "quality_inspection"("qualityGrade");

-- CreateIndex
CREATE INDEX "quality_inspection_inspectionDate_idx" ON "quality_inspection"("inspectionDate");

-- CreateIndex
CREATE INDEX "quality_inspection_inspectorId_idx" ON "quality_inspection"("inspectorId");

-- CreateIndex
CREATE INDEX "quality_inspection_inspectionType_idx" ON "quality_inspection"("inspectionType");

-- CreateIndex
CREATE INDEX "style_import_staging_importBatchId_idx" ON "style_import_staging"("importBatchId");

-- CreateIndex
CREATE INDEX "style_import_staging_status_idx" ON "style_import_staging"("status");

-- CreateIndex
CREATE INDEX "style_import_staging_styleCode_idx" ON "style_import_staging"("styleCode");

-- CreateIndex
CREATE INDEX "lace_master_laceCode_idx" ON "lace_master"("laceCode");

-- CreateIndex
CREATE INDEX "lace_master_supplierId_idx" ON "lace_master"("supplierId");

-- CreateIndex
CREATE INDEX "lace_master_isGreige_idx" ON "lace_master"("isGreige");

-- CreateIndex
CREATE INDEX "lace_master_sourceGreigeLaceId_idx" ON "lace_master"("sourceGreigeLaceId");

-- CreateIndex
CREATE INDEX "button_master_buttonCode_idx" ON "button_master"("buttonCode");

-- CreateIndex
CREATE INDEX "button_master_supplierId_idx" ON "button_master"("supplierId");

-- CreateIndex
CREATE INDEX "thread_master_threadCode_idx" ON "thread_master"("threadCode");

-- CreateIndex
CREATE INDEX "thread_master_supplierId_idx" ON "thread_master"("supplierId");

-- CreateIndex
CREATE INDEX "thread_master_ply_idx" ON "thread_master"("ply");

-- CreateIndex
CREATE INDEX "thread_master_materialComposition_idx" ON "thread_master"("materialComposition");

-- CreateIndex
CREATE INDEX "thread_master_packagingType_idx" ON "thread_master"("packagingType");

-- CreateIndex
CREATE INDEX "thread_master_colorId_idx" ON "thread_master"("colorId");

-- CreateIndex
CREATE INDEX "thread_packaging_specs_ply_idx" ON "thread_packaging_specs"("ply");

-- CreateIndex
CREATE INDEX "thread_packaging_specs_packagingType_idx" ON "thread_packaging_specs"("packagingType");

-- CreateIndex
CREATE UNIQUE INDEX "thread_packaging_specs_ply_packagingType_key" ON "thread_packaging_specs"("ply", "packagingType");

-- CreateIndex
CREATE INDEX "style_costing_thread_items_costingId_idx" ON "style_costing_thread_items"("costingId");

-- CreateIndex
CREATE INDEX "style_costing_thread_items_threadId_idx" ON "style_costing_thread_items"("threadId");

-- CreateIndex
CREATE INDEX "order_thread_requirements_orderId_idx" ON "order_thread_requirements"("orderId");

-- CreateIndex
CREATE INDEX "order_thread_requirements_threadId_idx" ON "order_thread_requirements"("threadId");

-- CreateIndex
CREATE INDEX "lace_style_associations_laceId_idx" ON "lace_style_associations"("laceId");

-- CreateIndex
CREATE INDEX "lace_style_associations_styleId_idx" ON "lace_style_associations"("styleId");

-- CreateIndex
CREATE UNIQUE INDEX "lace_style_associations_laceId_styleId_key" ON "lace_style_associations"("laceId", "styleId");

-- CreateIndex
CREATE INDEX "button_style_associations_buttonId_idx" ON "button_style_associations"("buttonId");

-- CreateIndex
CREATE INDEX "button_style_associations_styleId_idx" ON "button_style_associations"("styleId");

-- CreateIndex
CREATE UNIQUE INDEX "button_style_associations_buttonId_styleId_key" ON "button_style_associations"("buttonId", "styleId");

-- CreateIndex
CREATE INDEX "thread_style_associations_threadId_idx" ON "thread_style_associations"("threadId");

-- CreateIndex
CREATE INDEX "thread_style_associations_styleId_idx" ON "thread_style_associations"("styleId");

-- CreateIndex
CREATE UNIQUE INDEX "thread_style_associations_threadId_styleId_key" ON "thread_style_associations"("threadId", "styleId");

-- CreateIndex
CREATE INDEX "zipper_master_zipperCode_idx" ON "zipper_master"("zipperCode");

-- CreateIndex
CREATE INDEX "zipper_master_supplierId_idx" ON "zipper_master"("supplierId");

-- CreateIndex
CREATE INDEX "elastic_master_elasticCode_idx" ON "elastic_master"("elasticCode");

-- CreateIndex
CREATE INDEX "elastic_master_supplierId_idx" ON "elastic_master"("supplierId");

-- CreateIndex
CREATE INDEX "label_master_labelCode_idx" ON "label_master"("labelCode");

-- CreateIndex
CREATE INDEX "label_master_supplierId_idx" ON "label_master"("supplierId");

-- CreateIndex
CREATE INDEX "label_master_customerId_idx" ON "label_master"("customerId");

-- CreateIndex
CREATE INDEX "label_master_brandCategoryId_idx" ON "label_master"("brandCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "size_categories_name_key" ON "size_categories"("name");

-- CreateIndex
CREATE INDEX "size_categories_name_idx" ON "size_categories"("name");

-- CreateIndex
CREATE INDEX "label_size_variants_labelId_idx" ON "label_size_variants"("labelId");

-- CreateIndex
CREATE INDEX "label_size_variants_sizeCategoryId_idx" ON "label_size_variants"("sizeCategoryId");

-- CreateIndex
CREATE INDEX "label_size_variants_size_idx" ON "label_size_variants"("size");

-- CreateIndex
CREATE UNIQUE INDEX "label_size_variants_labelId_size_key" ON "label_size_variants"("labelId", "size");

-- CreateIndex
CREATE INDEX "packaging_master_packagingCode_idx" ON "packaging_master"("packagingCode");

-- CreateIndex
CREATE INDEX "packaging_master_supplierId_idx" ON "packaging_master"("supplierId");

-- CreateIndex
CREATE INDEX "packaging_master_customerId_idx" ON "packaging_master"("customerId");

-- CreateIndex
CREATE INDEX "packaging_master_brandCategoryId_idx" ON "packaging_master"("brandCategoryId");

-- CreateIndex
CREATE INDEX "packaging_suppliers_packagingId_idx" ON "packaging_suppliers"("packagingId");

-- CreateIndex
CREATE INDEX "packaging_suppliers_supplierId_idx" ON "packaging_suppliers"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "packaging_suppliers_packagingId_supplierId_key" ON "packaging_suppliers"("packagingId", "supplierId");

-- CreateIndex
CREATE INDEX "machine_part_master_partCode_idx" ON "machine_part_master"("partCode");

-- CreateIndex
CREATE INDEX "machine_part_master_supplierId_idx" ON "machine_part_master"("supplierId");

-- CreateIndex
CREATE INDEX "machine_part_suppliers_machinePartId_idx" ON "machine_part_suppliers"("machinePartId");

-- CreateIndex
CREATE INDEX "machine_part_suppliers_supplierId_idx" ON "machine_part_suppliers"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "machine_part_suppliers_machinePartId_supplierId_key" ON "machine_part_suppliers"("machinePartId", "supplierId");

-- CreateIndex
CREATE INDEX "other_material_master_materialCode_idx" ON "other_material_master"("materialCode");

-- CreateIndex
CREATE INDEX "other_material_master_supplierId_idx" ON "other_material_master"("supplierId");

-- CreateIndex
CREATE INDEX "other_material_suppliers_otherMaterialId_idx" ON "other_material_suppliers"("otherMaterialId");

-- CreateIndex
CREATE INDEX "other_material_suppliers_supplierId_idx" ON "other_material_suppliers"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "other_material_suppliers_otherMaterialId_supplierId_key" ON "other_material_suppliers"("otherMaterialId", "supplierId");

-- CreateIndex
CREATE INDEX "processing_batch_batchNumber_idx" ON "processing_batch"("batchNumber");

-- CreateIndex
CREATE INDEX "processing_batch_overallStatus_idx" ON "processing_batch"("overallStatus");

-- CreateIndex
CREATE INDEX "processing_batch_greigeId_idx" ON "processing_batch"("greigeId");

-- CreateIndex
CREATE INDEX "processing_batch_fabricId_idx" ON "processing_batch"("fabricId");

-- CreateIndex
CREATE INDEX "processing_batch_laceId_idx" ON "processing_batch"("laceId");

-- CreateIndex
CREATE INDEX "processing_batch_createdById_idx" ON "processing_batch"("createdById");

-- CreateIndex
CREATE INDEX "processing_batch_workOrderId_idx" ON "processing_batch"("workOrderId");

-- CreateIndex
CREATE INDEX "processing_stage_batchId_stageNumber_idx" ON "processing_stage"("batchId", "stageNumber");

-- CreateIndex
CREATE INDEX "processing_stage_processorId_status_idx" ON "processing_stage"("processorId", "status");

-- CreateIndex
CREATE INDEX "processing_stage_status_idx" ON "processing_stage"("status");

-- CreateIndex
CREATE INDEX "processing_movement_status_idx" ON "processing_movement"("status");

-- CreateIndex
CREATE INDEX "processing_movement_batchId_idx" ON "processing_movement"("batchId");

-- CreateIndex
CREATE INDEX "processing_movement_stageId_idx" ON "processing_movement"("stageId");

-- CreateIndex
CREATE INDEX "processing_movement_performedById_idx" ON "processing_movement"("performedById");

-- CreateIndex
CREATE UNIQUE INDEX "processing_delivery_deliveryNumber_key" ON "processing_delivery"("deliveryNumber");

-- CreateIndex
CREATE INDEX "processing_delivery_batchId_idx" ON "processing_delivery"("batchId");

-- CreateIndex
CREATE INDEX "processing_delivery_stageId_idx" ON "processing_delivery"("stageId");

-- CreateIndex
CREATE INDEX "processing_delivery_qualityStatus_idx" ON "processing_delivery"("qualityStatus");

-- CreateIndex
CREATE INDEX "processing_delivery_deliveryNumber_idx" ON "processing_delivery"("deliveryNumber");

-- CreateIndex
CREATE INDEX "processing_delivery_receivedById_idx" ON "processing_delivery"("receivedById");

-- CreateIndex
CREATE INDEX "lookup_values_category_idx" ON "lookup_values"("category");

-- CreateIndex
CREATE INDEX "lookup_values_isActive_idx" ON "lookup_values"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "lookup_values_category_value_key" ON "lookup_values"("category", "value");

-- CreateIndex
CREATE INDEX "lace_suppliers_laceId_idx" ON "lace_suppliers"("laceId");

-- CreateIndex
CREATE INDEX "lace_suppliers_supplierId_idx" ON "lace_suppliers"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "lace_suppliers_laceId_supplierId_key" ON "lace_suppliers"("laceId", "supplierId");

-- CreateIndex
CREATE INDEX "button_suppliers_buttonId_idx" ON "button_suppliers"("buttonId");

-- CreateIndex
CREATE INDEX "button_suppliers_supplierId_idx" ON "button_suppliers"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "button_suppliers_buttonId_supplierId_key" ON "button_suppliers"("buttonId", "supplierId");

-- CreateIndex
CREATE INDEX "zipper_suppliers_zipperId_idx" ON "zipper_suppliers"("zipperId");

-- CreateIndex
CREATE INDEX "zipper_suppliers_supplierId_idx" ON "zipper_suppliers"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "zipper_suppliers_zipperId_supplierId_key" ON "zipper_suppliers"("zipperId", "supplierId");

-- CreateIndex
CREATE INDEX "thread_suppliers_threadId_idx" ON "thread_suppliers"("threadId");

-- CreateIndex
CREATE INDEX "thread_suppliers_supplierId_idx" ON "thread_suppliers"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "thread_suppliers_threadId_supplierId_key" ON "thread_suppliers"("threadId", "supplierId");

-- CreateIndex
CREATE INDEX "elastic_suppliers_elasticId_idx" ON "elastic_suppliers"("elasticId");

-- CreateIndex
CREATE INDEX "elastic_suppliers_supplierId_idx" ON "elastic_suppliers"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "elastic_suppliers_elasticId_supplierId_key" ON "elastic_suppliers"("elasticId", "supplierId");

-- CreateIndex
CREATE INDEX "label_suppliers_labelId_idx" ON "label_suppliers"("labelId");

-- CreateIndex
CREATE INDEX "label_suppliers_supplierId_idx" ON "label_suppliers"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "label_suppliers_labelId_supplierId_key" ON "label_suppliers"("labelId", "supplierId");

-- CreateIndex
CREATE INDEX "sample_measurements_sampleId_idx" ON "sample_measurements"("sampleId");

-- CreateIndex
CREATE INDEX "sample_colorways_sampleId_idx" ON "sample_colorways"("sampleId");

-- CreateIndex
CREATE INDEX "sample_size_sets_sampleId_idx" ON "sample_size_sets"("sampleId");

-- CreateIndex
CREATE UNIQUE INDEX "sample_size_sets_sampleId_sizeId_colorId_key" ON "sample_size_sets"("sampleId", "sizeId", "colorId");

-- CreateIndex
CREATE INDEX "cutting_batches_workOrderId_idx" ON "cutting_batches"("workOrderId");

-- CreateIndex
CREATE INDEX "cutting_batches_componentId_idx" ON "cutting_batches"("componentId");

-- CreateIndex
CREATE INDEX "cutting_batches_fabricStockId_idx" ON "cutting_batches"("fabricStockId");

-- CreateIndex
CREATE INDEX "cutting_batches_status_idx" ON "cutting_batches"("status");

-- CreateIndex
CREATE INDEX "cutting_batches_cuttingDate_idx" ON "cutting_batches"("cuttingDate");

-- CreateIndex
CREATE INDEX "cutting_batches_workOrderId_status_idx" ON "cutting_batches"("workOrderId", "status");

-- CreateIndex
CREATE INDEX "cutting_batch_skus_cuttingBatchId_idx" ON "cutting_batch_skus"("cuttingBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "cutting_batch_skus_cuttingBatchId_colorId_sizeId_key" ON "cutting_batch_skus"("cuttingBatchId", "colorId", "sizeId");

-- CreateIndex
CREATE INDEX "cutting_batch_defects_cuttingBatchId_idx" ON "cutting_batch_defects"("cuttingBatchId");

-- CreateIndex
CREATE INDEX "transfer_slips_workOrderId_idx" ON "transfer_slips"("workOrderId");

-- CreateIndex
CREATE INDEX "transfer_slips_fromStage_toStage_idx" ON "transfer_slips"("fromStage", "toStage");

-- CreateIndex
CREATE INDEX "transfer_slips_status_idx" ON "transfer_slips"("status");

-- CreateIndex
CREATE INDEX "transfer_slip_skus_transferSlipId_idx" ON "transfer_slip_skus"("transferSlipId");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_slip_skus_transferSlipId_colorId_sizeId_key" ON "transfer_slip_skus"("transferSlipId", "colorId", "sizeId");

-- CreateIndex
CREATE INDEX "stage_receipts_workOrderId_stage_idx" ON "stage_receipts"("workOrderId", "stage");

-- CreateIndex
CREATE INDEX "stage_receipts_transferSlipId_idx" ON "stage_receipts"("transferSlipId");

-- CreateIndex
CREATE INDEX "stage_receipt_skus_stageReceiptId_idx" ON "stage_receipt_skus"("stageReceiptId");

-- CreateIndex
CREATE UNIQUE INDEX "stage_receipt_skus_stageReceiptId_colorId_sizeId_key" ON "stage_receipt_skus"("stageReceiptId", "colorId", "sizeId");

-- CreateIndex
CREATE INDEX "stitching_issues_workOrderId_idx" ON "stitching_issues"("workOrderId");

-- CreateIndex
CREATE INDEX "stitching_issues_managerId_idx" ON "stitching_issues"("managerId");

-- CreateIndex
CREATE INDEX "stitching_issues_status_idx" ON "stitching_issues"("status");

-- CreateIndex
CREATE INDEX "stitching_issues_workOrderId_status_idx" ON "stitching_issues"("workOrderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "stitching_issue_components_stitchingIssueId_componentId_key" ON "stitching_issue_components"("stitchingIssueId", "componentId");

-- CreateIndex
CREATE INDEX "stitching_issue_skus_stitchingIssueId_idx" ON "stitching_issue_skus"("stitchingIssueId");

-- CreateIndex
CREATE UNIQUE INDEX "stitching_issue_skus_stitchingIssueId_colorId_sizeId_key" ON "stitching_issue_skus"("stitchingIssueId", "colorId", "sizeId");

-- CreateIndex
CREATE INDEX "stitching_daily_outputs_stitchingIssueId_idx" ON "stitching_daily_outputs"("stitchingIssueId");

-- CreateIndex
CREATE INDEX "stitching_daily_outputs_outputDate_idx" ON "stitching_daily_outputs"("outputDate");

-- CreateIndex
CREATE INDEX "stitching_output_skus_dailyOutputId_idx" ON "stitching_output_skus"("dailyOutputId");

-- CreateIndex
CREATE UNIQUE INDEX "stitching_output_skus_dailyOutputId_colorId_sizeId_key" ON "stitching_output_skus"("dailyOutputId", "colorId", "sizeId");

-- CreateIndex
CREATE INDEX "finishing_issues_workOrderId_idx" ON "finishing_issues"("workOrderId");

-- CreateIndex
CREATE INDEX "finishing_issues_managerId_idx" ON "finishing_issues"("managerId");

-- CreateIndex
CREATE INDEX "finishing_issues_status_idx" ON "finishing_issues"("status");

-- CreateIndex
CREATE INDEX "finishing_issues_workOrderId_status_idx" ON "finishing_issues"("workOrderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "finishing_issue_components_finishingIssueId_componentId_key" ON "finishing_issue_components"("finishingIssueId", "componentId");

-- CreateIndex
CREATE INDEX "finishing_issue_skus_finishingIssueId_idx" ON "finishing_issue_skus"("finishingIssueId");

-- CreateIndex
CREATE UNIQUE INDEX "finishing_issue_skus_finishingIssueId_colorId_sizeId_key" ON "finishing_issue_skus"("finishingIssueId", "colorId", "sizeId");

-- CreateIndex
CREATE INDEX "finishing_daily_outputs_finishingIssueId_idx" ON "finishing_daily_outputs"("finishingIssueId");

-- CreateIndex
CREATE INDEX "finishing_daily_outputs_outputDate_idx" ON "finishing_daily_outputs"("outputDate");

-- CreateIndex
CREATE INDEX "finishing_output_skus_dailyOutputId_idx" ON "finishing_output_skus"("dailyOutputId");

-- CreateIndex
CREATE UNIQUE INDEX "finishing_output_skus_dailyOutputId_colorId_sizeId_key" ON "finishing_output_skus"("dailyOutputId", "colorId", "sizeId");

-- CreateIndex
CREATE UNIQUE INDEX "quality_inspections_mfg_inspectionNumber_key" ON "quality_inspections_mfg"("inspectionNumber");

-- CreateIndex
CREATE INDEX "quality_inspections_mfg_workOrderId_idx" ON "quality_inspections_mfg"("workOrderId");

-- CreateIndex
CREATE INDEX "quality_inspections_mfg_inspectionType_idx" ON "quality_inspections_mfg"("inspectionType");

-- CreateIndex
CREATE INDEX "quality_inspections_mfg_inspectionDate_idx" ON "quality_inspections_mfg"("inspectionDate");

-- CreateIndex
CREATE INDEX "polybag_entries_finishingIssueId_idx" ON "polybag_entries"("finishingIssueId");

-- CreateIndex
CREATE INDEX "polybag_skus_polybagEntryId_idx" ON "polybag_skus"("polybagEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "polybag_skus_polybagEntryId_colorId_sizeId_key" ON "polybag_skus"("polybagEntryId", "colorId", "sizeId");

-- CreateIndex
CREATE INDEX "carton_packings_workOrderId_idx" ON "carton_packings"("workOrderId");

-- CreateIndex
CREATE INDEX "carton_packings_finishingIssueId_idx" ON "carton_packings"("finishingIssueId");

-- CreateIndex
CREATE INDEX "carton_packings_status_idx" ON "carton_packings"("status");

-- CreateIndex
CREATE INDEX "carton_skus_cartonId_idx" ON "carton_skus"("cartonId");

-- CreateIndex
CREATE UNIQUE INDEX "carton_skus_cartonId_colorId_sizeId_key" ON "carton_skus"("cartonId", "colorId", "sizeId");

-- CreateIndex
CREATE INDEX "lab_dips_styleId_idx" ON "lab_dips"("styleId");

-- CreateIndex
CREATE INDEX "lab_dips_processType_idx" ON "lab_dips"("processType");

-- CreateIndex
CREATE INDEX "lab_dips_status_idx" ON "lab_dips"("status");

-- CreateIndex
CREATE INDEX "job_work_orders_labDipId_idx" ON "job_work_orders"("labDipId");

-- CreateIndex
CREATE INDEX "job_work_orders_styleId_idx" ON "job_work_orders"("styleId");

-- CreateIndex
CREATE INDEX "job_work_orders_millId_idx" ON "job_work_orders"("millId");

-- CreateIndex
CREATE INDEX "job_work_orders_status_idx" ON "job_work_orders"("status");

-- CreateIndex
CREATE INDEX "job_work_orders_processType_idx" ON "job_work_orders"("processType");

-- CreateIndex
CREATE INDEX "job_work_orders_workOrderId_idx" ON "job_work_orders"("workOrderId");

-- CreateIndex
CREATE INDEX "asn_applications_orderId_idx" ON "asn_applications"("orderId");

-- CreateIndex
CREATE INDEX "asn_applications_status_idx" ON "asn_applications"("status");

-- CreateIndex
CREATE INDEX "asn_skus_asnId_idx" ON "asn_skus"("asnId");

-- CreateIndex
CREATE UNIQUE INDEX "asn_skus_asnId_colorId_sizeId_key" ON "asn_skus"("asnId", "colorId", "sizeId");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_notes_ext_deliveryNoteId_key" ON "delivery_notes_ext"("deliveryNoteId");

-- CreateIndex
CREATE INDEX "delivery_notes_ext_deliveryNoteId_idx" ON "delivery_notes_ext"("deliveryNoteId");

-- CreateIndex
CREATE INDEX "delivery_notes_ext_asnId_idx" ON "delivery_notes_ext"("asnId");

-- CreateIndex
CREATE INDEX "dispatch_cartons_deliveryNoteExtId_idx" ON "dispatch_cartons"("deliveryNoteExtId");

-- CreateIndex
CREATE UNIQUE INDEX "dispatch_cartons_deliveryNoteExtId_cartonId_key" ON "dispatch_cartons"("deliveryNoteExtId", "cartonId");

-- CreateIndex
CREATE INDEX "dispatch_documents_deliveryNoteExtId_idx" ON "dispatch_documents"("deliveryNoteExtId");

-- CreateIndex
CREATE INDEX "dispatch_documents_documentType_idx" ON "dispatch_documents"("documentType");

-- CreateIndex
CREATE UNIQUE INDEX "dispatch_transports_deliveryNoteExtId_key" ON "dispatch_transports"("deliveryNoteExtId");

-- CreateIndex
CREATE UNIQUE INDEX "dispatch_pods_deliveryNoteExtId_key" ON "dispatch_pods"("deliveryNoteExtId");

-- CreateIndex
CREATE INDEX "testing_labs_labCode_idx" ON "testing_labs"("labCode");

-- CreateIndex
CREATE INDEX "testing_labs_isActive_idx" ON "testing_labs"("isActive");

-- CreateIndex
CREATE INDEX "test_templates_templateCode_idx" ON "test_templates"("templateCode");

-- CreateIndex
CREATE INDEX "test_templates_templateType_idx" ON "test_templates"("templateType");

-- CreateIndex
CREATE INDEX "test_templates_isActive_idx" ON "test_templates"("isActive");

-- CreateIndex
CREATE INDEX "fabric_physical_tests_testNumber_idx" ON "fabric_physical_tests"("testNumber");

-- CreateIndex
CREATE INDEX "fabric_physical_tests_fabricId_idx" ON "fabric_physical_tests"("fabricId");

-- CreateIndex
CREATE INDEX "fabric_physical_tests_fabricProcurementId_idx" ON "fabric_physical_tests"("fabricProcurementId");

-- CreateIndex
CREATE INDEX "fabric_physical_tests_fabricStockLotId_idx" ON "fabric_physical_tests"("fabricStockLotId");

-- CreateIndex
CREATE INDEX "fabric_physical_tests_styleId_idx" ON "fabric_physical_tests"("styleId");

-- CreateIndex
CREATE INDEX "fabric_physical_tests_customerId_idx" ON "fabric_physical_tests"("customerId");

-- CreateIndex
CREATE INDEX "fabric_physical_tests_testingLabId_idx" ON "fabric_physical_tests"("testingLabId");

-- CreateIndex
CREATE INDEX "fabric_physical_tests_overallTestResult_idx" ON "fabric_physical_tests"("overallTestResult");

-- CreateIndex
CREATE INDEX "fabric_physical_tests_sentToLabDate_idx" ON "fabric_physical_tests"("sentToLabDate");

-- CreateIndex
CREATE INDEX "fabric_physical_tests_createdAt_idx" ON "fabric_physical_tests"("createdAt");

-- CreateIndex
CREATE INDEX "garment_physical_tests_testNumber_idx" ON "garment_physical_tests"("testNumber");

-- CreateIndex
CREATE INDEX "garment_physical_tests_workOrderId_idx" ON "garment_physical_tests"("workOrderId");

-- CreateIndex
CREATE INDEX "garment_physical_tests_styleId_idx" ON "garment_physical_tests"("styleId");

-- CreateIndex
CREATE INDEX "garment_physical_tests_customerId_idx" ON "garment_physical_tests"("customerId");

-- CreateIndex
CREATE INDEX "garment_physical_tests_testingLabId_idx" ON "garment_physical_tests"("testingLabId");

-- CreateIndex
CREATE INDEX "garment_physical_tests_overallTestResult_idx" ON "garment_physical_tests"("overallTestResult");

-- CreateIndex
CREATE INDEX "garment_physical_tests_sentToLabDate_idx" ON "garment_physical_tests"("sentToLabDate");

-- CreateIndex
CREATE INDEX "garment_physical_tests_createdAt_idx" ON "garment_physical_tests"("createdAt");

-- CreateIndex
CREATE INDEX "hook_eye_master_hookEyeCode_idx" ON "hook_eye_master"("hookEyeCode");

-- CreateIndex
CREATE INDEX "hook_eye_master_supplierId_idx" ON "hook_eye_master"("supplierId");

-- CreateIndex
CREATE INDEX "snap_button_master_snapButtonCode_idx" ON "snap_button_master"("snapButtonCode");

-- CreateIndex
CREATE INDEX "snap_button_master_supplierId_idx" ON "snap_button_master"("supplierId");

-- CreateIndex
CREATE INDEX "buckle_master_buckleCode_idx" ON "buckle_master"("buckleCode");

-- CreateIndex
CREATE INDEX "buckle_master_supplierId_idx" ON "buckle_master"("supplierId");

-- CreateIndex
CREATE INDEX "belt_master_beltCode_idx" ON "belt_master"("beltCode");

-- CreateIndex
CREATE INDEX "belt_master_supplierId_idx" ON "belt_master"("supplierId");

-- CreateIndex
CREATE INDEX "velcro_master_velcroCode_idx" ON "velcro_master"("velcroCode");

-- CreateIndex
CREATE INDEX "velcro_master_supplierId_idx" ON "velcro_master"("supplierId");

-- CreateIndex
CREATE INDEX "drawstring_master_drawstringCode_idx" ON "drawstring_master"("drawstringCode");

-- CreateIndex
CREATE INDEX "drawstring_master_supplierId_idx" ON "drawstring_master"("supplierId");

-- CreateIndex
CREATE INDEX "ribbon_master_ribbonCode_idx" ON "ribbon_master"("ribbonCode");

-- CreateIndex
CREATE INDEX "ribbon_master_supplierId_idx" ON "ribbon_master"("supplierId");

-- CreateIndex
CREATE INDEX "sequin_master_sequinCode_idx" ON "sequin_master"("sequinCode");

-- CreateIndex
CREATE INDEX "sequin_master_supplierId_idx" ON "sequin_master"("supplierId");

-- CreateIndex
CREATE INDEX "bead_master_beadCode_idx" ON "bead_master"("beadCode");

-- CreateIndex
CREATE INDEX "bead_master_supplierId_idx" ON "bead_master"("supplierId");

-- CreateIndex
CREATE INDEX "motif_master_motifCode_idx" ON "motif_master"("motifCode");

-- CreateIndex
CREATE INDEX "motif_master_supplierId_idx" ON "motif_master"("supplierId");

-- CreateIndex
CREATE INDEX "interlining_master_interliningCode_idx" ON "interlining_master"("interliningCode");

-- CreateIndex
CREATE INDEX "interlining_master_supplierId_idx" ON "interlining_master"("supplierId");

-- CreateIndex
CREATE INDEX "padding_master_paddingCode_idx" ON "padding_master"("paddingCode");

-- CreateIndex
CREATE INDEX "padding_master_supplierId_idx" ON "padding_master"("supplierId");

-- CreateIndex
CREATE INDEX "other_fastener_master_otherFastenerCode_idx" ON "other_fastener_master"("otherFastenerCode");

-- CreateIndex
CREATE INDEX "other_fastener_master_supplierId_idx" ON "other_fastener_master"("supplierId");

-- CreateIndex
CREATE INDEX "other_tape_master_otherTapeCode_idx" ON "other_tape_master"("otherTapeCode");

-- CreateIndex
CREATE INDEX "other_tape_master_supplierId_idx" ON "other_tape_master"("supplierId");

-- CreateIndex
CREATE INDEX "other_decorative_master_otherDecorativeCode_idx" ON "other_decorative_master"("otherDecorativeCode");

-- CreateIndex
CREATE INDEX "other_decorative_master_supplierId_idx" ON "other_decorative_master"("supplierId");

-- CreateIndex
CREATE INDEX "other_functional_master_otherFunctionalCode_idx" ON "other_functional_master"("otherFunctionalCode");

-- CreateIndex
CREATE INDEX "other_functional_master_supplierId_idx" ON "other_functional_master"("supplierId");

-- CreateIndex
CREATE INDEX "ai_conversations_userId_idx" ON "ai_conversations"("userId");

-- CreateIndex
CREATE INDEX "ai_conversations_status_idx" ON "ai_conversations"("status");

-- CreateIndex
CREATE INDEX "ai_conversations_lastMessageAt_idx" ON "ai_conversations"("lastMessageAt");

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_idx" ON "ai_messages"("conversationId");

-- CreateIndex
CREATE INDEX "ai_messages_createdAt_idx" ON "ai_messages"("createdAt");

-- CreateIndex
CREATE INDEX "ai_feedback_messageId_idx" ON "ai_feedback"("messageId");

-- CreateIndex
CREATE INDEX "ai_feedback_userId_idx" ON "ai_feedback"("userId");

-- CreateIndex
CREATE INDEX "stage_transition_overrides_workOrderId_idx" ON "stage_transition_overrides"("workOrderId");

-- CreateIndex
CREATE INDEX "stage_transition_overrides_orderItemId_idx" ON "stage_transition_overrides"("orderItemId");

-- CreateIndex
CREATE INDEX "stage_transition_overrides_sampleId_idx" ON "stage_transition_overrides"("sampleId");

-- CreateIndex
CREATE INDEX "stage_transition_overrides_overriddenById_idx" ON "stage_transition_overrides"("overriddenById");

-- CreateIndex
CREATE INDEX "stage_transition_overrides_overriddenAt_idx" ON "stage_transition_overrides"("overriddenAt");

-- CreateIndex
CREATE INDEX "stage_transition_overrides_blockType_idx" ON "stage_transition_overrides"("blockType");

-- CreateIndex
CREATE INDEX "style_label_size_config_styleMaterialBomId_idx" ON "style_label_size_config"("styleMaterialBomId");

-- CreateIndex
CREATE UNIQUE INDEX "style_label_size_config_styleMaterialBomId_size_key" ON "style_label_size_config"("styleMaterialBomId", "size");

-- CreateIndex
CREATE UNIQUE INDEX "style_label_size_config_styleLabelConfigId_size_key" ON "style_label_size_config"("styleMaterialBomId", "size");

-- CreateIndex
CREATE INDEX "order_label_override_orderItemId_idx" ON "order_label_override"("orderItemId");

-- CreateIndex
CREATE INDEX "order_label_override_styleMaterialBomId_idx" ON "order_label_override"("styleMaterialBomId");

-- CreateIndex
CREATE UNIQUE INDEX "order_label_override_orderItemId_styleMaterialBomId_key" ON "order_label_override"("orderItemId", "styleMaterialBomId");

-- CreateIndex
CREATE UNIQUE INDEX "order_label_override_orderItemId_styleLabelConfigId_key" ON "order_label_override"("orderItemId", "styleMaterialBomId");

-- CreateIndex
CREATE INDEX "order_label_size_override_orderLabelOverrideId_idx" ON "order_label_size_override"("orderLabelOverrideId");

-- CreateIndex
CREATE UNIQUE INDEX "order_label_size_override_orderLabelOverrideId_size_key" ON "order_label_size_override"("orderLabelOverrideId", "size");

-- CreateIndex
CREATE INDEX "style_pattern_parts_style_fabric_id_idx" ON "style_pattern_parts"("style_fabric_id");

-- CreateIndex
CREATE INDEX "style_pattern_parts_pattern_part_id_idx" ON "style_pattern_parts"("pattern_part_id");

-- CreateIndex
CREATE UNIQUE INDEX "style_pattern_parts_style_fabric_id_pattern_part_id_key" ON "style_pattern_parts"("style_fabric_id", "pattern_part_id");

-- CreateIndex
CREATE UNIQUE INDEX "embroidery_part_cad_style_fabric_id_key" ON "embroidery_part_cad"("style_fabric_id");

-- CreateIndex
CREATE INDEX "embroidery_part_cad_style_fabric_id_idx" ON "embroidery_part_cad"("style_fabric_id");

-- CreateIndex
CREATE INDEX "embroidery_part_cad_fabric_width_cad_id_idx" ON "embroidery_part_cad"("fabric_width_cad_id");

-- CreateIndex
CREATE INDEX "embroidery_part_cad_embroidery_id_idx" ON "embroidery_part_cad"("embroidery_id");

-- CreateIndex
CREATE INDEX "embroidery_cad_size_breakdown_embroidery_cad_id_idx" ON "embroidery_cad_size_breakdown"("embroidery_cad_id");

-- CreateIndex
CREATE INDEX "embroidery_cad_size_breakdown_size_id_idx" ON "embroidery_cad_size_breakdown"("size_id");

-- CreateIndex
CREATE UNIQUE INDEX "embroidery_cad_size_breakdown_embroidery_cad_id_sizeName_key" ON "embroidery_cad_size_breakdown"("embroidery_cad_id", "sizeName");

-- CreateIndex
CREATE INDEX "lace_stock_laceId_idx" ON "lace_stock"("laceId");

-- CreateIndex
CREATE INDEX "lace_stock_originStyleId_idx" ON "lace_stock"("originStyleId");

-- CreateIndex
CREATE INDEX "lace_stock_originOrderId_idx" ON "lace_stock"("originOrderId");

-- CreateIndex
CREATE INDEX "lace_stock_processingBatchId_idx" ON "lace_stock"("processingBatchId");

-- CreateIndex
CREATE INDEX "lace_stock_status_idx" ON "lace_stock"("status");

-- CreateIndex
CREATE INDEX "lace_stock_qualityGrade_idx" ON "lace_stock"("qualityGrade");

-- CreateIndex
CREATE INDEX "lace_stock_dyeLotNumber_idx" ON "lace_stock"("dyeLotNumber");

-- CreateIndex
CREATE INDEX "lace_stock_allocation_stockId_idx" ON "lace_stock_allocation"("stockId");

-- CreateIndex
CREATE INDEX "lace_stock_allocation_orderId_idx" ON "lace_stock_allocation"("orderId");

-- CreateIndex
CREATE INDEX "lace_stock_allocation_styleId_idx" ON "lace_stock_allocation"("styleId");

-- CreateIndex
CREATE INDEX "lace_stock_allocation_allocationStatus_idx" ON "lace_stock_allocation"("allocationStatus");

-- CreateIndex
CREATE INDEX "lace_stock_transaction_stockId_idx" ON "lace_stock_transaction"("stockId");

-- CreateIndex
CREATE INDEX "lace_stock_transaction_transactionType_idx" ON "lace_stock_transaction"("transactionType");

-- CreateIndex
CREATE INDEX "lace_stock_transaction_transactionDate_idx" ON "lace_stock_transaction"("transactionDate");

-- CreateIndex
CREATE UNIQUE INDEX "lace_lab_dip_labDipNumber_key" ON "lace_lab_dip"("labDipNumber");

-- CreateIndex
CREATE INDEX "lace_lab_dip_greigeLaceId_idx" ON "lace_lab_dip"("greigeLaceId");

-- CreateIndex
CREATE INDEX "lace_lab_dip_processorId_idx" ON "lace_lab_dip"("processorId");

-- CreateIndex
CREATE INDEX "lace_lab_dip_status_idx" ON "lace_lab_dip"("status");

-- CreateIndex
CREATE INDEX "lace_lab_dip_styleId_idx" ON "lace_lab_dip"("styleId");

-- CreateIndex
CREATE INDEX "lace_lab_dip_costSheetId_idx" ON "lace_lab_dip"("costSheetId");

-- CreateIndex
CREATE INDEX "lace_defect_log_stockId_idx" ON "lace_defect_log"("stockId");

-- CreateIndex
CREATE INDEX "lace_defect_log_laceId_idx" ON "lace_defect_log"("laceId");

-- CreateIndex
CREATE INDEX "lace_defect_log_orderId_idx" ON "lace_defect_log"("orderId");

-- CreateIndex
CREATE INDEX "lace_defect_log_claimStatus_idx" ON "lace_defect_log"("claimStatus");

-- CreateIndex
CREATE UNIQUE INDEX "lace_issue_note_issueNumber_key" ON "lace_issue_note"("issueNumber");

-- CreateIndex
CREATE INDEX "lace_issue_note_orderId_idx" ON "lace_issue_note"("orderId");

-- CreateIndex
CREATE INDEX "lace_issue_note_styleId_idx" ON "lace_issue_note"("styleId");

-- CreateIndex
CREATE INDEX "lace_issue_note_stockId_idx" ON "lace_issue_note"("stockId");

-- CreateIndex
CREATE INDEX "lace_issue_note_status_idx" ON "lace_issue_note"("status");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_master" ADD CONSTRAINT "material_master_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_master" ADD CONSTRAINT "material_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_supplier_mapping" ADD CONSTRAINT "material_supplier_mapping_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "material_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_supplier_mapping" ADD CONSTRAINT "material_supplier_mapping_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom" ADD CONSTRAINT "order_bom_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom" ADD CONSTRAINT "order_bom_copiedFromOrderId_fkey" FOREIGN KEY ("copiedFromOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom" ADD CONSTRAINT "order_bom_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom" ADD CONSTRAINT "order_bom_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom" ADD CONSTRAINT "order_bom_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom" ADD CONSTRAINT "order_bom_sourceCostSheetId_fkey" FOREIGN KEY ("sourceCostSheetId") REFERENCES "style_costing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom" ADD CONSTRAINT "order_bom_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_buttonId_fkey" FOREIGN KEY ("buttonId") REFERENCES "button_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_elasticId_fkey" FOREIGN KEY ("elasticId") REFERENCES "elastic_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "fabric_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "label_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_laceId_fkey" FOREIGN KEY ("laceId") REFERENCES "lace_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_orderBomId_fkey" FOREIGN KEY ("orderBomId") REFERENCES "order_bom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "packaging_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_selectedCadId_fkey" FOREIGN KEY ("selectedCadId") REFERENCES "fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "thread_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_zipperId_fkey" FOREIGN KEY ("zipperId") REFERENCES "zipper_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "color_options" ADD CONSTRAINT "color_options_colorMasterId_fkey" FOREIGN KEY ("colorMasterId") REFERENCES "color_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "color_options" ADD CONSTRAINT "color_options_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_billingCityId_fkey" FOREIGN KEY ("billingCityId") REFERENCES "indian_cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_billingStateId_fkey" FOREIGN KEY ("billingStateId") REFERENCES "indian_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("currencyCode") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_defaultTestingLabId_fkey" FOREIGN KEY ("defaultTestingLabId") REFERENCES "testing_labs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_fptTemplateId_fkey" FOREIGN KEY ("fptTemplateId") REFERENCES "test_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_gptTemplateId_fkey" FOREIGN KEY ("gptTemplateId") REFERENCES "test_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_paymentTermsId_fkey" FOREIGN KEY ("paymentTermsId") REFERENCES "payment_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_shippingCityId_fkey" FOREIGN KEY ("shippingCityId") REFERENCES "indian_cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_shippingStateId_fkey" FOREIGN KEY ("shippingStateId") REFERENCES "indian_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_categories" ADD CONSTRAINT "brand_categories_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_categories" ADD CONSTRAINT "brand_categories_productCategoryId_fkey" FOREIGN KEY ("productCategoryId") REFERENCES "product_category_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_gst_numbers" ADD CONSTRAINT "customer_gst_numbers_billingCityId_fkey" FOREIGN KEY ("billingCityId") REFERENCES "indian_cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_gst_numbers" ADD CONSTRAINT "customer_gst_numbers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_gst_numbers" ADD CONSTRAINT "customer_gst_numbers_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "indian_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_gst_numbers" ADD CONSTRAINT "supplier_gst_numbers_billingCityId_fkey" FOREIGN KEY ("billingCityId") REFERENCES "indian_cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_gst_numbers" ADD CONSTRAINT "supplier_gst_numbers_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "indian_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_gst_numbers" ADD CONSTRAINT "supplier_gst_numbers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indian_cities" ADD CONSTRAINT "indian_cities_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "indian_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_accessories_presets" ADD CONSTRAINT "customer_accessories_presets_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_accessories_preset_items" ADD CONSTRAINT "customer_accessories_preset_items_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "label_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_accessories_preset_items" ADD CONSTRAINT "customer_accessories_preset_items_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_accessories_preset_items" ADD CONSTRAINT "customer_accessories_preset_items_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "customer_accessories_presets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_size_category_presets" ADD CONSTRAINT "customer_size_category_presets_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_size_category_presets" ADD CONSTRAINT "customer_size_category_presets_sizeCategoryId_fkey" FOREIGN KEY ("sizeCategoryId") REFERENCES "size_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_note_items" ADD CONSTRAINT "delivery_note_items_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_note_items" ADD CONSTRAINT "delivery_note_items_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES "delivery_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_note_items" ADD CONSTRAINT "delivery_note_items_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_note_items" ADD CONSTRAINT "delivery_note_items_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_note_items" ADD CONSTRAINT "delivery_note_items_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_note_items" ADD CONSTRAINT "delivery_note_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "style_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_goods_stock" ADD CONSTRAINT "finished_goods_stock_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_goods_stock" ADD CONSTRAINT "finished_goods_stock_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_goods_stock" ADD CONSTRAINT "finished_goods_stock_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_goods_stock" ADD CONSTRAINT "finished_goods_stock_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_goods_stock" ADD CONSTRAINT "finished_goods_stock_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "style_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_goods_stock" ADD CONSTRAINT "finished_goods_stock_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receiving_notes" ADD CONSTRAINT "goods_receiving_notes_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receiving_notes" ADD CONSTRAINT "goods_receiving_notes_poId_fkey" FOREIGN KEY ("poId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receiving_notes" ADD CONSTRAINT "goods_receiving_notes_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receiving_notes" ADD CONSTRAINT "goods_receiving_notes_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receiving_notes" ADD CONSTRAINT "goods_receiving_notes_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_items" ADD CONSTRAINT "grn_items_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "goods_receiving_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_items" ADD CONSTRAINT "grn_items_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_items" ADD CONSTRAINT "grn_items_poItemId_fkey" FOREIGN KEY ("poItemId") REFERENCES "purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_placeOfSupplyId_fkey" FOREIGN KEY ("placeOfSupplyId") REFERENCES "indian_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_categories" ADD CONSTRAINT "material_categories_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "material_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requisition_items" ADD CONSTRAINT "material_requisition_items_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requisition_items" ADD CONSTRAINT "material_requisition_items_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "material_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requisitions" ADD CONSTRAINT "material_requisitions_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requisitions" ADD CONSTRAINT "material_requisitions_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requisitions" ADD CONSTRAINT "material_requisitions_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_buttonId_fkey" FOREIGN KEY ("buttonId") REFERENCES "button_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "material_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_elasticId_fkey" FOREIGN KEY ("elasticId") REFERENCES "elastic_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "fabric_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_greigeId_fkey" FOREIGN KEY ("greigeId") REFERENCES "greige_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "label_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_laceId_fkey" FOREIGN KEY ("laceId") REFERENCES "lace_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_machinePartId_fkey" FOREIGN KEY ("machinePartId") REFERENCES "machine_part_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_otherMaterialId_fkey" FOREIGN KEY ("otherMaterialId") REFERENCES "other_material_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "packaging_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_sizeVariantId_fkey" FOREIGN KEY ("sizeVariantId") REFERENCES "label_size_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "thread_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_zipperId_fkey" FOREIGN KEY ("zipperId") REFERENCES "zipper_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_breakup" ADD CONSTRAINT "order_item_breakup_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_breakup" ADD CONSTRAINT "order_item_breakup_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_breakup" ADD CONSTRAINT "order_item_breakup_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_breakup" ADD CONSTRAINT "order_item_breakup_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "style_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_selectedCadId_fkey" FOREIGN KEY ("selectedCadId") REFERENCES "fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_plans" ADD CONSTRAINT "production_plans_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_plans" ADD CONSTRAINT "production_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_tracking" ADD CONSTRAINT "production_tracking_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_tracking" ADD CONSTRAINT "production_tracking_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_poId_fkey" FOREIGN KEY ("poId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_linkedGreigePOId_fkey" FOREIGN KEY ("linkedGreigePOId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_costSheetGenerationId_fkey" FOREIGN KEY ("costSheetGenerationId") REFERENCES "cost_sheet_po_generation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_defects" ADD CONSTRAINT "quality_defects_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "quality_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_inspectedById_fkey" FOREIGN KEY ("inspectedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_placeOfSupplyId_fkey" FOREIGN KEY ("placeOfSupplyId") REFERENCES "indian_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "size_options" ADD CONSTRAINT "size_options_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_variants" ADD CONSTRAINT "style_variants_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_variants" ADD CONSTRAINT "style_variants_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_variants" ADD CONSTRAINT "style_variants_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_accessories" ADD CONSTRAINT "style_accessories_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "style_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_category_master" ADD CONSTRAINT "product_category_master_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_category_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_components" ADD CONSTRAINT "style_components_component_master_id_fkey" FOREIGN KEY ("component_master_id") REFERENCES "component_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_components" ADD CONSTRAINT "style_components_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing" ADD CONSTRAINT "style_costing_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing" ADD CONSTRAINT "style_costing_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing" ADD CONSTRAINT "style_costing_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing" ADD CONSTRAINT "style_costing_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing" ADD CONSTRAINT "style_costing_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing" ADD CONSTRAINT "style_costing_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "style_costing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing" ADD CONSTRAINT "style_costing_copied_from_costing_id_fkey" FOREIGN KEY ("copied_from_costing_id") REFERENCES "style_costing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing" ADD CONSTRAINT "style_costing_variance_approved_by_fkey" FOREIGN KEY ("variance_approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_sheet_po_generation" ADD CONSTRAINT "cost_sheet_po_generation_costSheetId_fkey" FOREIGN KEY ("costSheetId") REFERENCES "style_costing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_sheet_po_generation" ADD CONSTRAINT "cost_sheet_po_generation_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_fabric_items" ADD CONSTRAINT "style_costing_fabric_items_costingId_fkey" FOREIGN KEY ("costingId") REFERENCES "style_costing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_fabric_items" ADD CONSTRAINT "style_costing_fabric_items_fabricCADId_fkey" FOREIGN KEY ("fabricCADId") REFERENCES "fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_fabric_items" ADD CONSTRAINT "style_costing_fabric_items_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "fabric_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_fabric_items" ADD CONSTRAINT "style_costing_fabric_items_processorId_fkey" FOREIGN KEY ("processorId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_fabric_items" ADD CONSTRAINT "style_costing_fabric_items_procurementId_fkey" FOREIGN KEY ("procurementId") REFERENCES "fabric_procurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_fabric_items" ADD CONSTRAINT "style_costing_fabric_items_rateCardId_fkey" FOREIGN KEY ("rateCardId") REFERENCES "processor_rate_card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_fabric_items" ADD CONSTRAINT "style_costing_fabric_items_stockLotId_fkey" FOREIGN KEY ("stockLotId") REFERENCES "fabric_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_lace_items" ADD CONSTRAINT "style_costing_lace_items_costingId_fkey" FOREIGN KEY ("costingId") REFERENCES "style_costing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_lace_items" ADD CONSTRAINT "style_costing_lace_items_laceId_fkey" FOREIGN KEY ("laceId") REFERENCES "lace_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_lace_items" ADD CONSTRAINT "style_costing_lace_items_greigeLaceId_fkey" FOREIGN KEY ("greigeLaceId") REFERENCES "lace_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_lace_items" ADD CONSTRAINT "style_costing_lace_items_processorId_fkey" FOREIGN KEY ("processorId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_lace_items" ADD CONSTRAINT "style_costing_lace_items_rateCardId_fkey" FOREIGN KEY ("rateCardId") REFERENCES "processor_rate_card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_lace_items" ADD CONSTRAINT "style_costing_lace_items_stockLotId_fkey" FOREIGN KEY ("stockLotId") REFERENCES "lace_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_lace_items" ADD CONSTRAINT "style_costing_lace_items_labDipId_fkey" FOREIGN KEY ("labDipId") REFERENCES "lace_lab_dip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_fabrics" ADD CONSTRAINT "style_fabrics_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "style_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_fabrics" ADD CONSTRAINT "style_fabrics_embroideryId_fkey" FOREIGN KEY ("embroideryId") REFERENCES "embroidery_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_fabrics" ADD CONSTRAINT "style_fabrics_fabricCADId_fkey" FOREIGN KEY ("fabricCADId") REFERENCES "fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_fabrics" ADD CONSTRAINT "style_fabrics_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "fabric_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_fabrics" ADD CONSTRAINT "style_fabrics_selectedGreigeId_fkey" FOREIGN KEY ("selectedGreigeId") REFERENCES "greige_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embroidery_master" ADD CONSTRAINT "embroidery_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embroidery_send_out" ADD CONSTRAINT "embroidery_send_out_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embroidery_send_out" ADD CONSTRAINT "embroidery_send_out_embroideryId_fkey" FOREIGN KEY ("embroideryId") REFERENCES "embroidery_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embroidery_send_out" ADD CONSTRAINT "embroidery_send_out_forOrderId_fkey" FOREIGN KEY ("forOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embroidery_send_out" ADD CONSTRAINT "embroidery_send_out_forStyleId_fkey" FOREIGN KEY ("forStyleId") REFERENCES "styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embroidery_send_out" ADD CONSTRAINT "embroidery_send_out_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embroidery_send_out" ADD CONSTRAINT "embroidery_send_out_resultFabricStockId_fkey" FOREIGN KEY ("resultFabricStockId") REFERENCES "fabric_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embroidery_send_out" ADD CONSTRAINT "embroidery_send_out_sourceFabricStockId_fkey" FOREIGN KEY ("sourceFabricStockId") REFERENCES "fabric_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embroidery_send_out" ADD CONSTRAINT "embroidery_send_out_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_packaging" ADD CONSTRAINT "style_packaging_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_processes" ADD CONSTRAINT "style_processes_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_processes" ADD CONSTRAINT "style_processes_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_production_tracking" ADD CONSTRAINT "style_production_tracking_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_value_additions" ADD CONSTRAINT "style_value_additions_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_buttonId_fkey" FOREIGN KEY ("buttonId") REFERENCES "button_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_elasticId_fkey" FOREIGN KEY ("elasticId") REFERENCES "elastic_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "label_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_laceId_fkey" FOREIGN KEY ("laceId") REFERENCES "lace_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_machinePartId_fkey" FOREIGN KEY ("machinePartId") REFERENCES "machine_part_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_otherMaterialId_fkey" FOREIGN KEY ("otherMaterialId") REFERENCES "other_material_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "packaging_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "thread_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_zipperId_fkey" FOREIGN KEY ("zipperId") REFERENCES "zipper_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "styles" ADD CONSTRAINT "styles_brandCategoryId_fkey" FOREIGN KEY ("brandCategoryId") REFERENCES "brand_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "styles" ADD CONSTRAINT "styles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "style_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "styles" ADD CONSTRAINT "styles_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "styles" ADD CONSTRAINT "styles_product_category_id_fkey" FOREIGN KEY ("product_category_id") REFERENCES "product_category_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "styles" ADD CONSTRAINT "styles_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "season_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_billingCityId_fkey" FOREIGN KEY ("billingCityId") REFERENCES "indian_cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_billingStateId_fkey" FOREIGN KEY ("billingStateId") REFERENCES "indian_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("currencyCode") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_paymentTermsId_fkey" FOREIGN KEY ("paymentTermsId") REFERENCES "payment_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_shippingCityId_fkey" FOREIGN KEY ("shippingCityId") REFERENCES "indian_cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_shippingStateId_fkey" FOREIGN KEY ("shippingStateId") REFERENCES "indian_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processor_quantity_slabs" ADD CONSTRAINT "processor_quantity_slabs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processor_quantity_slabs" ADD CONSTRAINT "processor_quantity_slabs_processorId_fkey" FOREIGN KEY ("processorId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processor_rate_card" ADD CONSTRAINT "processor_rate_card_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processor_rate_card" ADD CONSTRAINT "processor_rate_card_greigeId_fkey" FOREIGN KEY ("greigeId") REFERENCES "greige_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processor_rate_card" ADD CONSTRAINT "processor_rate_card_processorId_fkey" FOREIGN KEY ("processorId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processor_rate_card" ADD CONSTRAINT "processor_rate_card_slabId_fkey" FOREIGN KEY ("slabId") REFERENCES "processor_quantity_slabs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processor_rate_card" ADD CONSTRAINT "processor_rate_card_laceId_fkey" FOREIGN KEY ("laceId") REFERENCES "lace_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "greige_suppliers" ADD CONSTRAINT "greige_suppliers_greigeId_fkey" FOREIGN KEY ("greigeId") REFERENCES "greige_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "greige_suppliers" ADD CONSTRAINT "greige_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_suppliers" ADD CONSTRAINT "fabric_suppliers_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "fabric_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_suppliers" ADD CONSTRAINT "fabric_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_suppliers" ADD CONSTRAINT "material_suppliers_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_suppliers" ADD CONSTRAINT "material_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_breakup" ADD CONSTRAINT "work_order_breakup_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_breakup" ADD CONSTRAINT "work_order_breakup_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_breakup" ADD CONSTRAINT "work_order_breakup_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_service_requirements" ADD CONSTRAINT "work_order_service_requirements_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_service_requirements" ADD CONSTRAINT "work_order_service_requirements_processId_fkey" FOREIGN KEY ("processId") REFERENCES "style_processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_service_requirements" ADD CONSTRAINT "work_order_service_requirements_preferredProcessorId_fkey" FOREIGN KEY ("preferredProcessorId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_service_requirements" ADD CONSTRAINT "work_order_service_requirements_assignedProcessorId_fkey" FOREIGN KEY ("assignedProcessorId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_service_requirements" ADD CONSTRAINT "work_order_service_requirements_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_service_requirements" ADD CONSTRAINT "work_order_service_requirements_jobWorkOrderId_fkey" FOREIGN KEY ("jobWorkOrderId") REFERENCES "job_work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_service_requirements" ADD CONSTRAINT "work_order_service_requirements_embroiderySendOutId_fkey" FOREIGN KEY ("embroiderySendOutId") REFERENCES "embroidery_send_out"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_service_requirements" ADD CONSTRAINT "work_order_service_requirements_processingBatchId_fkey" FOREIGN KEY ("processingBatchId") REFERENCES "processing_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_service_requirements" ADD CONSTRAINT "work_order_service_requirements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requirement_po_links" ADD CONSTRAINT "service_requirement_po_links_serviceRequirementId_fkey" FOREIGN KEY ("serviceRequirementId") REFERENCES "work_order_service_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requirement_po_links" ADD CONSTRAINT "service_requirement_po_links_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "purchase_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES "stock_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_orderBomId_fkey" FOREIGN KEY ("orderBomId") REFERENCES "order_bom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_preferredSupplierId_fkey" FOREIGN KEY ("preferredSupplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_splitFromId_fkey" FOREIGN KEY ("splitFromId") REFERENCES "material_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_po_links" ADD CONSTRAINT "requirement_po_links_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_po_links" ADD CONSTRAINT "requirement_po_links_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_po_links" ADD CONSTRAINT "requirement_po_links_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "material_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_types" ADD CONSTRAINT "expense_types_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_types" ADD CONSTRAINT "expense_types_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_masters" ADD CONSTRAINT "tax_masters_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_terms" ADD CONSTRAINT "payment_terms_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_masters" ADD CONSTRAINT "component_masters_component_group_id_fkey" FOREIGN KEY ("component_group_id") REFERENCES "component_group_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_masters" ADD CONSTRAINT "component_masters_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_component_defaults" ADD CONSTRAINT "category_component_defaults_component_master_id_fkey" FOREIGN KEY ("component_master_id") REFERENCES "component_masters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_component_defaults" ADD CONSTRAINT "category_component_defaults_product_category_id_fkey" FOREIGN KEY ("product_category_id") REFERENCES "product_category_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pattern_part_groups" ADD CONSTRAINT "pattern_part_groups_component_group_id_fkey" FOREIGN KEY ("component_group_id") REFERENCES "component_group_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pattern_part_groups" ADD CONSTRAINT "pattern_part_groups_pattern_part_id_fkey" FOREIGN KEY ("pattern_part_id") REFERENCES "pattern_part_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_pattern_parts" ADD CONSTRAINT "component_pattern_parts_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "component_masters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_pattern_parts" ADD CONSTRAINT "component_pattern_parts_pattern_part_id_fkey" FOREIGN KEY ("pattern_part_id") REFERENCES "pattern_part_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("currencyCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_templates" ADD CONSTRAINT "export_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "greige_master" ADD CONSTRAINT "greige_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "greige_master" ADD CONSTRAINT "greige_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_master" ADD CONSTRAINT "fabric_master_colorMasterId_fkey" FOREIGN KEY ("colorMasterId") REFERENCES "color_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_master" ADD CONSTRAINT "fabric_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_master" ADD CONSTRAINT "fabric_master_greigeId_fkey" FOREIGN KEY ("greigeId") REFERENCES "greige_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_master" ADD CONSTRAINT "fabric_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_cloned_from_cad_id_fkey" FOREIGN KEY ("cloned_from_cad_id") REFERENCES "fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_cloned_from_order_id_fkey" FOREIGN KEY ("cloned_from_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_copied_from_id_fkey" FOREIGN KEY ("copied_from_id") REFERENCES "fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_costingStyleId_fkey" FOREIGN KEY ("costingStyleId") REFERENCES "styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "fabric_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_fabric_stock_id_fkey" FOREIGN KEY ("fabric_stock_id") REFERENCES "fabric_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_greigeId_fkey" FOREIGN KEY ("greigeId") REFERENCES "greige_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_pattern_part_id_fkey" FOREIGN KEY ("pattern_part_id") REFERENCES "pattern_part_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_processing_batch_group_color_id_fkey" FOREIGN KEY ("processing_batch_group_color_id") REFERENCES "color_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_processorId_fkey" FOREIGN KEY ("processorId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_procurement_id_fkey" FOREIGN KEY ("procurement_id") REFERENCES "fabric_procurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_style_costing_id_fkey" FOREIGN KEY ("style_costing_id") REFERENCES "style_costing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_style_fabric_id_fkey" FOREIGN KEY ("style_fabric_id") REFERENCES "style_fabrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_variance_approved_by_fkey" FOREIGN KEY ("variance_approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_size_breakdown" ADD CONSTRAINT "cad_size_breakdown_cadId_fkey" FOREIGN KEY ("cadId") REFERENCES "fabric_width_cad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_size_breakdown" ADD CONSTRAINT "cad_size_breakdown_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_costing" ADD CONSTRAINT "order_item_costing_baseCostingId_fkey" FOREIGN KEY ("baseCostingId") REFERENCES "style_costing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_costing" ADD CONSTRAINT "order_item_costing_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_costing" ADD CONSTRAINT "order_item_costing_selectedCadId_fkey" FOREIGN KEY ("selectedCadId") REFERENCES "fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_samples" ADD CONSTRAINT "order_samples_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_samples" ADD CONSTRAINT "order_samples_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_inspections" ADD CONSTRAINT "order_inspections_inspectedById_fkey" FOREIGN KEY ("inspectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_inspections" ADD CONSTRAINT "order_inspections_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_procurement" ADD CONSTRAINT "fabric_procurement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_procurement" ADD CONSTRAINT "fabric_procurement_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "fabric_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_procurement" ADD CONSTRAINT "fabric_procurement_greigeId_fkey" FOREIGN KEY ("greigeId") REFERENCES "greige_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_procurement" ADD CONSTRAINT "fabric_procurement_orderedForOrderId_fkey" FOREIGN KEY ("orderedForOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_procurement" ADD CONSTRAINT "fabric_procurement_orderedForStyleId_fkey" FOREIGN KEY ("orderedForStyleId") REFERENCES "styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_procurement" ADD CONSTRAINT "fabric_procurement_processedFabricId_fkey" FOREIGN KEY ("processedFabricId") REFERENCES "fabric_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_procurement" ADD CONSTRAINT "fabric_procurement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_stock" ADD CONSTRAINT "fabric_stock_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_stock" ADD CONSTRAINT "fabric_stock_embroideryId_fkey" FOREIGN KEY ("embroideryId") REFERENCES "embroidery_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_stock" ADD CONSTRAINT "fabric_stock_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "fabric_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_stock" ADD CONSTRAINT "fabric_stock_originOrderId_fkey" FOREIGN KEY ("originOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_stock" ADD CONSTRAINT "fabric_stock_originStyleId_fkey" FOREIGN KEY ("originStyleId") REFERENCES "styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_stock" ADD CONSTRAINT "fabric_stock_procurementId_fkey" FOREIGN KEY ("procurementId") REFERENCES "fabric_procurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_processing" ADD CONSTRAINT "fabric_processing_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_processing" ADD CONSTRAINT "fabric_processing_finishedFabricId_fkey" FOREIGN KEY ("finishedFabricId") REFERENCES "fabric_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_processing" ADD CONSTRAINT "fabric_processing_greigeId_fkey" FOREIGN KEY ("greigeId") REFERENCES "greige_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_processing" ADD CONSTRAINT "fabric_processing_processingMillId_fkey" FOREIGN KEY ("processingMillId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_processing" ADD CONSTRAINT "fabric_processing_procurementId_fkey" FOREIGN KEY ("procurementId") REFERENCES "fabric_procurement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_stock_allocation" ADD CONSTRAINT "fabric_stock_allocation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_stock_allocation" ADD CONSTRAINT "fabric_stock_allocation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_stock_allocation" ADD CONSTRAINT "fabric_stock_allocation_originalStyleId_fkey" FOREIGN KEY ("originalStyleId") REFERENCES "styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_stock_allocation" ADD CONSTRAINT "fabric_stock_allocation_production_cad_id_fkey" FOREIGN KEY ("production_cad_id") REFERENCES "fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_stock_allocation" ADD CONSTRAINT "fabric_stock_allocation_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "fabric_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_stock_allocation" ADD CONSTRAINT "fabric_stock_allocation_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_stock_transaction" ADD CONSTRAINT "fabric_stock_transaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_stock_transaction" ADD CONSTRAINT "fabric_stock_transaction_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "fabric_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspection" ADD CONSTRAINT "quality_inspection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspection" ADD CONSTRAINT "quality_inspection_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "fabric_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspection" ADD CONSTRAINT "quality_inspection_fabricProcurementId_fkey" FOREIGN KEY ("fabricProcurementId") REFERENCES "fabric_procurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspection" ADD CONSTRAINT "quality_inspection_fabricStockId_fkey" FOREIGN KEY ("fabricStockId") REFERENCES "fabric_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspection" ADD CONSTRAINT "quality_inspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_master" ADD CONSTRAINT "lace_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_master" ADD CONSTRAINT "lace_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_master" ADD CONSTRAINT "lace_master_sourceGreigeLaceId_fkey" FOREIGN KEY ("sourceGreigeLaceId") REFERENCES "lace_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "button_master" ADD CONSTRAINT "button_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "button_master" ADD CONSTRAINT "button_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_master" ADD CONSTRAINT "thread_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_master" ADD CONSTRAINT "thread_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_master" ADD CONSTRAINT "thread_master_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_thread_items" ADD CONSTRAINT "style_costing_thread_items_costingId_fkey" FOREIGN KEY ("costingId") REFERENCES "style_costing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_thread_items" ADD CONSTRAINT "style_costing_thread_items_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "thread_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_thread_requirements" ADD CONSTRAINT "order_thread_requirements_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_thread_requirements" ADD CONSTRAINT "order_thread_requirements_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "thread_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_thread_requirements" ADD CONSTRAINT "order_thread_requirements_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_style_associations" ADD CONSTRAINT "lace_style_associations_laceId_fkey" FOREIGN KEY ("laceId") REFERENCES "lace_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_style_associations" ADD CONSTRAINT "lace_style_associations_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "button_style_associations" ADD CONSTRAINT "button_style_associations_buttonId_fkey" FOREIGN KEY ("buttonId") REFERENCES "button_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "button_style_associations" ADD CONSTRAINT "button_style_associations_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_style_associations" ADD CONSTRAINT "thread_style_associations_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_style_associations" ADD CONSTRAINT "thread_style_associations_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "thread_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zipper_master" ADD CONSTRAINT "zipper_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zipper_master" ADD CONSTRAINT "zipper_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elastic_master" ADD CONSTRAINT "elastic_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elastic_master" ADD CONSTRAINT "elastic_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "label_master" ADD CONSTRAINT "label_master_brandCategoryId_fkey" FOREIGN KEY ("brandCategoryId") REFERENCES "brand_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "label_master" ADD CONSTRAINT "label_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "label_master" ADD CONSTRAINT "label_master_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "label_master" ADD CONSTRAINT "label_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "label_size_variants" ADD CONSTRAINT "label_size_variants_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "label_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "label_size_variants" ADD CONSTRAINT "label_size_variants_sizeCategoryId_fkey" FOREIGN KEY ("sizeCategoryId") REFERENCES "size_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packaging_master" ADD CONSTRAINT "packaging_master_brandCategoryId_fkey" FOREIGN KEY ("brandCategoryId") REFERENCES "brand_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packaging_master" ADD CONSTRAINT "packaging_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packaging_master" ADD CONSTRAINT "packaging_master_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packaging_master" ADD CONSTRAINT "packaging_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packaging_suppliers" ADD CONSTRAINT "packaging_suppliers_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "packaging_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packaging_suppliers" ADD CONSTRAINT "packaging_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_part_master" ADD CONSTRAINT "machine_part_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_part_master" ADD CONSTRAINT "machine_part_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_part_suppliers" ADD CONSTRAINT "machine_part_suppliers_machinePartId_fkey" FOREIGN KEY ("machinePartId") REFERENCES "machine_part_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_part_suppliers" ADD CONSTRAINT "machine_part_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_material_master" ADD CONSTRAINT "other_material_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_material_master" ADD CONSTRAINT "other_material_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_material_suppliers" ADD CONSTRAINT "other_material_suppliers_otherMaterialId_fkey" FOREIGN KEY ("otherMaterialId") REFERENCES "other_material_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_material_suppliers" ADD CONSTRAINT "other_material_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_batch" ADD CONSTRAINT "processing_batch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_batch" ADD CONSTRAINT "processing_batch_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "fabric_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_batch" ADD CONSTRAINT "processing_batch_greigeId_fkey" FOREIGN KEY ("greigeId") REFERENCES "greige_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_batch" ADD CONSTRAINT "processing_batch_laceId_fkey" FOREIGN KEY ("laceId") REFERENCES "lace_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_batch" ADD CONSTRAINT "processing_batch_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_stage" ADD CONSTRAINT "processing_stage_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "processing_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_stage" ADD CONSTRAINT "processing_stage_processorId_fkey" FOREIGN KEY ("processorId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_movement" ADD CONSTRAINT "processing_movement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "processing_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_movement" ADD CONSTRAINT "processing_movement_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_movement" ADD CONSTRAINT "processing_movement_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "processing_stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_delivery" ADD CONSTRAINT "processing_delivery_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "processing_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_delivery" ADD CONSTRAINT "processing_delivery_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_delivery" ADD CONSTRAINT "processing_delivery_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "processing_stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lookup_values" ADD CONSTRAINT "lookup_values_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_suppliers" ADD CONSTRAINT "lace_suppliers_laceId_fkey" FOREIGN KEY ("laceId") REFERENCES "lace_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_suppliers" ADD CONSTRAINT "lace_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "button_suppliers" ADD CONSTRAINT "button_suppliers_buttonId_fkey" FOREIGN KEY ("buttonId") REFERENCES "button_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "button_suppliers" ADD CONSTRAINT "button_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zipper_suppliers" ADD CONSTRAINT "zipper_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zipper_suppliers" ADD CONSTRAINT "zipper_suppliers_zipperId_fkey" FOREIGN KEY ("zipperId") REFERENCES "zipper_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_suppliers" ADD CONSTRAINT "thread_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_suppliers" ADD CONSTRAINT "thread_suppliers_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "thread_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elastic_suppliers" ADD CONSTRAINT "elastic_suppliers_elasticId_fkey" FOREIGN KEY ("elasticId") REFERENCES "elastic_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elastic_suppliers" ADD CONSTRAINT "elastic_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "label_suppliers" ADD CONSTRAINT "label_suppliers_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "label_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "label_suppliers" ADD CONSTRAINT "label_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_measurements" ADD CONSTRAINT "sample_measurements_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "samples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_measurements" ADD CONSTRAINT "sample_measurements_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_colorways" ADD CONSTRAINT "sample_colorways_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_colorways" ADD CONSTRAINT "sample_colorways_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "samples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_colorways" ADD CONSTRAINT "sample_colorways_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_size_sets" ADD CONSTRAINT "sample_size_sets_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_size_sets" ADD CONSTRAINT "sample_size_sets_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "samples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_size_sets" ADD CONSTRAINT "sample_size_sets_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_batches" ADD CONSTRAINT "cutting_batches_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "style_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_batches" ADD CONSTRAINT "cutting_batches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_batches" ADD CONSTRAINT "cutting_batches_cuttingOperatorId_fkey" FOREIGN KEY ("cuttingOperatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_batches" ADD CONSTRAINT "cutting_batches_fabricStockId_fkey" FOREIGN KEY ("fabricStockId") REFERENCES "fabric_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_batches" ADD CONSTRAINT "cutting_batches_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_batch_skus" ADD CONSTRAINT "cutting_batch_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_batch_skus" ADD CONSTRAINT "cutting_batch_skus_cuttingBatchId_fkey" FOREIGN KEY ("cuttingBatchId") REFERENCES "cutting_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_batch_skus" ADD CONSTRAINT "cutting_batch_skus_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_batch_defects" ADD CONSTRAINT "cutting_batch_defects_cuttingBatchId_fkey" FOREIGN KEY ("cuttingBatchId") REFERENCES "cutting_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_slips" ADD CONSTRAINT "transfer_slips_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "style_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_slips" ADD CONSTRAINT "transfer_slips_cuttingBatchId_fkey" FOREIGN KEY ("cuttingBatchId") REFERENCES "cutting_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_slips" ADD CONSTRAINT "transfer_slips_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_slips" ADD CONSTRAINT "transfer_slips_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_slips" ADD CONSTRAINT "transfer_slips_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_slip_skus" ADD CONSTRAINT "transfer_slip_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_slip_skus" ADD CONSTRAINT "transfer_slip_skus_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_slip_skus" ADD CONSTRAINT "transfer_slip_skus_transferSlipId_fkey" FOREIGN KEY ("transferSlipId") REFERENCES "transfer_slips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_receipts" ADD CONSTRAINT "stage_receipts_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_receipts" ADD CONSTRAINT "stage_receipts_transferSlipId_fkey" FOREIGN KEY ("transferSlipId") REFERENCES "transfer_slips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_receipts" ADD CONSTRAINT "stage_receipts_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_receipt_skus" ADD CONSTRAINT "stage_receipt_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_receipt_skus" ADD CONSTRAINT "stage_receipt_skus_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_receipt_skus" ADD CONSTRAINT "stage_receipt_skus_stageReceiptId_fkey" FOREIGN KEY ("stageReceiptId") REFERENCES "stage_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stitching_issues" ADD CONSTRAINT "stitching_issues_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stitching_issues" ADD CONSTRAINT "stitching_issues_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stitching_issues" ADD CONSTRAINT "stitching_issues_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stitching_issue_components" ADD CONSTRAINT "stitching_issue_components_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "style_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stitching_issue_components" ADD CONSTRAINT "stitching_issue_components_stitchingIssueId_fkey" FOREIGN KEY ("stitchingIssueId") REFERENCES "stitching_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stitching_issue_skus" ADD CONSTRAINT "stitching_issue_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stitching_issue_skus" ADD CONSTRAINT "stitching_issue_skus_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stitching_issue_skus" ADD CONSTRAINT "stitching_issue_skus_stitchingIssueId_fkey" FOREIGN KEY ("stitchingIssueId") REFERENCES "stitching_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stitching_daily_outputs" ADD CONSTRAINT "stitching_daily_outputs_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "style_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stitching_daily_outputs" ADD CONSTRAINT "stitching_daily_outputs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stitching_daily_outputs" ADD CONSTRAINT "stitching_daily_outputs_stitchingIssueId_fkey" FOREIGN KEY ("stitchingIssueId") REFERENCES "stitching_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stitching_output_skus" ADD CONSTRAINT "stitching_output_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stitching_output_skus" ADD CONSTRAINT "stitching_output_skus_dailyOutputId_fkey" FOREIGN KEY ("dailyOutputId") REFERENCES "stitching_daily_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stitching_output_skus" ADD CONSTRAINT "stitching_output_skus_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finishing_issues" ADD CONSTRAINT "finishing_issues_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finishing_issues" ADD CONSTRAINT "finishing_issues_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finishing_issues" ADD CONSTRAINT "finishing_issues_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finishing_issue_components" ADD CONSTRAINT "finishing_issue_components_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "style_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finishing_issue_components" ADD CONSTRAINT "finishing_issue_components_finishingIssueId_fkey" FOREIGN KEY ("finishingIssueId") REFERENCES "finishing_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finishing_issue_skus" ADD CONSTRAINT "finishing_issue_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finishing_issue_skus" ADD CONSTRAINT "finishing_issue_skus_finishingIssueId_fkey" FOREIGN KEY ("finishingIssueId") REFERENCES "finishing_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finishing_issue_skus" ADD CONSTRAINT "finishing_issue_skus_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finishing_daily_outputs" ADD CONSTRAINT "finishing_daily_outputs_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "style_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finishing_daily_outputs" ADD CONSTRAINT "finishing_daily_outputs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finishing_daily_outputs" ADD CONSTRAINT "finishing_daily_outputs_finishingIssueId_fkey" FOREIGN KEY ("finishingIssueId") REFERENCES "finishing_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finishing_output_skus" ADD CONSTRAINT "finishing_output_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finishing_output_skus" ADD CONSTRAINT "finishing_output_skus_dailyOutputId_fkey" FOREIGN KEY ("dailyOutputId") REFERENCES "finishing_daily_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finishing_output_skus" ADD CONSTRAINT "finishing_output_skus_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspections_mfg" ADD CONSTRAINT "quality_inspections_mfg_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspections_mfg" ADD CONSTRAINT "quality_inspections_mfg_finishingIssueId_fkey" FOREIGN KEY ("finishingIssueId") REFERENCES "finishing_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspections_mfg" ADD CONSTRAINT "quality_inspections_mfg_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspections_mfg" ADD CONSTRAINT "quality_inspections_mfg_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polybag_entries" ADD CONSTRAINT "polybag_entries_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "style_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polybag_entries" ADD CONSTRAINT "polybag_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polybag_entries" ADD CONSTRAINT "polybag_entries_finishingIssueId_fkey" FOREIGN KEY ("finishingIssueId") REFERENCES "finishing_issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polybag_skus" ADD CONSTRAINT "polybag_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polybag_skus" ADD CONSTRAINT "polybag_skus_polybagEntryId_fkey" FOREIGN KEY ("polybagEntryId") REFERENCES "polybag_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polybag_skus" ADD CONSTRAINT "polybag_skus_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carton_packings" ADD CONSTRAINT "carton_packings_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "style_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carton_packings" ADD CONSTRAINT "carton_packings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carton_packings" ADD CONSTRAINT "carton_packings_finishingIssueId_fkey" FOREIGN KEY ("finishingIssueId") REFERENCES "finishing_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carton_packings" ADD CONSTRAINT "carton_packings_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carton_skus" ADD CONSTRAINT "carton_skus_cartonId_fkey" FOREIGN KEY ("cartonId") REFERENCES "carton_packings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carton_skus" ADD CONSTRAINT "carton_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carton_skus" ADD CONSTRAINT "carton_skus_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_dips" ADD CONSTRAINT "lab_dips_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_dips" ADD CONSTRAINT "lab_dips_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_dips" ADD CONSTRAINT "lab_dips_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "fabric_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_dips" ADD CONSTRAINT "lab_dips_millId_fkey" FOREIGN KEY ("millId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_dips" ADD CONSTRAINT "lab_dips_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_dips" ADD CONSTRAINT "lab_dips_targetColorId_fkey" FOREIGN KEY ("targetColorId") REFERENCES "color_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "fabric_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_fabricStockLotId_fkey" FOREIGN KEY ("fabricStockLotId") REFERENCES "fabric_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_labDipId_fkey" FOREIGN KEY ("labDipId") REFERENCES "lab_dips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_millId_fkey" FOREIGN KEY ("millId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asn_applications" ADD CONSTRAINT "asn_applications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asn_applications" ADD CONSTRAINT "asn_applications_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asn_skus" ADD CONSTRAINT "asn_skus_asnId_fkey" FOREIGN KEY ("asnId") REFERENCES "asn_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asn_skus" ADD CONSTRAINT "asn_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asn_skus" ADD CONSTRAINT "asn_skus_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_notes_ext" ADD CONSTRAINT "delivery_notes_ext_asnId_fkey" FOREIGN KEY ("asnId") REFERENCES "asn_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_notes_ext" ADD CONSTRAINT "delivery_notes_ext_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES "delivery_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_cartons" ADD CONSTRAINT "dispatch_cartons_cartonId_fkey" FOREIGN KEY ("cartonId") REFERENCES "carton_packings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_cartons" ADD CONSTRAINT "dispatch_cartons_deliveryNoteExtId_fkey" FOREIGN KEY ("deliveryNoteExtId") REFERENCES "delivery_notes_ext"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_documents" ADD CONSTRAINT "dispatch_documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_documents" ADD CONSTRAINT "dispatch_documents_deliveryNoteExtId_fkey" FOREIGN KEY ("deliveryNoteExtId") REFERENCES "delivery_notes_ext"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_transports" ADD CONSTRAINT "dispatch_transports_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_transports" ADD CONSTRAINT "dispatch_transports_deliveryNoteExtId_fkey" FOREIGN KEY ("deliveryNoteExtId") REFERENCES "delivery_notes_ext"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_pods" ADD CONSTRAINT "dispatch_pods_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_pods" ADD CONSTRAINT "dispatch_pods_deliveryNoteExtId_fkey" FOREIGN KEY ("deliveryNoteExtId") REFERENCES "delivery_notes_ext"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testing_labs" ADD CONSTRAINT "testing_labs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_templates" ADD CONSTRAINT "test_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_physical_tests" ADD CONSTRAINT "fabric_physical_tests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_physical_tests" ADD CONSTRAINT "fabric_physical_tests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_physical_tests" ADD CONSTRAINT "fabric_physical_tests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_physical_tests" ADD CONSTRAINT "fabric_physical_tests_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "fabric_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_physical_tests" ADD CONSTRAINT "fabric_physical_tests_fabricProcurementId_fkey" FOREIGN KEY ("fabricProcurementId") REFERENCES "fabric_procurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_physical_tests" ADD CONSTRAINT "fabric_physical_tests_fabricStockLotId_fkey" FOREIGN KEY ("fabricStockLotId") REFERENCES "fabric_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_physical_tests" ADD CONSTRAINT "fabric_physical_tests_originalTestId_fkey" FOREIGN KEY ("originalTestId") REFERENCES "fabric_physical_tests"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "fabric_physical_tests" ADD CONSTRAINT "fabric_physical_tests_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_physical_tests" ADD CONSTRAINT "fabric_physical_tests_testingLabId_fkey" FOREIGN KEY ("testingLabId") REFERENCES "testing_labs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_physical_tests" ADD CONSTRAINT "garment_physical_tests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_physical_tests" ADD CONSTRAINT "garment_physical_tests_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_physical_tests" ADD CONSTRAINT "garment_physical_tests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_physical_tests" ADD CONSTRAINT "garment_physical_tests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_physical_tests" ADD CONSTRAINT "garment_physical_tests_originalTestId_fkey" FOREIGN KEY ("originalTestId") REFERENCES "garment_physical_tests"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "garment_physical_tests" ADD CONSTRAINT "garment_physical_tests_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_physical_tests" ADD CONSTRAINT "garment_physical_tests_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_physical_tests" ADD CONSTRAINT "garment_physical_tests_testingLabId_fkey" FOREIGN KEY ("testingLabId") REFERENCES "testing_labs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_physical_tests" ADD CONSTRAINT "garment_physical_tests_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hook_eye_master" ADD CONSTRAINT "hook_eye_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hook_eye_master" ADD CONSTRAINT "hook_eye_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snap_button_master" ADD CONSTRAINT "snap_button_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snap_button_master" ADD CONSTRAINT "snap_button_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buckle_master" ADD CONSTRAINT "buckle_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buckle_master" ADD CONSTRAINT "buckle_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "belt_master" ADD CONSTRAINT "belt_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "belt_master" ADD CONSTRAINT "belt_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "velcro_master" ADD CONSTRAINT "velcro_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "velcro_master" ADD CONSTRAINT "velcro_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawstring_master" ADD CONSTRAINT "drawstring_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawstring_master" ADD CONSTRAINT "drawstring_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ribbon_master" ADD CONSTRAINT "ribbon_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ribbon_master" ADD CONSTRAINT "ribbon_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequin_master" ADD CONSTRAINT "sequin_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequin_master" ADD CONSTRAINT "sequin_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bead_master" ADD CONSTRAINT "bead_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bead_master" ADD CONSTRAINT "bead_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motif_master" ADD CONSTRAINT "motif_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motif_master" ADD CONSTRAINT "motif_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interlining_master" ADD CONSTRAINT "interlining_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interlining_master" ADD CONSTRAINT "interlining_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padding_master" ADD CONSTRAINT "padding_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padding_master" ADD CONSTRAINT "padding_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_fastener_master" ADD CONSTRAINT "other_fastener_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_fastener_master" ADD CONSTRAINT "other_fastener_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_tape_master" ADD CONSTRAINT "other_tape_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_tape_master" ADD CONSTRAINT "other_tape_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_decorative_master" ADD CONSTRAINT "other_decorative_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_decorative_master" ADD CONSTRAINT "other_decorative_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_functional_master" ADD CONSTRAINT "other_functional_master_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_functional_master" ADD CONSTRAINT "other_functional_master_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ai_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_transition_overrides" ADD CONSTRAINT "stage_transition_overrides_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_transition_overrides" ADD CONSTRAINT "stage_transition_overrides_overriddenById_fkey" FOREIGN KEY ("overriddenById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_transition_overrides" ADD CONSTRAINT "stage_transition_overrides_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "samples"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_transition_overrides" ADD CONSTRAINT "stage_transition_overrides_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_label_size_config" ADD CONSTRAINT "style_label_size_config_styleMaterialBomId_fkey" FOREIGN KEY ("styleMaterialBomId") REFERENCES "style_material_bom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_label_override" ADD CONSTRAINT "order_label_override_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_label_override" ADD CONSTRAINT "order_label_override_styleMaterialBomId_fkey" FOREIGN KEY ("styleMaterialBomId") REFERENCES "style_material_bom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_label_size_override" ADD CONSTRAINT "order_label_size_override_orderLabelOverrideId_fkey" FOREIGN KEY ("orderLabelOverrideId") REFERENCES "order_label_override"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_pattern_parts" ADD CONSTRAINT "style_pattern_parts_pattern_part_id_fkey" FOREIGN KEY ("pattern_part_id") REFERENCES "pattern_part_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_pattern_parts" ADD CONSTRAINT "style_pattern_parts_style_fabric_id_fkey" FOREIGN KEY ("style_fabric_id") REFERENCES "style_fabrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embroidery_part_cad" ADD CONSTRAINT "embroidery_part_cad_embroidery_id_fkey" FOREIGN KEY ("embroidery_id") REFERENCES "embroidery_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embroidery_part_cad" ADD CONSTRAINT "embroidery_part_cad_fabric_width_cad_id_fkey" FOREIGN KEY ("fabric_width_cad_id") REFERENCES "fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embroidery_part_cad" ADD CONSTRAINT "embroidery_part_cad_style_fabric_id_fkey" FOREIGN KEY ("style_fabric_id") REFERENCES "style_fabrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embroidery_cad_size_breakdown" ADD CONSTRAINT "embroidery_cad_size_breakdown_embroidery_cad_id_fkey" FOREIGN KEY ("embroidery_cad_id") REFERENCES "embroidery_part_cad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embroidery_cad_size_breakdown" ADD CONSTRAINT "embroidery_cad_size_breakdown_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "size_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_stock" ADD CONSTRAINT "lace_stock_laceId_fkey" FOREIGN KEY ("laceId") REFERENCES "lace_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_stock" ADD CONSTRAINT "lace_stock_originStyleId_fkey" FOREIGN KEY ("originStyleId") REFERENCES "styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_stock" ADD CONSTRAINT "lace_stock_originOrderId_fkey" FOREIGN KEY ("originOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_stock" ADD CONSTRAINT "lace_stock_processingBatchId_fkey" FOREIGN KEY ("processingBatchId") REFERENCES "processing_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_stock" ADD CONSTRAINT "lace_stock_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_stock_allocation" ADD CONSTRAINT "lace_stock_allocation_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "lace_stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_stock_allocation" ADD CONSTRAINT "lace_stock_allocation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_stock_allocation" ADD CONSTRAINT "lace_stock_allocation_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_stock_allocation" ADD CONSTRAINT "lace_stock_allocation_originalStyleId_fkey" FOREIGN KEY ("originalStyleId") REFERENCES "styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_stock_allocation" ADD CONSTRAINT "lace_stock_allocation_originalOrderId_fkey" FOREIGN KEY ("originalOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_stock_allocation" ADD CONSTRAINT "lace_stock_allocation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_stock_transaction" ADD CONSTRAINT "lace_stock_transaction_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "lace_stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_stock_transaction" ADD CONSTRAINT "lace_stock_transaction_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_lab_dip" ADD CONSTRAINT "lace_lab_dip_greigeLaceId_fkey" FOREIGN KEY ("greigeLaceId") REFERENCES "lace_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_lab_dip" ADD CONSTRAINT "lace_lab_dip_processorId_fkey" FOREIGN KEY ("processorId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_lab_dip" ADD CONSTRAINT "lace_lab_dip_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_lab_dip" ADD CONSTRAINT "lace_lab_dip_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_defect_log" ADD CONSTRAINT "lace_defect_log_discoveredById_fkey" FOREIGN KEY ("discoveredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_issue_note" ADD CONSTRAINT "lace_issue_note_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "lace_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_issue_note" ADD CONSTRAINT "lace_issue_note_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_issue_note" ADD CONSTRAINT "lace_issue_note_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_issue_note" ADD CONSTRAINT "lace_issue_note_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

