-- CreateEnum
CREATE TYPE "HSNSACType" AS ENUM ('HSN', 'SAC');

-- CreateTable
CREATE TABLE "hsn_sac_masters" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "HSNSACType" NOT NULL,
    "description" TEXT NOT NULL,
    "chapter" TEXT,
    "section" TEXT,
    "defaultGstRate" DECIMAL(5,2) NOT NULL,
    "unit" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hsn_sac_masters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hsn_sac_masters_code_key" ON "hsn_sac_masters"("code");
CREATE INDEX "hsn_sac_masters_code_idx" ON "hsn_sac_masters"("code");
CREATE INDEX "hsn_sac_masters_type_idx" ON "hsn_sac_masters"("type");
CREATE INDEX "hsn_sac_masters_chapter_idx" ON "hsn_sac_masters"("chapter");
