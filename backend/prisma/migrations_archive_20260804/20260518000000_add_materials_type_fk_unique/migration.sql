-- Enforce ONE materials row per master, preventing the FAB-RAW phantom / split-ledger class from
-- recurring. Uses nullable unique indexes (Postgres keeps NULLs distinct, so the many null rows are
-- fine). labelId is intentionally NOT unique: labels legitimately have one materials row per size.
-- IF NOT EXISTS: these were applied on dev out-of-band during the material-module repair.
CREATE UNIQUE INDEX IF NOT EXISTS "materials_greigeId_key" ON "materials"("greigeId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_fabricId_key" ON "materials"("fabricId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_laceId_key" ON "materials"("laceId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_threadId_key" ON "materials"("threadId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_buttonId_key" ON "materials"("buttonId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_zipperId_key" ON "materials"("zipperId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_elasticId_key" ON "materials"("elasticId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_packagingId_key" ON "materials"("packagingId");
