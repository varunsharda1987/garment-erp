-- 1. order_item_breakup: the composite unique (orderItemId, colorId, sizeId) does not
--    protect rows where colorId IS NULL (Postgres treats NULLs as distinct), so duplicate
--    size-only breakup rows were possible. Server-side dedup exists; this closes the DB gap.
CREATE UNIQUE INDEX IF NOT EXISTS "order_item_breakup_item_size_nullcolor_key"
  ON "order_item_breakup" ("orderItemId", "sizeId")
  WHERE "colorId" IS NULL;

-- 2. po_source_links: one link per (PO item, source record). All four source FKs are
--    nullable, so the DB previously allowed duplicate links that double-count sourcing.
CREATE UNIQUE INDEX IF NOT EXISTS "po_source_links_item_matreq_key"
  ON "po_source_links" ("purchaseOrderItemId", "materialRequirementId")
  WHERE "materialRequirementId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "po_source_links_item_servreq_key"
  ON "po_source_links" ("purchaseOrderItemId", "serviceRequirementId")
  WHERE "serviceRequirementId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "po_source_links_item_costsheet_key"
  ON "po_source_links" ("purchaseOrderItemId", "costSheetGenerationId")
  WHERE "costSheetGenerationId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "po_source_links_item_prodrun_key"
  ON "po_source_links" ("purchaseOrderItemId", "productionRunId")
  WHERE "productionRunId" IS NOT NULL;

-- 3. po_source_links: a link may carry at most one polymorphic source FK.
--    (<= 1, not = 1: POSource.MANUAL links legitimately carry none.)
ALTER TABLE "po_source_links"
  ADD CONSTRAINT "po_source_links_single_source_check"
  CHECK (num_nonnulls(
    "materialRequirementId", "serviceRequirementId",
    "costSheetGenerationId", "productionRunId"
  ) <= 1);

-- 4. style_costing_trim_items: at most one of the 24 master FKs may be set per row.
ALTER TABLE "style_costing_trim_items"
  ADD CONSTRAINT "style_costing_trim_items_single_master_check"
  CHECK (num_nonnulls(
    "materialId", "threadId", "buttonId", "zipperId", "elasticId", "labelId",
    "packagingId", "hookEyeId", "snapButtonId", "buckleId", "beltId", "velcroId",
    "drawstringId", "ribbonId", "sequinId", "beadId", "motifId", "interliningId",
    "paddingId", "otherFastenerId", "otherTapeId", "otherDecorativeId",
    "otherFunctionalId", "masterId"
  ) <= 1);
