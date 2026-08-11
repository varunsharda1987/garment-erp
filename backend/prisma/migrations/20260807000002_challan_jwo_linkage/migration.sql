-- Migration: Challan line-level JWO linkage
-- Phase 3 of Job Work Consolidation
-- Created: 2026-08-07
--
-- Purpose: Link challan items directly to job work orders
-- Enables partial movements (multiple challans per JWO, multiple JWOs per challan)

-- AlterTable: challan_items - add JWO linkage
ALTER TABLE "challan_items"
  ADD COLUMN "jobWorkOrderId" TEXT,
  ADD COLUMN "declaredValue" DECIMAL(12,2);

-- AlterTable: challans - add e-way bill fields
ALTER TABLE "challans"
  ADD COLUMN "ewayBillNumber" TEXT,
  ADD COLUMN "ewayBillDate" TIMESTAMP(3),
  ADD COLUMN "totalDeclaredValue" DECIMAL(12,2);

-- CreateIndex: jobWorkOrderId for JWO queries
CREATE INDEX "challan_items_jobWorkOrderId_idx" ON "challan_items"("jobWorkOrderId");

-- AddForeignKey: Link challan item to job work order
ALTER TABLE "challan_items" ADD CONSTRAINT "challan_items_jobWorkOrderId_fkey"
  FOREIGN KEY ("jobWorkOrderId") REFERENCES "job_work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
