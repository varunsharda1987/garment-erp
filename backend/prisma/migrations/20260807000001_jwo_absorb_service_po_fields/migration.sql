-- Migration: Job Work Order absorbs Service PO fields
-- Phase 2 of Job Work Consolidation
-- Created: 2026-08-07
--
-- Purpose: JWO becomes the commercial document (eliminating separate Service PO)
-- Fields absorbed: GST/tax, payment terms, approval, statutory, tolerance/loss

-- AlterTable: Add commercial and statutory fields
ALTER TABLE "job_work_orders"
  -- GST/Tax fields
  ADD COLUMN "subtotal" DECIMAL(12,2),
  ADD COLUMN "gstRate" DECIMAL(5,2),
  ADD COLUMN "cgstAmount" DECIMAL(12,2),
  ADD COLUMN "sgstAmount" DECIMAL(12,2),
  ADD COLUMN "igstAmount" DECIMAL(12,2),
  ADD COLUMN "totalTaxAmount" DECIMAL(12,2),
  ADD COLUMN "totalAmount" DECIMAL(12,2),
  ADD COLUMN "isInterstate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isReverseCharge" BOOLEAN NOT NULL DEFAULT false,

  -- Payment terms
  ADD COLUMN "paymentTerms" TEXT,
  ADD COLUMN "paymentDueDays" INTEGER,

  -- Approval workflow
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),

  -- Statutory fields (Section 143 compliance)
  ADD COLUMN "statutoryDueDate" TIMESTAMP(3),
  ADD COLUMN "ewayBillNumber" TEXT,
  ADD COLUMN "ewayBillDate" TIMESTAMP(3),
  ADD COLUMN "declaredValue" DECIMAL(12,2),

  -- Tolerance and loss tracking
  ADD COLUMN "tolerancePercent" DECIMAL(5,2),
  ADD COLUMN "qtyNormalLoss" DECIMAL(10,2),
  ADD COLUMN "qtyAbnormalLoss" DECIMAL(10,2);

-- CreateIndex: approvedById for approval queries
CREATE INDEX "job_work_orders_approvedById_idx" ON "job_work_orders"("approvedById");

-- CreateIndex: statutoryDueDate for Section 143 ageing report
CREATE INDEX "job_work_orders_statutoryDueDate_idx" ON "job_work_orders"("statutoryDueDate");

-- AddForeignKey: Link to approver user
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
