/*
  Warnings:

  - You are about to drop the column `wash_care_code` on the `greige_master` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "buyer_test_requirement_forms" ADD COLUMN     "greigeId" TEXT;

-- AlterTable
ALTER TABLE "greige_master" DROP COLUMN "wash_care_code";

-- CreateTable
CREATE TABLE "customer_fabric_wash_care" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "greigeId" TEXT NOT NULL,
    "colorId" TEXT,
    "washCareCode" TEXT NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_fabric_wash_care_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_fabric_wash_care_customerId_idx" ON "customer_fabric_wash_care"("customerId");

-- CreateIndex
CREATE INDEX "customer_fabric_wash_care_greigeId_idx" ON "customer_fabric_wash_care"("greigeId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_fabric_wash_care_customerId_greigeId_colorId_key" ON "customer_fabric_wash_care"("customerId", "greigeId", "colorId");

-- AddForeignKey
ALTER TABLE "buyer_test_requirement_forms" ADD CONSTRAINT "buyer_test_requirement_forms_greigeId_fkey" FOREIGN KEY ("greigeId") REFERENCES "greige_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_fabric_wash_care" ADD CONSTRAINT "customer_fabric_wash_care_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_fabric_wash_care" ADD CONSTRAINT "customer_fabric_wash_care_greigeId_fkey" FOREIGN KEY ("greigeId") REFERENCES "greige_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_fabric_wash_care" ADD CONSTRAINT "customer_fabric_wash_care_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_fabric_wash_care" ADD CONSTRAINT "customer_fabric_wash_care_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One code per customer + fabric when no colour is named.
--
-- Hand-added: Postgres treats NULLs as distinct in a unique index, so the generated
-- (customerId, greigeId, colorId) constraint above allows any number of colour-blank rows for
-- the same customer and fabric — which is exactly the row the TRF reads, so duplicates there
-- would make the printed code depend on row order.
CREATE UNIQUE INDEX "customer_fabric_wash_care_customer_greige_nocolor_key"
  ON "customer_fabric_wash_care" ("customerId", "greigeId")
  WHERE "colorId" IS NULL;
