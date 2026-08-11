-- Migration: JWO Components for multi-material support
-- Phase 4 of Job Work Consolidation
-- Created: 2026-08-07
--
-- Purpose: Enable one JWO to handle multiple materials (e.g., fabric + lining)
-- This replaces the need for separate models per material type

-- CreateTable: job_work_order_components
CREATE TABLE "job_work_order_components" (
    "id" TEXT NOT NULL,
    "jobWorkOrderId" TEXT NOT NULL,
    "materialType" TEXT NOT NULL,
    "greigeId" TEXT,
    "fabricId" TEXT,
    "laceId" TEXT,
    "materialId" INTEGER,
    "greigeStockId" TEXT,
    "fabricStockId" TEXT,
    "laceStockId" TEXT,
    "qtySent" DECIMAL(10,2) NOT NULL,
    "qtyReceived" DECIMAL(10,2),
    "unit" TEXT NOT NULL DEFAULT 'MTR',
    "rate" DECIMAL(10,2),
    "declaredValue" DECIMAL(12,2),
    "description" TEXT,
    "colorName" TEXT,
    "componentName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_work_order_components_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: jobWorkOrderId for JWO queries
CREATE INDEX "job_work_order_components_jobWorkOrderId_idx" ON "job_work_order_components"("jobWorkOrderId");

-- CreateIndex: materialType for filtering
CREATE INDEX "job_work_order_components_materialType_idx" ON "job_work_order_components"("materialType");

-- AddForeignKey: Link to parent JWO (cascade delete)
ALTER TABLE "job_work_order_components" ADD CONSTRAINT "job_work_order_components_jobWorkOrderId_fkey"
  FOREIGN KEY ("jobWorkOrderId") REFERENCES "job_work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Link to greige_master
ALTER TABLE "job_work_order_components" ADD CONSTRAINT "job_work_order_components_greigeId_fkey"
  FOREIGN KEY ("greigeId") REFERENCES "greige_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Link to fabric_master
ALTER TABLE "job_work_order_components" ADD CONSTRAINT "job_work_order_components_fabricId_fkey"
  FOREIGN KEY ("fabricId") REFERENCES "fabric_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Link to lace_master
ALTER TABLE "job_work_order_components" ADD CONSTRAINT "job_work_order_components_laceId_fkey"
  FOREIGN KEY ("laceId") REFERENCES "lace_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Link to greige_stock
ALTER TABLE "job_work_order_components" ADD CONSTRAINT "job_work_order_components_greigeStockId_fkey"
  FOREIGN KEY ("greigeStockId") REFERENCES "greige_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Link to fabric_stock
ALTER TABLE "job_work_order_components" ADD CONSTRAINT "job_work_order_components_fabricStockId_fkey"
  FOREIGN KEY ("fabricStockId") REFERENCES "fabric_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Link to lace_stock
ALTER TABLE "job_work_order_components" ADD CONSTRAINT "job_work_order_components_laceStockId_fkey"
  FOREIGN KEY ("laceStockId") REFERENCES "lace_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
