-- T2-1: append "lastUpdated" (= MAX of the per-lot updatedAt) to derived_stock_view as the LAST column.
-- CREATE OR REPLACE keeps columns 1-8 (materialId, warehouseId, quantity, reorderLevel, minLevel, maxLevel,
-- valuationRate, stockValue) byte-identical — Postgres rejects any change to existing view columns and only
-- allows appended trailing columns — so every already-repointed reader (Stage B/B3/valuation) is unaffected.
-- This unblocks the readers that need a last-modified timestamp (inventory reports, aging, fabric-cost asOf).
-- Rollback: re-run the prior view definition (20260719000000) which has no lastUpdated column.
CREATE OR REPLACE VIEW "derived_stock_view" AS
WITH per_lot AS (
    SELECT m."id" AS "materialId", s."warehouseId", SUM(s."quantityAvailable") AS quantity, MAX(s."updatedAt") AS last_updated
    FROM "greige_stock" s JOIN "materials" m ON m."greigeId" = s."greigeId"
    WHERE s."warehouseId" IS NOT NULL AND s."processorId" IS NULL AND (s."sourceType" IS DISTINCT FROM 'TRANSFER')
    GROUP BY m."id", s."warehouseId"
    UNION ALL
    SELECT m."id", s."warehouseId", SUM(s."quantityAvailable"), MAX(s."updatedAt")
    FROM "fabric_stock" s JOIN "materials" m ON m."fabricId" = s."fabricId"
      JOIN "fabric_master" fm ON fm."id" = s."fabricId"
    WHERE s."warehouseId" IS NOT NULL
      AND NOT (fm."finishType" = 'RAW' OR fm."isGeneric" = true OR fm."fabricCode" LIKE '%-RAW')
    GROUP BY m."id", s."warehouseId"
    UNION ALL
    SELECT m."id", s."warehouseId", SUM(s."quantityAvailable"), MAX(s."updatedAt") FROM "lace_stock" s JOIN "materials" m ON m."laceId" = s."laceId" WHERE s."warehouseId" IS NOT NULL GROUP BY m."id", s."warehouseId"
    UNION ALL
    SELECT m."id", s."warehouseId", SUM(s."quantityAvailable"), MAX(s."updatedAt") FROM "thread_stock" s JOIN "materials" m ON m."threadId" = s."threadId" WHERE s."warehouseId" IS NOT NULL GROUP BY m."id", s."warehouseId"
    UNION ALL
    SELECT m."id", s."warehouseId", SUM(s."quantityAvailable"), MAX(s."updatedAt") FROM "button_stock" s JOIN "materials" m ON m."buttonId" = s."buttonId" WHERE s."warehouseId" IS NOT NULL GROUP BY m."id", s."warehouseId"
    UNION ALL
    SELECT m."id", s."warehouseId", SUM(s."quantityAvailable"), MAX(s."updatedAt") FROM "zipper_stock" s JOIN "materials" m ON m."zipperId" = s."zipperId" WHERE s."warehouseId" IS NOT NULL GROUP BY m."id", s."warehouseId"
    UNION ALL
    SELECT m."id", s."warehouseId", SUM(s."quantityAvailable"), MAX(s."updatedAt") FROM "elastic_stock" s JOIN "materials" m ON m."elasticId" = s."elasticId" WHERE s."warehouseId" IS NOT NULL GROUP BY m."id", s."warehouseId"
    UNION ALL
    SELECT m."id", s."warehouseId", SUM(s."quantityAvailable"), MAX(s."updatedAt") FROM "label_stock" s JOIN "materials" m ON m."labelId" = s."labelId" WHERE s."warehouseId" IS NOT NULL GROUP BY m."id", s."warehouseId"
    UNION ALL
    SELECT m."id", s."warehouseId", SUM(s."quantityAvailable"), MAX(s."updatedAt") FROM "packaging_stock" s JOIN "materials" m ON m."packagingId" = s."packagingId" WHERE s."warehouseId" IS NOT NULL GROUP BY m."id", s."warehouseId"
    UNION ALL
    SELECT m."id", s."warehouseId", SUM(s."quantityAvailable"), MAX(s."updatedAt") FROM "machine_part_stock" s JOIN "materials" m ON m."machinePartId" = s."machinePartId" WHERE s."warehouseId" IS NOT NULL GROUP BY m."id", s."warehouseId"
    UNION ALL
    SELECT m."id", s."warehouseId", SUM(s."quantityAvailable"), MAX(s."updatedAt") FROM "other_material_stock" s JOIN "materials" m ON m."otherMaterialId" = s."otherMaterialId" WHERE s."warehouseId" IS NOT NULL GROUP BY m."id", s."warehouseId"
),
agg AS (
    SELECT "materialId", "warehouseId", SUM(quantity) AS quantity, MAX(last_updated) AS last_updated
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
    ROUND(a.quantity * COALESCE(ss."valuationRate", 0), 2) AS "stockValue",
    a.last_updated AS "lastUpdated"
FROM agg a
LEFT JOIN "stock_settings" ss ON ss."materialId" = a."materialId" AND ss."warehouseId" = a."warehouseId";
