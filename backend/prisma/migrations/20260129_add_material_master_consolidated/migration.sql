-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('FABRIC', 'GREIGE', 'LACE', 'BUTTON', 'THREAD', 'ZIPPER', 'ELASTIC', 'LABEL', 'PACKAGING', 'MACHINE_PART', 'HOOK_EYE', 'SNAP_BUTTON', 'BUCKLE', 'BELT', 'VELCRO', 'DRAWSTRING', 'RIBBON', 'SEQUIN', 'BEAD', 'MOTIF', 'INTERLINING', 'PADDING', 'OTHER_FASTENER', 'OTHER_TAPE', 'OTHER_DECORATIVE', 'OTHER_FUNCTIONAL', 'OTHER_MATERIAL');

-- CreateTable
CREATE TABLE "material_master" (
    "id" SERIAL NOT NULL,
    "material_type" "MaterialType" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_per_unit" DECIMAL(10,2),
    "price_per_meter" DECIMAL(10,2),
    "price_per_piece" DECIMAL(10,2),
    "price_per_kg" DECIMAL(10,2),
    "price_per_gross" DECIMAL(10,2),
    "unit" TEXT,
    "currency_id" INTEGER,
    "specifications" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "hsn_code" TEXT,
    "gst_rate" DECIMAL(5,2),
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "legacy_lace_id" INTEGER,
    "legacy_button_id" INTEGER,
    "legacy_thread_id" INTEGER,
    "legacy_zipper_id" INTEGER,
    "legacy_elastic_id" INTEGER,
    "legacy_label_id" INTEGER,
    "legacy_packaging_id" INTEGER,
    "legacy_machine_part_id" INTEGER,

    CONSTRAINT "material_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_supplier_mapping" (
    "id" SERIAL NOT NULL,
    "material_id" INTEGER NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "supplier_code" TEXT,
    "supplier_name" TEXT,
    "supplier_price" DECIMAL(10,2),
    "lead_time_days" INTEGER,
    "moq" DECIMAL(10,2),
    "moq_unit" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "last_purchase_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_supplier_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "material_master_code_key" ON "material_master"("code");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacy_lace_id_key" ON "material_master"("legacy_lace_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacy_button_id_key" ON "material_master"("legacy_button_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacy_thread_id_key" ON "material_master"("legacy_thread_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacy_zipper_id_key" ON "material_master"("legacy_zipper_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacy_elastic_id_key" ON "material_master"("legacy_elastic_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacy_label_id_key" ON "material_master"("legacy_label_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacy_packaging_id_key" ON "material_master"("legacy_packaging_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_master_legacy_machine_part_id_key" ON "material_master"("legacy_machine_part_id");

-- CreateIndex
CREATE INDEX "material_master_material_type_idx" ON "material_master"("material_type");

-- CreateIndex
CREATE INDEX "material_master_code_idx" ON "material_master"("code");

-- CreateIndex
CREATE INDEX "material_master_is_active_idx" ON "material_master"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "material_supplier_mapping_material_id_supplier_id_key" ON "material_supplier_mapping"("material_id", "supplier_id");

-- CreateIndex
CREATE INDEX "material_supplier_mapping_supplier_id_idx" ON "material_supplier_mapping"("supplier_id");

-- CreateIndex
CREATE INDEX "material_supplier_mapping_is_primary_idx" ON "material_supplier_mapping"("is_primary");

-- AddForeignKey
ALTER TABLE "material_master" ADD CONSTRAINT "material_master_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_master" ADD CONSTRAINT "material_master_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_supplier_mapping" ADD CONSTRAINT "material_supplier_mapping_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "material_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_supplier_mapping" ADD CONSTRAINT "material_supplier_mapping_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
