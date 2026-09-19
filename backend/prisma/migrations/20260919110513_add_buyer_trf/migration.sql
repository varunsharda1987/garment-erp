-- CreateEnum
CREATE TYPE "TrfStatus" AS ENUM ('DRAFT', 'ISSUED', 'SENT_TO_LAB', 'CLOSED');

-- CreateEnum
CREATE TYPE "TrfPackageType" AS ENUM ('KNIT', 'WOVEN', 'RETEST');

-- CreateEnum
CREATE TYPE "TrfSampleStage" AS ENUM ('PP', 'SHIPMENT');

-- CreateEnum
CREATE TYPE "TrfFinishType" AS ENUM ('REGULAR_FINISH', 'PEACH_FINISH', 'GARMENT_WASH', 'OTHER_DYE');

-- CreateEnum
CREATE TYPE "TrfServiceLevel" AS ENUM ('REGULAR', 'EXPRESS', 'SAME_DAY');

-- CreateEnum
CREATE TYPE "TrfBuyingDepartment" AS ENUM ('KIDS_WEAR', 'MENS_WEAR', 'WOMENS_WEAR', 'INDIAN_WEAR', 'INNER_WEAR', 'ACCESSORIES');

-- CreateEnum
CREATE TYPE "TrfBuyingSubCategory" AS ENUM ('KIDS_BOYS', 'KIDS_GIRLS', 'KIDS_INFANT', 'KIDS_AGE_2_8Y', 'KIDS_AGE_8_16Y', 'MENS_CASUALS', 'MENS_DENIM', 'MENS_POLO_TEES', 'MENS_URBAN_UTILITY', 'WOMENS_DENIM', 'WOMENS_NIGHT_WEAR', 'WOMENS_DRESS', 'WOMENS_SMART');

-- CreateEnum
CREATE TYPE "TrfTestCode" AS ENUM ('AFTER_HOME_LAUNDERING_3_WASH', 'AFTER_DRY_CLEANING_1_CYCLE', 'DIM_STABILITY_WASHING', 'DIM_STABILITY_DRY_CLEANING', 'COLOR_FASTNESS_WASHING', 'COLOR_FASTNESS_DRY_CLEANING', 'COLOR_FASTNESS_RUBBING', 'COLOR_FASTNESS_LIGHT', 'COLOR_FASTNESS_PERSPIRATION', 'COLOR_FASTNESS_WATER', 'COLOR_FASTNESS_SALIVA', 'SEAM_SLIPPAGE_STRENGTH', 'BURSTING_STRENGTH', 'PILLING_RESISTANCE', 'ABRASION_RESISTANCE', 'STRETCH_AND_RECOVERY', 'FABRIC_WEIGHT', 'YARN_COUNT', 'FABRIC_CONSTRUCTION', 'FIBER_CONTENT', 'TENSILE_STRENGTH', 'TEAR_STRENGTH', 'FLAMMABILITY', 'ZIPPER_PULL_STRENGTH', 'SLIDER_LOCK_STRENGTH', 'BOTTOM_STOP_HOLDING_STRENGTH', 'TOP_STOP_HOLDING_STRENGTH', 'LATERAL_STRENGTH_TESTING', 'PH_VALUE', 'FORMALDEHYDE_UV_VIS', 'ODOUR', 'DYE_TRANSFER_STORAGE', 'CORROSION_RESISTANCE_METAL_PARTS');

-- AlterTable
ALTER TABLE "company_profile" ADD COLUMN     "contactPerson" TEXT;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "vendor_code" TEXT;

-- AlterTable
ALTER TABLE "greige_master" ADD COLUMN     "wash_care_code" TEXT;

