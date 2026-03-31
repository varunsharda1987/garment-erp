-- AlterTable
ALTER TABLE "order_bom_items" ADD COLUMN     "beadId" TEXT,
ADD COLUMN     "beltId" TEXT,
ADD COLUMN     "buckleId" TEXT,
ADD COLUMN     "drawstringId" TEXT,
ADD COLUMN     "hookEyeId" TEXT,
ADD COLUMN     "interliningId" TEXT,
ADD COLUMN     "motifId" TEXT,
ADD COLUMN     "otherDecorativeId" TEXT,
ADD COLUMN     "otherFastenerId" TEXT,
ADD COLUMN     "otherFunctionalId" TEXT,
ADD COLUMN     "otherTapeId" TEXT,
ADD COLUMN     "paddingId" TEXT,
ADD COLUMN     "ribbonId" TEXT,
ADD COLUMN     "sequinId" TEXT,
ADD COLUMN     "snapButtonId" TEXT,
ADD COLUMN     "velcroId" TEXT;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_hookEyeId_fkey" FOREIGN KEY ("hookEyeId") REFERENCES "hook_eye_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_snapButtonId_fkey" FOREIGN KEY ("snapButtonId") REFERENCES "snap_button_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_buckleId_fkey" FOREIGN KEY ("buckleId") REFERENCES "buckle_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_beltId_fkey" FOREIGN KEY ("beltId") REFERENCES "belt_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_velcroId_fkey" FOREIGN KEY ("velcroId") REFERENCES "velcro_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_drawstringId_fkey" FOREIGN KEY ("drawstringId") REFERENCES "drawstring_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_ribbonId_fkey" FOREIGN KEY ("ribbonId") REFERENCES "ribbon_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_sequinId_fkey" FOREIGN KEY ("sequinId") REFERENCES "sequin_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_beadId_fkey" FOREIGN KEY ("beadId") REFERENCES "bead_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_motifId_fkey" FOREIGN KEY ("motifId") REFERENCES "motif_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_interliningId_fkey" FOREIGN KEY ("interliningId") REFERENCES "interlining_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_paddingId_fkey" FOREIGN KEY ("paddingId") REFERENCES "padding_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_otherFastenerId_fkey" FOREIGN KEY ("otherFastenerId") REFERENCES "other_fastener_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_otherTapeId_fkey" FOREIGN KEY ("otherTapeId") REFERENCES "other_tape_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_otherDecorativeId_fkey" FOREIGN KEY ("otherDecorativeId") REFERENCES "other_decorative_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_otherFunctionalId_fkey" FOREIGN KEY ("otherFunctionalId") REFERENCES "other_functional_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;
