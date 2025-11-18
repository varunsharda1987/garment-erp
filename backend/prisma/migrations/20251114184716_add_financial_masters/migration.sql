/*
  Warnings:

  - The values [SMALL,MEDIUM,LARGE] on the enum `CustomerCategory` will be removed. If these variants are still used in the database, this will fail.
  - The values [DOMESTIC,EXPORT] on the enum `CustomerType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `dyingCost` on the `style_costing` table. All the data in the column will be lost.
  - You are about to drop the column `embroideryCost` on the `style_costing` table. All the data in the column will be lost.
  - You are about to drop the column `handworkCost` on the `style_costing` table. All the data in the column will be lost.
  - You are about to drop the column `overheadCost` on the `style_costing` table. All the data in the column will be lost.
  - You are about to drop the column `packingCost` on the `style_costing` table. All the data in the column will be lost.
  - You are about to drop the column `totalAccessoryCost` on the `style_costing` table. All the data in the column will be lost.
  - You are about to drop the column `totalFabricCost` on the `style_costing` table. All the data in the column will be lost.
  - You are about to alter the column `profitMargin` on the `style_costing` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(5,2)`.
  - You are about to drop the column `deliveryDate` on the `styles` table. All the data in the column will be lost.
  - You are about to drop the column `orderDate` on the `styles` table. All the data in the column will be lost.
  - You are about to drop the column `orderQuantity` on the `styles` table. All the data in the column will be lost.
  - You are about to drop the column `orderValue` on the `styles` table. All the data in the column will be lost.
  - You are about to drop the column `materialCategory` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the `style_orders` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `style_size_breakdown` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `createdById` on table `style_costing` required. This step will fail if there are existing NULL values in that column.
  - Made the column `isApproved` on table `style_costing` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `createdById` to the `suppliers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `supplierCategory` to the `suppliers` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SupplierCategory" AS ENUM ('FABRIC_SUPPLIER', 'TRIMS_ACCESSORIES', 'DYEING_PRINTING', 'EMBROIDERY', 'HAND_WORK', 'CMT_UNIT', 'PACKAGING');

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

-- AlterEnum
BEGIN;
CREATE TYPE "CustomerCategory_new" AS ENUM ('DOMESTIC', 'EXPORT', 'LOCAL');
ALTER TABLE "customers" ALTER COLUMN "category" TYPE "CustomerCategory_new" USING ("category"::text::"CustomerCategory_new");
ALTER TYPE "CustomerCategory" RENAME TO "CustomerCategory_old";
ALTER TYPE "CustomerCategory_new" RENAME TO "CustomerCategory";
DROP TYPE "public"."CustomerCategory_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "CustomerType_new" AS ENUM ('BUYER');
ALTER TABLE "customers" ALTER COLUMN "type" TYPE "CustomerType_new" USING ("type"::text::"CustomerType_new");
ALTER TYPE "CustomerType" RENAME TO "CustomerType_old";
ALTER TYPE "CustomerType_new" RENAME TO "CustomerType";
DROP TYPE "public"."CustomerType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."style_orders" DROP CONSTRAINT "style_orders_styleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."style_size_breakdown" DROP CONSTRAINT "style_size_breakdown_styleId_fkey";

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "brandNames" TEXT,
ADD COLUMN     "categories" TEXT,
ADD COLUMN     "currencyCode" TEXT,
ADD COLUMN     "paymentTermsId" TEXT;

-- AlterTable
ALTER TABLE "materials" ADD COLUMN     "categoryData" JSONB,
ALTER COLUMN "costPrice" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "style_costing" DROP COLUMN "dyingCost",
DROP COLUMN "embroideryCost",
DROP COLUMN "handworkCost",
DROP COLUMN "overheadCost",
DROP COLUMN "packingCost",
DROP COLUMN "totalAccessoryCost",
DROP COLUMN "totalFabricCost",
ADD COLUMN     "accessoriesCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "adminOverhead" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cadFabricConsumption" DECIMAL(10,4),
ADD COLUMN     "cadUnit" TEXT,
ADD COLUMN     "cadWastagePercent" DECIMAL(5,2),
ADD COLUMN     "cmtCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "dyeingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "embroideryWork" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "fabricCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "factoryOverhead" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "handWork" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "otherMaterialCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "otherOverheads" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "otherProcessingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "packagingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "profitAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "transportCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "trimsCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "washingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
ALTER COLUMN "profitMargin" SET DATA TYPE DECIMAL(5,2),
ALTER COLUMN "createdById" SET NOT NULL,
ALTER COLUMN "isApproved" SET NOT NULL,
ALTER COLUMN "approvedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "styles" DROP COLUMN "deliveryDate",
DROP COLUMN "orderDate",
DROP COLUMN "orderQuantity",
DROP COLUMN "orderValue";

-- AlterTable
ALTER TABLE "suppliers" DROP COLUMN "materialCategory",
ADD COLUMN     "categoryData" JSONB,
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "creditDays" INTEGER,
ADD COLUMN     "creditLimit" DECIMAL(10,2),
ADD COLUMN     "currencyCode" TEXT,
ADD COLUMN     "paymentTermsId" TEXT,
ADD COLUMN     "supplierCategory" "SupplierCategory" NOT NULL;

-- DropTable
DROP TABLE "public"."style_orders";

-- DropTable
DROP TABLE "public"."style_size_breakdown";

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

-- CreateIndex
CREATE UNIQUE INDEX "chart_of_accounts_accountCode_key" ON "chart_of_accounts"("accountCode");

-- CreateIndex
CREATE INDEX "chart_of_accounts_accountCode_idx" ON "chart_of_accounts"("accountCode");

-- CreateIndex
CREATE INDEX "chart_of_accounts_accountType_idx" ON "chart_of_accounts"("accountType");

-- CreateIndex
CREATE INDEX "chart_of_accounts_parentAccountId_idx" ON "chart_of_accounts"("parentAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centers_costCenterCode_key" ON "cost_centers"("costCenterCode");

-- CreateIndex
CREATE INDEX "cost_centers_costCenterCode_idx" ON "cost_centers"("costCenterCode");

-- CreateIndex
CREATE INDEX "cost_centers_locationId_idx" ON "cost_centers"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "expense_types_expenseCode_key" ON "expense_types"("expenseCode");

-- CreateIndex
CREATE INDEX "expense_types_expenseCode_idx" ON "expense_types"("expenseCode");

-- CreateIndex
CREATE INDEX "expense_types_accountId_idx" ON "expense_types"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "tax_masters_taxCode_key" ON "tax_masters"("taxCode");

-- CreateIndex
CREATE INDEX "tax_masters_taxCode_idx" ON "tax_masters"("taxCode");

-- CreateIndex
CREATE INDEX "tax_masters_taxType_idx" ON "tax_masters"("taxType");

-- CreateIndex
CREATE INDEX "tax_masters_applicableFrom_idx" ON "tax_masters"("applicableFrom");

-- CreateIndex
CREATE UNIQUE INDEX "payment_terms_termCode_key" ON "payment_terms"("termCode");

-- CreateIndex
CREATE INDEX "payment_terms_termCode_idx" ON "payment_terms"("termCode");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_accountNumber_key" ON "bank_accounts"("accountNumber");

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
CREATE INDEX "customers_paymentTermsId_idx" ON "customers"("paymentTermsId");

-- CreateIndex
CREATE INDEX "customers_currencyCode_idx" ON "customers"("currencyCode");

-- CreateIndex
CREATE INDEX "suppliers_supplierCategory_idx" ON "suppliers"("supplierCategory");

-- CreateIndex
CREATE INDEX "suppliers_paymentTermsId_idx" ON "suppliers"("paymentTermsId");

-- CreateIndex
CREATE INDEX "suppliers_currencyCode_idx" ON "suppliers"("currencyCode");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_paymentTermsId_fkey" FOREIGN KEY ("paymentTermsId") REFERENCES "payment_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("currencyCode") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_paymentTermsId_fkey" FOREIGN KEY ("paymentTermsId") REFERENCES "payment_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("currencyCode") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_types" ADD CONSTRAINT "expense_types_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_types" ADD CONSTRAINT "expense_types_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_masters" ADD CONSTRAINT "tax_masters_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_terms" ADD CONSTRAINT "payment_terms_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("currencyCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
