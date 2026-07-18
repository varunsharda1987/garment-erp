-- Complete the materials one-row-per-master uniqueness: the 18 extended trim/accessory identity FKs
-- (the Phase-2 pass covered 9 of ~27). labelId stays open (labels legitimately have one row per size).
-- Nullable unique indexes: Postgres keeps NULLs distinct, so the many null rows are fine. Idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS "materials_machinePartId_key" ON "materials"("machinePartId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_otherMaterialId_key" ON "materials"("otherMaterialId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_hookEyeId_key" ON "materials"("hookEyeId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_snapButtonId_key" ON "materials"("snapButtonId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_buckleId_key" ON "materials"("buckleId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_beltId_key" ON "materials"("beltId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_velcroId_key" ON "materials"("velcroId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_drawstringId_key" ON "materials"("drawstringId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_ribbonId_key" ON "materials"("ribbonId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_sequinId_key" ON "materials"("sequinId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_beadId_key" ON "materials"("beadId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_motifId_key" ON "materials"("motifId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_interliningId_key" ON "materials"("interliningId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_paddingId_key" ON "materials"("paddingId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_otherFastenerId_key" ON "materials"("otherFastenerId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_otherTapeId_key" ON "materials"("otherTapeId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_otherDecorativeId_key" ON "materials"("otherDecorativeId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_otherFunctionalId_key" ON "materials"("otherFunctionalId");
