-- Thread stock per PACK (2026-09-26, garment-erp-a5). Owner: one thread (brand + colour) bought as cones and as
-- tubes is stocked as SEPARATE items — Cone 2-ply / Cone 3-ply / Tube 3-ply — never cones + tubes added together.
--
-- 1. materials.threadPackagingType + threadPly: a thread keeps its base row and gains one row per pack. threadId
--    stops being unique (like labelId for sizes); partial unique indexes keep ONE base row per thread and ONE row
--    per (thread, packing, ply).
-- 2. thread_stock.grnItemId (unique): one lot per GRN line, found by it on reversal. The old unique key
--    (threadId, procurementId, packagingType, ply) made a second receipt on the same PO line fail.
-- 3. derived_stock_view recreated from the LIVE definition (after 20260926174500); only the thread JOIN changes —
--    a lot lands on the pack row whose packing + ply match (an unpacked lot stays on the base row).
-- thread_stock is empty live, so nothing moves.

DROP VIEW IF EXISTS derived_stock_view;

-- DropIndex
DROP INDEX "materials_threadId_key";

-- DropIndex
DROP INDEX "thread_stock_threadId_procurementId_packagingType_ply_key";

-- AlterTable
ALTER TABLE "materials" ADD COLUMN     "threadPackagingType" "ThreadPackagingType",
ADD COLUMN     "threadPly" "ThreadPly";

-- AlterTable
ALTER TABLE "thread_stock" ADD COLUMN     "grnItemId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "thread_stock_grnItemId_key" ON "thread_stock"("grnItemId");

-- AddForeignKey
ALTER TABLE "thread_stock" ADD CONSTRAINT "thread_stock_grnItemId_fkey" FOREIGN KEY ("grnItemId") REFERENCES "grn_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "materials_thread_base_key" ON "materials"("threadId") WHERE "threadId" IS NOT NULL AND "threadPackagingType" IS NULL;
CREATE UNIQUE INDEX "materials_thread_pack_key" ON "materials"("threadId", "threadPackagingType", "threadPly") WHERE "threadPackagingType" IS NOT NULL AND "threadPly" IS NOT NULL;
CREATE UNIQUE INDEX "materials_thread_pack_noply_key" ON "materials"("threadId", "threadPackagingType") WHERE "threadPackagingType" IS NOT NULL AND "threadPly" IS NULL;

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
