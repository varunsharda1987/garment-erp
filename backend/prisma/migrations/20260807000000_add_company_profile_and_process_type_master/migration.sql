-- Migration: Add company_profile and process_type_master
-- Phase 0-1 of Job Work Consolidation
-- Created: 2026-08-07

-- CreateTable: company_profile (singleton for Kashaya Fabs identity)
CREATE TABLE "company_profile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "gstin" TEXT NOT NULL,
    "pan" TEXT,
    "stateCode" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "bankName" TEXT,
    "bankBranch" TEXT,
    "bankAccountNumber" TEXT,
    "bankIfscCode" TEXT,
    "logoUrl" TEXT,
    "signatureUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable: process_type_master (SAC codes, GST rates for job work)
CREATE TABLE "process_type_master" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sacCode" TEXT NOT NULL,
    "gstRate" DECIMAL(5,2),
    "isInterstate" BOOLEAN NOT NULL DEFAULT false,
    "unitOfMeasure" TEXT NOT NULL,
    "processCategory" TEXT NOT NULL,
    "tolerancePercent" DECIMAL(5,2) NOT NULL DEFAULT 3.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_type_master_pkey" PRIMARY KEY ("id")
);

-- AlterTable: job_work_orders - add processTypeId FK
ALTER TABLE "job_work_orders" ADD COLUMN "processTypeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "company_profile_gstin_key" ON "company_profile"("gstin");

-- CreateIndex
CREATE INDEX "company_profile_isActive_idx" ON "company_profile"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "process_type_master_code_key" ON "process_type_master"("code");

-- CreateIndex
CREATE INDEX "process_type_master_code_idx" ON "process_type_master"("code");

-- CreateIndex
CREATE INDEX "process_type_master_isActive_idx" ON "process_type_master"("isActive");

-- CreateIndex
CREATE INDEX "process_type_master_processCategory_idx" ON "process_type_master"("processCategory");

-- CreateIndex
CREATE INDEX "job_work_orders_processTypeId_idx" ON "job_work_orders"("processTypeId");

-- AddForeignKey
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_processTypeId_fkey" FOREIGN KEY ("processTypeId") REFERENCES "process_type_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;
