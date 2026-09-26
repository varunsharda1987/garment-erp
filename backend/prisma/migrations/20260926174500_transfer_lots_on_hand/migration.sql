-- Stock-Out TRANSFER lots join the on-hand model (direct-to-processor plan, Phase 4e, 2026-09-26).
-- Greige a Stock-Out parked at a processor (sourceType 'TRANSFER') is ours, held there — like greige a
-- supplier delivered straight there (DIRECT, Phase 2). It now counts ON-HAND at that processor's unit:
-- issuing the Stock-Out moves stock_levels store → unit, so the view counts every greige lot in a
-- warehouse. The whole view is recreated from the live definition; only the greige condition changes.
-- The one live TRANSFER lot (GRG-0006, 500 m at Manish Textiles, CH2607-0001) moves into the view here;
-- scripts/backfill-transfer-lots-on-hand.ts books the matching +500 m into stock_levels.

-- Rebuilt 26-Sep 17:45 from the live definition AFTER 20260926170500 (label branch per size), so only
-- the greige condition differs from what is live.

CREATE OR REPLACE VIEW derived_stock_view AS
 WITH per_lot AS (
         SELECT m.id AS "materialId",
            s."warehouseId",
            sum(s."quantityAvailable") AS quantity,
            max(s."updatedAt") AS last_updated
           FROM greige_stock s
             JOIN materials m ON m."greigeId" = s."greigeId"::text
          WHERE s."warehouseId" IS NOT NULL
          GROUP BY m.id, s."warehouseId"
        UNION ALL
         SELECT m.id,
            s."warehouseId",
            sum(s."quantityAvailable") AS sum,
            max(s."updatedAt") AS max
           FROM fabric_stock s
             JOIN materials m ON m."fabricId" = s."fabricId"
             JOIN fabric_master fm ON fm.id = s."fabricId"
          WHERE s."warehouseId" IS NOT NULL AND NOT (fm."finishType" = 'RAW'::"FabricFinishType" OR fm."isGeneric" = true OR fm."fabricCode" ~~ '%-RAW'::text)
          GROUP BY m.id, s."warehouseId"
        UNION ALL
         SELECT m.id,
            s."warehouseId",
            sum(s."quantityAvailable") AS sum,
            max(s."updatedAt") AS max
           FROM lace_stock s
             JOIN materials m ON m."laceId" = s."laceId"
          WHERE s."warehouseId" IS NOT NULL
          GROUP BY m.id, s."warehouseId"
        UNION ALL
         SELECT m.id,
            s."warehouseId",
            sum(s."quantityAvailable") AS sum,
            max(s."updatedAt") AS max
           FROM thread_stock s
             JOIN materials m ON m."threadId" = s."threadId"
          WHERE s."warehouseId" IS NOT NULL
          GROUP BY m.id, s."warehouseId"
        UNION ALL
         SELECT m.id,
            s."warehouseId",
            sum(s."quantityAvailable") AS sum,
            max(s."updatedAt") AS max
           FROM button_stock s
             JOIN materials m ON m."buttonId" = s."buttonId"
          WHERE s."warehouseId" IS NOT NULL
          GROUP BY m.id, s."warehouseId"
        UNION ALL
         SELECT m.id,
            s."warehouseId",
            sum(s."quantityAvailable") AS sum,
            max(s."updatedAt") AS max
           FROM zipper_stock s
             JOIN materials m ON m."zipperId" = s."zipperId"
          WHERE s."warehouseId" IS NOT NULL
          GROUP BY m.id, s."warehouseId"
        UNION ALL
         SELECT m.id,
            s."warehouseId",
            sum(s."quantityAvailable") AS sum,
            max(s."updatedAt") AS max
           FROM elastic_stock s
             JOIN materials m ON m."elasticId" = s."elasticId"
          WHERE s."warehouseId" IS NOT NULL
          GROUP BY m.id, s."warehouseId"
        UNION ALL
         SELECT m.id,
            s."warehouseId",
            sum(s."quantityAvailable") AS sum,
            max(s."updatedAt") AS max
           FROM label_stock s
             JOIN materials m ON m."labelId" = s."labelId" AND NOT m."sizeVariantId" IS DISTINCT FROM s."sizeVariantId"
          WHERE s."warehouseId" IS NOT NULL
          GROUP BY m.id, s."warehouseId"
        UNION ALL
         SELECT m.id,
            s."warehouseId",
            sum(s."quantityAvailable") AS sum,
            max(s."updatedAt") AS max
           FROM packaging_stock s
             JOIN materials m ON m."packagingId" = s."packagingId"
          WHERE s."warehouseId" IS NOT NULL
          GROUP BY m.id, s."warehouseId"
        UNION ALL
         SELECT m.id,
            s."warehouseId",
            sum(s."quantityAvailable") AS sum,
            max(s."updatedAt") AS max
           FROM machine_part_stock s
             JOIN materials m ON m."machinePartId" = s."machinePartId"
          WHERE s."warehouseId" IS NOT NULL
          GROUP BY m.id, s."warehouseId"
        UNION ALL
         SELECT m.id,
            s."warehouseId",
            sum(s."quantityAvailable") AS sum,
            max(s."updatedAt") AS max
           FROM other_material_stock s
             JOIN materials m ON m."otherMaterialId" = s."otherMaterialId"
          WHERE s."warehouseId" IS NOT NULL
          GROUP BY m.id, s."warehouseId"
        ), agg AS (
         SELECT per_lot."materialId",
            per_lot."warehouseId",
            sum(per_lot.quantity) AS quantity,
            max(per_lot.last_updated) AS last_updated
           FROM per_lot
          GROUP BY per_lot."materialId", per_lot."warehouseId"
        )
 SELECT a."materialId",
    a."warehouseId",
    a.quantity,
    ss."reorderLevel",
    ss."minLevel",
    ss."maxLevel",
    ss."valuationRate",
    round(a.quantity * COALESCE(ss."valuationRate", 0::numeric), 2) AS "stockValue",
    a.last_updated AS "lastUpdated"
   FROM agg a
     LEFT JOIN stock_settings ss ON ss."materialId" = a."materialId" AND ss."warehouseId" = a."warehouseId"::text;
