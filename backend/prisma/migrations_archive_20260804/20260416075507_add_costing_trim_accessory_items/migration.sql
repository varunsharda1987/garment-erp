-- CreateTable
CREATE TABLE "style_costing_trim_items" (
    "id" TEXT NOT NULL,
    "costingId" TEXT NOT NULL,
    "trimName" TEXT NOT NULL,
    "trimQuantity" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "trimRate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "trimTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "unit" TEXT,
    "isNotApplicable" BOOLEAN NOT NULL DEFAULT false,
    "materialType" TEXT,
    "bomId" TEXT,
    "materialId" TEXT,
    "threadId" TEXT,
    "buttonId" TEXT,
    "zipperId" TEXT,
    "elasticId" TEXT,
    "labelId" TEXT,
    "packagingId" TEXT,
    "hookEyeId" TEXT,
    "snapButtonId" TEXT,
    "buckleId" TEXT,
    "beltId" TEXT,
    "velcroId" TEXT,
    "drawstringId" TEXT,
    "ribbonId" TEXT,
    "sequinId" TEXT,
    "beadId" TEXT,
    "motifId" TEXT,
    "interliningId" TEXT,
    "paddingId" TEXT,
    "otherFastenerId" TEXT,
    "otherTapeId" TEXT,
    "otherDecorativeId" TEXT,
    "otherFunctionalId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_costing_trim_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_costing_accessory_items" (
    "id" TEXT NOT NULL,
    "costingId" TEXT NOT NULL,
    "accessoryName" TEXT NOT NULL,
    "accessoryQuantity" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "accessoryRate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "accessoryTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isNotApplicable" BOOLEAN NOT NULL DEFAULT false,
    "materialType" TEXT,
    "materialId" TEXT,
    "labelId" TEXT,
    "packagingId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_costing_accessory_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "style_costing_trim_items_costingId_idx" ON "style_costing_trim_items"("costingId");

-- CreateIndex
CREATE INDEX "style_costing_trim_items_materialType_idx" ON "style_costing_trim_items"("materialType");

-- CreateIndex
CREATE INDEX "style_costing_trim_items_threadId_idx" ON "style_costing_trim_items"("threadId");

-- CreateIndex
CREATE INDEX "style_costing_trim_items_buttonId_idx" ON "style_costing_trim_items"("buttonId");

-- CreateIndex
CREATE INDEX "style_costing_trim_items_zipperId_idx" ON "style_costing_trim_items"("zipperId");

-- CreateIndex
CREATE INDEX "style_costing_trim_items_elasticId_idx" ON "style_costing_trim_items"("elasticId");

-- CreateIndex
CREATE INDEX "style_costing_trim_items_labelId_idx" ON "style_costing_trim_items"("labelId");

-- CreateIndex
CREATE INDEX "style_costing_accessory_items_costingId_idx" ON "style_costing_accessory_items"("costingId");

-- CreateIndex
CREATE INDEX "style_costing_accessory_items_materialType_idx" ON "style_costing_accessory_items"("materialType");

-- CreateIndex
CREATE INDEX "style_costing_accessory_items_labelId_idx" ON "style_costing_accessory_items"("labelId");

-- CreateIndex
CREATE INDEX "style_costing_accessory_items_packagingId_idx" ON "style_costing_accessory_items"("packagingId");

-- AddForeignKey
ALTER TABLE "style_costing_trim_items" ADD CONSTRAINT "style_costing_trim_items_costingId_fkey" FOREIGN KEY ("costingId") REFERENCES "style_costing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_trim_items" ADD CONSTRAINT "style_costing_trim_items_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "thread_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_trim_items" ADD CONSTRAINT "style_costing_trim_items_buttonId_fkey" FOREIGN KEY ("buttonId") REFERENCES "button_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_trim_items" ADD CONSTRAINT "style_costing_trim_items_zipperId_fkey" FOREIGN KEY ("zipperId") REFERENCES "zipper_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_trim_items" ADD CONSTRAINT "style_costing_trim_items_elasticId_fkey" FOREIGN KEY ("elasticId") REFERENCES "elastic_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_trim_items" ADD CONSTRAINT "style_costing_trim_items_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "label_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_trim_items" ADD CONSTRAINT "style_costing_trim_items_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "packaging_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_trim_items" ADD CONSTRAINT "style_costing_trim_items_hookEyeId_fkey" FOREIGN KEY ("hookEyeId") REFERENCES "hook_eye_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_trim_items" ADD CONSTRAINT "style_costing_trim_items_snapButtonId_fkey" FOREIGN KEY ("snapButtonId") REFERENCES "snap_button_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_trim_items" ADD CONSTRAINT "style_costing_trim_items_buckleId_fkey" FOREIGN KEY ("buckleId") REFERENCES "buckle_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_trim_items" ADD CONSTRAINT "style_costing_trim_items_beltId_fkey" FOREIGN KEY ("beltId") REFERENCES "belt_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_trim_items" ADD CONSTRAINT "style_costing_trim_items_velcroId_fkey" FOREIGN KEY ("velcroId") REFERENCES "velcro_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_trim_items" ADD CONSTRAINT "style_costing_trim_items_drawstringId_fkey" FOREIGN KEY ("drawstringId") REFERENCES "drawstring_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_trim_items" ADD CONSTRAINT "style_costing_trim_items_ribbonId_fkey" FOREIGN KEY ("ribbonId") REFERENCES "ribbon_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_trim_items" ADD CONSTRAINT "style_costing_trim_items_sequinId_fkey" FOREIGN KEY ("sequinId") REFERENCES "sequin_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_trim_items" ADD CONSTRAINT "style_costing_trim_items_beadId_fkey" FOREIGN KEY ("beadId") REFERENCES "bead_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_trim_items" ADD CONSTRAINT "style_costing_trim_items_motifId_fkey" FOREIGN KEY ("motifId") REFERENCES "motif_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_trim_items" ADD CONSTRAINT "style_costing_trim_items_interliningId_fkey" FOREIGN KEY ("interliningId") REFERENCES "interlining_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_trim_items" ADD CONSTRAINT "style_costing_trim_items_paddingId_fkey" FOREIGN KEY ("paddingId") REFERENCES "padding_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_trim_items" ADD CONSTRAINT "style_costing_trim_items_otherFastenerId_fkey" FOREIGN KEY ("otherFastenerId") REFERENCES "other_fastener_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_trim_items" ADD CONSTRAINT "style_costing_trim_items_otherTapeId_fkey" FOREIGN KEY ("otherTapeId") REFERENCES "other_tape_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_trim_items" ADD CONSTRAINT "style_costing_trim_items_otherDecorativeId_fkey" FOREIGN KEY ("otherDecorativeId") REFERENCES "other_decorative_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_trim_items" ADD CONSTRAINT "style_costing_trim_items_otherFunctionalId_fkey" FOREIGN KEY ("otherFunctionalId") REFERENCES "other_functional_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_accessory_items" ADD CONSTRAINT "style_costing_accessory_items_costingId_fkey" FOREIGN KEY ("costingId") REFERENCES "style_costing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_accessory_items" ADD CONSTRAINT "style_costing_accessory_items_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "label_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing_accessory_items" ADD CONSTRAINT "style_costing_accessory_items_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "packaging_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;
