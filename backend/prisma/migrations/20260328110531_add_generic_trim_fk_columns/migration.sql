-- AlterTable
ALTER TABLE "materials" ADD COLUMN     "beadId" TEXT,
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

-- AlterTable
ALTER TABLE "style_material_bom" ADD COLUMN     "beadId" TEXT,
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
ALTER TABLE "materials" ADD CONSTRAINT "materials_hookEyeId_fkey" FOREIGN KEY ("hookEyeId") REFERENCES "hook_eye_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_snapButtonId_fkey" FOREIGN KEY ("snapButtonId") REFERENCES "snap_button_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_buckleId_fkey" FOREIGN KEY ("buckleId") REFERENCES "buckle_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_beltId_fkey" FOREIGN KEY ("beltId") REFERENCES "belt_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_velcroId_fkey" FOREIGN KEY ("velcroId") REFERENCES "velcro_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_drawstringId_fkey" FOREIGN KEY ("drawstringId") REFERENCES "drawstring_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_ribbonId_fkey" FOREIGN KEY ("ribbonId") REFERENCES "ribbon_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_sequinId_fkey" FOREIGN KEY ("sequinId") REFERENCES "sequin_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_beadId_fkey" FOREIGN KEY ("beadId") REFERENCES "bead_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_motifId_fkey" FOREIGN KEY ("motifId") REFERENCES "motif_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_interliningId_fkey" FOREIGN KEY ("interliningId") REFERENCES "interlining_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_paddingId_fkey" FOREIGN KEY ("paddingId") REFERENCES "padding_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_otherFastenerId_fkey" FOREIGN KEY ("otherFastenerId") REFERENCES "other_fastener_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_otherTapeId_fkey" FOREIGN KEY ("otherTapeId") REFERENCES "other_tape_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_otherDecorativeId_fkey" FOREIGN KEY ("otherDecorativeId") REFERENCES "other_decorative_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_otherFunctionalId_fkey" FOREIGN KEY ("otherFunctionalId") REFERENCES "other_functional_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_hookEyeId_fkey" FOREIGN KEY ("hookEyeId") REFERENCES "hook_eye_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_snapButtonId_fkey" FOREIGN KEY ("snapButtonId") REFERENCES "snap_button_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_buckleId_fkey" FOREIGN KEY ("buckleId") REFERENCES "buckle_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_beltId_fkey" FOREIGN KEY ("beltId") REFERENCES "belt_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_velcroId_fkey" FOREIGN KEY ("velcroId") REFERENCES "velcro_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_drawstringId_fkey" FOREIGN KEY ("drawstringId") REFERENCES "drawstring_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_ribbonId_fkey" FOREIGN KEY ("ribbonId") REFERENCES "ribbon_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_sequinId_fkey" FOREIGN KEY ("sequinId") REFERENCES "sequin_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_beadId_fkey" FOREIGN KEY ("beadId") REFERENCES "bead_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_motifId_fkey" FOREIGN KEY ("motifId") REFERENCES "motif_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_interliningId_fkey" FOREIGN KEY ("interliningId") REFERENCES "interlining_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_paddingId_fkey" FOREIGN KEY ("paddingId") REFERENCES "padding_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_otherFastenerId_fkey" FOREIGN KEY ("otherFastenerId") REFERENCES "other_fastener_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_otherTapeId_fkey" FOREIGN KEY ("otherTapeId") REFERENCES "other_tape_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_otherDecorativeId_fkey" FOREIGN KEY ("otherDecorativeId") REFERENCES "other_decorative_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_material_bom" ADD CONSTRAINT "style_material_bom_otherFunctionalId_fkey" FOREIGN KEY ("otherFunctionalId") REFERENCES "other_functional_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;
