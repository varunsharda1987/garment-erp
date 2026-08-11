-- Migration: JWO Schema Refinement
-- Phase 7 of Job Work Consolidation
-- Created: 2026-08-09
--
-- Purpose:
-- 1. Relax required fields on job_work_orders (enable multi-material/garment JWOs)
-- 2. Add missing fields to job_work_order_components
-- 3. Add challan_items.jobWorkOrderComponentId for D5 reconciliation
-- 4. Add challans.reasonForTransport for Rule 55 compliance
-- 5. Create universal JobWorkOrderStatus enum

-- ========================================
-- Step 1: Relax required fields on job_work_orders
-- ========================================

-- Make styleId optional (garment JWOs may not have a style)
ALTER TABLE "job_work_orders" ALTER COLUMN "styleId" DROP NOT NULL;

-- Make fabricId optional (multi-material JWOs use components table)
ALTER TABLE "job_work_orders" ALTER COLUMN "fabricId" DROP NOT NULL;

-- Make fabricStockLotId optional
ALTER TABLE "job_work_orders" ALTER COLUMN "fabricStockLotId" DROP NOT NULL;

-- Make fabricType optional
ALTER TABLE "job_work_orders" ALTER COLUMN "fabricType" DROP NOT NULL;

-- Make sentWidthInches optional (not relevant for garments)
ALTER TABLE "job_work_orders" ALTER COLUMN "sentWidthInches" DROP NOT NULL;

-- Add uom field (unit of measure: MTR, PCS, KG)
ALTER TABLE "job_work_orders" ADD COLUMN "uom" TEXT DEFAULT 'MTR';

-- ========================================
-- Step 2: Add missing fields to job_work_order_components
-- ========================================

-- isChargeable: whether this component adds to the processing cost (R3 requirement)
ALTER TABLE "job_work_order_components" ADD COLUMN "isChargeable" BOOLEAN NOT NULL DEFAULT true;

-- isReturnable: whether this component is expected back (some consumables aren't)
ALTER TABLE "job_work_order_components" ADD COLUMN "isReturnable" BOOLEAN NOT NULL DEFAULT true;

-- hsnCode: HSN code for this component (for GST invoicing)
ALTER TABLE "job_work_order_components" ADD COLUMN "hsnCode" TEXT;

-- threadStockId: FK to thread_stock (for thread components)
ALTER TABLE "job_work_order_components" ADD COLUMN "threadStockId" TEXT;

-- rateAtIssue: snapshot of rate at issue time (D4 immutable rate requirement)
ALTER TABLE "job_work_order_components" ADD COLUMN "rateAtIssue" DECIMAL(12, 4);

-- qtyNormalLoss and qtyAbnormalLoss per component
ALTER TABLE "job_work_order_components" ADD COLUMN "qtyNormalLoss" DECIMAL(10, 3);
ALTER TABLE "job_work_order_components" ADD COLUMN "qtyAbnormalLoss" DECIMAL(10, 3);

-- Increase quantity precision to (14,3) per spec
ALTER TABLE "job_work_order_components" ALTER COLUMN "qtySent" TYPE DECIMAL(14, 3);
ALTER TABLE "job_work_order_components" ALTER COLUMN "qtyReceived" TYPE DECIMAL(14, 3);

-- CreateIndex: threadStockId
CREATE INDEX "job_work_order_components_threadStockId_idx" ON "job_work_order_components"("threadStockId");

-- AddForeignKey: Link to thread_stock
ALTER TABLE "job_work_order_components" ADD CONSTRAINT "job_work_order_components_threadStockId_fkey"
  FOREIGN KEY ("threadStockId") REFERENCES "thread_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ========================================
-- Step 3: Add jobWorkOrderComponentId to challan_items
-- ========================================

-- For D5 reconciliation: link challan line to specific JWO component
ALTER TABLE "challan_items" ADD COLUMN "jobWorkOrderComponentId" TEXT;

-- CreateIndex
CREATE INDEX "challan_items_jobWorkOrderComponentId_idx" ON "challan_items"("jobWorkOrderComponentId");

-- AddForeignKey
ALTER TABLE "challan_items" ADD CONSTRAINT "challan_items_jobWorkOrderComponentId_fkey"
  FOREIGN KEY ("jobWorkOrderComponentId") REFERENCES "job_work_order_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ========================================
-- Step 4: Add reasonForTransport to challans
-- ========================================

-- Rule 55 requirement: reason for transport (e.g., "JOB WORK — NOT A SUPPLY")
ALTER TABLE "challans" ADD COLUMN "reasonForTransport" TEXT;

-- ========================================
-- Step 5: Create universal JobWorkOrderStatus enum
-- ========================================

-- Create new enum with universal lifecycle
-- Note: We keep the old JobWorkStatus for backwards compatibility
-- New JWOs should use the new status field pattern
CREATE TYPE "JobWorkOrderStatus" AS ENUM (
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
  'CANCELLED'
);

-- Add new status field (nullable during migration, will coexist with old status)
ALTER TABLE "job_work_orders" ADD COLUMN "jwoStatus" "JobWorkOrderStatus";

-- CreateIndex: jwoStatus for status queries
CREATE INDEX "job_work_orders_jwoStatus_idx" ON "job_work_orders"("jwoStatus");

-- ========================================
-- Step 6: Add debit_notes.jobWorkOrderId link
-- ========================================

-- Check if debit_notes table exists before adding column
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'debit_notes') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'debit_notes' AND column_name = 'jobWorkOrderId') THEN
      ALTER TABLE "debit_notes" ADD COLUMN "jobWorkOrderId" TEXT;
      CREATE INDEX "debit_notes_jobWorkOrderId_idx" ON "debit_notes"("jobWorkOrderId");
    END IF;
  END IF;
END $$;
