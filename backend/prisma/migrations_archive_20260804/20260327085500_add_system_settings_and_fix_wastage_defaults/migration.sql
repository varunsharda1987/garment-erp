-- AlterTable
ALTER TABLE "embroidery_part_cad" ALTER COLUMN "cadWastagePercent" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "fabric_width_cad" ALTER COLUMN "cadWastagePercent" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "style_costing_fabric_items" ALTER COLUMN "cadWastagePercent" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "dataType" TEXT NOT NULL DEFAULT 'NUMBER',
    "category" TEXT NOT NULL DEFAULT 'DEFAULTS',
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "system_settings_category_idx" ON "system_settings"("category");