-- CreateTable
CREATE TABLE "buyer_test_requirement_forms" (
    "id" TEXT NOT NULL,
    "trfNumber" TEXT NOT NULL,
    "trfDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "TrfStatus" NOT NULL DEFAULT 'DRAFT',
    "workOrderId" TEXT,
    "saleOrderId" TEXT,
    "styleId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "testingLabId" TEXT,
    "sampleDescription" TEXT,
    "endUse" TEXT,
    "boNumber" TEXT NOT NULL DEFAULT 'Not required',
    "styleNo" TEXT,
    "buyerStyleRef" TEXT,
    "colour" TEXT,
    "fibreContent" TEXT,
    "ageRangeCategory" TEXT,
    "orderNumber" TEXT,
    "fabricWeightGsm" TEXT,
    "yarnCount" TEXT,
    "construction" TEXT,
    "season" TEXT,
    "manufacturerName" TEXT,
    "brandName" TEXT,
    "fabricSupplierName" TEXT,
    "vendorCode" TEXT,
    "dyeingHouse" TEXT,
    "processingHouse" TEXT,
    "washCareCode" TEXT,
    "merchandiserName" TEXT,
    "merchandiserEmail" TEXT,
    "applicantContact" TEXT,
    "applicantPhone" TEXT,
    "applicantEmail" TEXT,
    "packageType" "TrfPackageType" NOT NULL DEFAULT 'WOVEN',
    "previousReportNo" TEXT,
    "sampleStage" "TrfSampleStage" NOT NULL DEFAULT 'PP',
    "finishType" "TrfFinishType" NOT NULL DEFAULT 'GARMENT_WASH',
    "buyingDepartment" "TrfBuyingDepartment" NOT NULL,
    "buyingSubCategories" "TrfBuyingSubCategory"[],
    "selectedTests" "TrfTestCode"[],
    "serviceRequired" "TrfServiceLevel" NOT NULL DEFAULT 'EXPRESS',
    "reportDeliveryService" BOOLEAN DEFAULT true,
    "returnRemainedSample" BOOLEAN DEFAULT true,
    "contrastTrimUsed" BOOLEAN,
    "setsPackingDifferentColour" BOOLEAN,
    "remarks" TEXT,
    "printCount" INTEGER NOT NULL DEFAULT 0,
    "lastPrintedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyer_test_requirement_forms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "buyer_test_requirement_forms_trfNumber_key" ON "buyer_test_requirement_forms"("trfNumber");

-- CreateIndex
CREATE INDEX "buyer_test_requirement_forms_styleId_idx" ON "buyer_test_requirement_forms"("styleId");

-- CreateIndex
CREATE INDEX "buyer_test_requirement_forms_customerId_idx" ON "buyer_test_requirement_forms"("customerId");

-- CreateIndex
CREATE INDEX "buyer_test_requirement_forms_workOrderId_idx" ON "buyer_test_requirement_forms"("workOrderId");

-- CreateIndex
CREATE INDEX "buyer_test_requirement_forms_saleOrderId_idx" ON "buyer_test_requirement_forms"("saleOrderId");

-- CreateIndex
CREATE INDEX "buyer_test_requirement_forms_testingLabId_idx" ON "buyer_test_requirement_forms"("testingLabId");

-- CreateIndex
CREATE INDEX "buyer_test_requirement_forms_status_idx" ON "buyer_test_requirement_forms"("status");

-- CreateIndex
CREATE INDEX "buyer_test_requirement_forms_createdAt_idx" ON "buyer_test_requirement_forms"("createdAt");

-- AddForeignKey
ALTER TABLE "buyer_test_requirement_forms" ADD CONSTRAINT "buyer_test_requirement_forms_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_test_requirement_forms" ADD CONSTRAINT "buyer_test_requirement_forms_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_test_requirement_forms" ADD CONSTRAINT "buyer_test_requirement_forms_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_test_requirement_forms" ADD CONSTRAINT "buyer_test_requirement_forms_saleOrderId_fkey" FOREIGN KEY ("saleOrderId") REFERENCES "sale_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_test_requirement_forms" ADD CONSTRAINT "buyer_test_requirement_forms_testingLabId_fkey" FOREIGN KEY ("testingLabId") REFERENCES "testing_labs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_test_requirement_forms" ADD CONSTRAINT "buyer_test_requirement_forms_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A TRF is anchored to EXACTLY ONE of: a work order (the production run the sample came
-- out of) or a sale order (the buyer order it is for, and the source of the printed
-- "Order Number"). Never both, never neither.
--
-- Hand-added: Prisma does not generate CHECK constraints. The same rule is enforced twice
-- more above the database — a Zod .superRefine on create and update so a bad payload is a
-- readable 400, and a service-level guard that merges the existing row with the patch
-- before updating, because Zod cannot see the row being patched. This constraint is the
-- backstop that makes those two impossible to bypass.
ALTER TABLE "buyer_test_requirement_forms"
  ADD CONSTRAINT "buyer_trf_anchor_xor"
  CHECK ((("workOrderId" IS NOT NULL)::int + ("saleOrderId" IS NOT NULL)::int) = 1);
