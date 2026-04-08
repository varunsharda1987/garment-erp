-- =============================================
-- Enum Drift Cleanup Migration
-- Creates proper enums for stock tables that were using raw strings
-- =============================================

-- Step 1: Create new enum types
CREATE TYPE "StockStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'EXHAUSTED', 'ISSUED', 'PENDING_RETURN');
CREATE TYPE "StockEntryType" AS ENUM ('GENERIC', 'PLANNED_STOCK', 'EXCESS', 'EXCESS_MOQ', 'CROSS_STYLE_REUSE', 'RETURNED', 'VARIANCE_UNUSED');
CREATE TYPE "SpecializedStockTransactionType" AS ENUM ('STOCK_IN', 'CONSUMPTION', 'RETURN', 'RETURN_TO_SUPPLIER', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'ALLOCATION', 'TRANSFER', 'TRANSFER_OUT', 'TRANSFER_IN', 'ISSUE', 'RECEIPT', 'PRICE_CORRECTION', 'EMBROIDERY_SEND_OUT', 'EMBROIDERY_RECEIPT', 'EMBROIDERY_CANCELLED', 'QUALITY_DOWNGRADE');
CREATE TYPE "TransactionReferenceType" AS ENUM ('MANUAL', 'MANUAL_ADJUSTMENT', 'CHALLAN', 'GRN', 'GRN_REJECTION', 'PROCESSING_BATCH', 'ORDER', 'TRANSFER', 'ALLOCATION', 'ISSUE_NOTE', 'EMBROIDERY_SEND_OUT', 'MATERIAL_REQUIREMENT', 'PROCESSING_DELIVERY', 'PROCUREMENT', 'ADJUSTMENT');

-- Step 2: Normalize status values before conversion
UPDATE "fabric_stock" SET "status" = 'EXHAUSTED' WHERE "status" = 'CONSUMED';

-- Step 3: Convert greige_stock
ALTER TABLE "greige_stock" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "greige_stock" ALTER COLUMN "status" TYPE "StockStatus" USING "status"::"StockStatus";
ALTER TABLE "greige_stock" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
ALTER TABLE "greige_stock" ALTER COLUMN "stockType" DROP DEFAULT;
ALTER TABLE "greige_stock" ALTER COLUMN "stockType" TYPE "StockEntryType" USING "stockType"::"StockEntryType";
ALTER TABLE "greige_stock" ALTER COLUMN "stockType" SET DEFAULT 'GENERIC';

-- Step 4: Convert fabric_stock
ALTER TABLE "fabric_stock" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "fabric_stock" ALTER COLUMN "status" TYPE "StockStatus" USING "status"::"StockStatus";
ALTER TABLE "fabric_stock" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
ALTER TABLE "fabric_stock" ALTER COLUMN "stockType" DROP DEFAULT;
ALTER TABLE "fabric_stock" ALTER COLUMN "stockType" TYPE "StockEntryType" USING "stockType"::"StockEntryType";
ALTER TABLE "fabric_stock" ALTER COLUMN "stockType" SET DEFAULT 'EXCESS';

-- Step 5: Convert lace_stock
ALTER TABLE "lace_stock" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "lace_stock" ALTER COLUMN "status" TYPE "StockStatus" USING "status"::"StockStatus";
ALTER TABLE "lace_stock" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
ALTER TABLE "lace_stock" ALTER COLUMN "stockType" DROP DEFAULT;
ALTER TABLE "lace_stock" ALTER COLUMN "stockType" TYPE "StockEntryType" USING "stockType"::"StockEntryType";
ALTER TABLE "lace_stock" ALTER COLUMN "stockType" SET DEFAULT 'PLANNED_STOCK';

-- Step 6: Convert thread_stock
ALTER TABLE "thread_stock" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "thread_stock" ALTER COLUMN "status" TYPE "StockStatus" USING "status"::"StockStatus";
ALTER TABLE "thread_stock" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
ALTER TABLE "thread_stock" ALTER COLUMN "stockType" DROP DEFAULT;
ALTER TABLE "thread_stock" ALTER COLUMN "stockType" TYPE "StockEntryType" USING "stockType"::"StockEntryType";
ALTER TABLE "thread_stock" ALTER COLUMN "stockType" SET DEFAULT 'PLANNED_STOCK';

-- Step 7: Convert transaction tables
ALTER TABLE "greige_stock_transaction" ALTER COLUMN "transactionType" TYPE "SpecializedStockTransactionType" USING "transactionType"::"SpecializedStockTransactionType";
ALTER TABLE "greige_stock_transaction" ALTER COLUMN "referenceType" TYPE "TransactionReferenceType" USING "referenceType"::"TransactionReferenceType";

ALTER TABLE "fabric_stock_transaction" ALTER COLUMN "transactionType" TYPE "SpecializedStockTransactionType" USING "transactionType"::"SpecializedStockTransactionType";
ALTER TABLE "fabric_stock_transaction" ALTER COLUMN "referenceType" TYPE "TransactionReferenceType" USING "referenceType"::"TransactionReferenceType";

ALTER TABLE "lace_stock_transaction" ALTER COLUMN "transactionType" TYPE "SpecializedStockTransactionType" USING "transactionType"::"SpecializedStockTransactionType";
ALTER TABLE "lace_stock_transaction" ALTER COLUMN "referenceType" TYPE "TransactionReferenceType" USING "referenceType"::"TransactionReferenceType";

ALTER TABLE "thread_stock_transaction" ALTER COLUMN "transactionType" TYPE "SpecializedStockTransactionType" USING "transactionType"::"SpecializedStockTransactionType";
ALTER TABLE "thread_stock_transaction" ALTER COLUMN "referenceType" TYPE "TransactionReferenceType" USING "referenceType"::"TransactionReferenceType";
