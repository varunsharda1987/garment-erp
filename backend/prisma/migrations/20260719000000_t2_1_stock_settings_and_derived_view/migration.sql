-- T2-1 Stage A (ADDITIVE, reversible): stock_settings config table + derived_stock_view.
-- Nothing in the app reads these yet. Rollback: DROP VIEW derived_stock_view; DROP TABLE stock_settings;
-- Idempotent (IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT DO NOTHING).

-- 1. Slim per-(material,warehouse) policy + valuation config (persists independently of per-lot tables).
CREATE TABLE IF NOT EXISTS "stock_settings" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "reorderLevel" DECIMAL(10,3),
    "minLevel" DECIMAL(10,3),
    "maxLevel" DECIMAL(10,3),
    "valuationRate" DECIMAL(10,2),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "stock_settings_materialId_warehouseId_key" ON "stock_settings"("materialId", "warehouseId");
CREATE INDEX IF NOT EXISTS "stock_settings_materialId_idx" ON "stock_settings"("materialId");

-- 2. Backfill config 1:1 from the current stock_levels rows.
INSERT INTO "stock_settings" ("id", "materialId", "warehouseId", "reorderLevel", "minLevel", "maxLevel", "valuationRate", "updatedAt")
SELECT gen_random_uuid()::text, "materialId", "warehouseId", "reorderLevel", "minLevel", "maxLevel", "valuationRate", now()
FROM "stock_levels"
ON CONFLICT ("materialId", "warehouseId") DO NOTHING;

-- 3. Derived on-hand view: UNION-ALL of the 11 per-lot tables aggregated by (materialId, warehouseId),
--    reproducing repair-stock-ledger.ts exclusions. Each per-lot master FK is RESOLVED to the canonical
--    materials.id via the materials type-FK column (materials.id === masterId holds only for greige/fabric;
--    trims use a mat-<code> id, so a plain equality mis-keys them — this join handles both conventions).
DROP VIEW IF EXISTS "derived_stock_view";
CREATE VIEW "derived_stock_view" AS
WITH per_lot AS (
    SELECT m."id" AS "materialId", s."warehouseId", SUM(s."quantityAvailable") AS quantity
    FROM "greige_stock" s JOIN "materials" m ON m."greigeId" = s."greigeId"
    WHERE s."warehouseId" IS NOT NULL AND s."processorId" IS NULL AND (s."sourceType" IS DISTINCT FROM 'TRANSFER')
    GROUP BY m."id", s."warehouseId"
    UNION ALL
    SELECT m."id", s."warehouseId", SUM(s."quantityAvailable")
    FROM "fabric_stock" s JOIN "materials" m ON m."fabricId" = s."fabricId"
      JOIN "fabric_master" fm ON fm."id" = s."fabricId"
    WHERE s."warehouseId" IS NOT NULL
      AND NOT (fm."finishType" = 'RAW' OR fm."isGeneric" = true OR fm."fabricCode" LIKE '%-RAW')
    GROUP BY m."id", s."warehouseId"
    UNION ALL
    SELECT m."id", s."warehouseId", SUM(s."quantityAvailable") FROM "lace_stock" s JOIN "materials" m ON m."laceId" = s."laceId" WHERE s."warehouseId" IS NOT NULL GROUP BY m."id", s."warehouseId"
    UNION ALL
    SELECT m."id", s."warehouseId", SUM(s."quantityAvailable") FROM "thread_stock" s JOIN "materials" m ON m."threadId" = s."threadId" WHERE s."warehouseId" IS NOT NULL GROUP BY m."id", s."warehouseId"
    UNION ALL
    SELECT m."id", s."warehouseId", SUM(s."quantityAvailable") FROM "button_stock" s JOIN "materials" m ON m."buttonId" = s."buttonId" WHERE s."warehouseId" IS NOT NULL GROUP BY m."id", s."warehouseId"
    UNION ALL
    SELECT m."id", s."warehouseId", SUM(s."quantityAvailable") FROM "zipper_stock" s JOIN "materials" m ON m."zipperId" = s."zipperId" WHERE s."warehouseId" IS NOT NULL GROUP BY m."id", s."warehouseId"
    UNION ALL
    SELECT m."id", s."warehouseId", SUM(s."quantityAvailable") FROM "elastic_stock" s JOIN "materials" m ON m."elasticId" = s."elasticId" WHERE s."warehouseId" IS NOT NULL GROUP BY m."id", s."warehouseId"
    UNION ALL
    SELECT m."id", s."warehouseId", SUM(s."quantityAvailable") FROM "label_stock" s JOIN "materials" m ON m."labelId" = s."labelId" WHERE s."warehouseId" IS NOT NULL GROUP BY m."id", s."warehouseId"
    UNION ALL
    SELECT m."id", s."warehouseId", SUM(s."quantityAvailable") FROM "packaging_stock" s JOIN "materials" m ON m."packagingId" = s."packagingId" WHERE s."warehouseId" IS NOT NULL GROUP BY m."id", s."warehouseId"
    UNION ALL
    SELECT m."id", s."warehouseId", SUM(s."quantityAvailable") FROM "machine_part_stock" s JOIN "materials" m ON m."machinePartId" = s."machinePartId" WHERE s."warehouseId" IS NOT NULL GROUP BY m."id", s."warehouseId"
    UNION ALL
    SELECT m."id", s."warehouseId", SUM(s."quantityAvailable") FROM "other_material_stock" s JOIN "materials" m ON m."otherMaterialId" = s."otherMaterialId" WHERE s."warehouseId" IS NOT NULL GROUP BY m."id", s."warehouseId"
),
agg AS (
    SELECT "materialId", "warehouseId", SUM(quantity) AS quantity
    FROM per_lot GROUP BY "materialId", "warehouseId"
)
SELECT
    a."materialId",
    a."warehouseId",
    a.quantity,
    ss."reorderLevel",
    ss."minLevel",
    ss."maxLevel",
    ss."valuationRate",
    ROUND(a.quantity * COALESCE(ss."valuationRate", 0), 2) AS "stockValue"
FROM agg a
LEFT JOIN "stock_settings" ss ON ss."materialId" = a."materialId" AND ss."warehouseId" = a."warehouseId";
