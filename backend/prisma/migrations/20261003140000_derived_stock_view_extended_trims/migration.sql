-- The 16 extended trims in derived_stock_view (2026-10-03).
--
-- Hook-eye, snap button, buckle, belt, velcro, drawstring, ribbon, sequin, bead, motif, interlining, padding and
-- other fastener / tape / decorative / functional have NO lot table: a receipt books them in stock_levels only
-- (stock-routing.helper routeToSpecializedStock returns routed:false), and every stock-out, adjustment and transfer
-- keeps stock_levels in step. derived_stock_view read only the 11 lot tables, so these materials read 0 on Stock
-- Levels, the run page, the stage gate, Trim Issuance, MRP, Use Stock and receipt holds the moment one is received.
--
-- One branch is added: their stock_levels rows. It is narrowed to materials carrying one of those 16 master FKs, so
-- a lot-table material (whose stock_levels row mirrors its lots) is never counted twice, and legacy rows with no
-- master are left as they were. Everything else is the 20260926190000_thread_stock_per_pack definition unchanged
-- (checked against pg_get_viewdef on live before writing).

DROP VIEW IF EXISTS derived_stock_view;

CREATE VIEW derived_stock_view AS
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
             JOIN materials m ON m."threadId" = s."threadId" AND NOT m."threadPackagingType" IS DISTINCT FROM s."packagingType" AND NOT m."threadPly" IS DISTINCT FROM s.ply
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
        UNION ALL
         SELECT m.id,
            s."warehouseId",
            sum(s.quantity) AS sum,
            max(s."lastUpdated") AS max
           FROM stock_levels s
             JOIN materials m ON m.id = s."materialId"
          WHERE (m."hookEyeId" IS NOT NULL OR m."snapButtonId" IS NOT NULL OR m."buckleId" IS NOT NULL OR m."beltId" IS NOT NULL OR m."velcroId" IS NOT NULL OR m."drawstringId" IS NOT NULL OR m."ribbonId" IS NOT NULL OR m."sequinId" IS NOT NULL OR m."beadId" IS NOT NULL OR m."motifId" IS NOT NULL OR m."interliningId" IS NOT NULL OR m."paddingId" IS NOT NULL OR m."otherFastenerId" IS NOT NULL OR m."otherTapeId" IS NOT NULL OR m."otherDecorativeId" IS NOT NULL OR m."otherFunctionalId" IS NOT NULL)
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
