-- Rows the API wrote between 20260930160000_job_work_order_lines and the code that writes lines (live 16:36 IST,
-- 30-Sep): DJ-KMC-003 and DJ-KMC-002 were received in between (GRN2609-1367 / -1368). Same rules as the first
-- backfill — line 1 is the job's header, links and job-work return rows take their job's line — and then a
-- requirement link's line is required.

INSERT INTO "job_work_order_lines" (
    "id", "jobWorkOrderId", "lineNo", "styleId", "colorMasterId", "colorName", "finishedFabricId",
    "finishedLaceId", "sentWidthInches", "expectedShrinkage", "qtySent", "qtyExpected", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text, j."id", 1, j."styleId", j."colorMasterId", j."colorName", j."finishedFabricId",
    j."finishedLaceId", j."sentWidthInches", j."expectedShrinkage", j."qtySentMeters", j."qtyBillable",
    j."createdAt", CURRENT_TIMESTAMP
FROM "job_work_orders" j
WHERE NOT EXISTS (SELECT 1 FROM "job_work_order_lines" l WHERE l."jobWorkOrderId" = j."id");

UPDATE "requirement_jwo_links" l
SET "lineId" = jl."id"
FROM "job_work_order_lines" jl
WHERE l."lineId" IS NULL AND jl."jobWorkOrderId" = l."jobWorkOrderId" AND jl."lineNo" = 1;

UPDATE "grn_items" gi
SET "jobWorkOrderLineId" = jl."id"
FROM "goods_receiving_notes" g
JOIN "job_work_order_lines" jl ON jl."jobWorkOrderId" = g."jobWorkOrderId" AND jl."lineNo" = 1
WHERE gi."grnId" = g."id" AND gi."jobWorkOrderLineId" IS NULL;

UPDATE "grn_items" gi
SET "jobWorkOrderLineId" = jl."id"
FROM "goods_receiving_notes" g
JOIN "job_work_orders" j ON j."purchaseOrderId" = g."poId"
JOIN "job_work_order_lines" jl ON jl."jobWorkOrderId" = j."id" AND jl."lineNo" = 1
WHERE gi."grnId" = g."id" AND g."jobWorkOrderId" IS NULL AND gi."jobWorkOrderLineId" IS NULL;

-- A one-line job fully received since the first backfill: its line is closed like the first backfill closed them
UPDATE "job_work_order_lines" jl
SET "closedAt" = COALESCE(j."receivedDate", j."updatedAt"),
    "closedHow" = CASE WHEN j."remarks" LIKE '%[CLOSED SHORT%' THEN 'SHORT'::"JwoLineClose" ELSE 'FINAL'::"JwoLineClose" END,
    "closingGrnItemId" = CASE WHEN COALESCE(j."remarks", '') NOT LIKE '%[CLOSED SHORT%'
        THEN (SELECT gi."id" FROM "grn_items" gi WHERE gi."grnId" = j."grnId" ORDER BY gi."id" LIMIT 1) END
FROM "job_work_orders" j
WHERE jl."jobWorkOrderId" = j."id"
  AND jl."closedAt" IS NULL
  AND jl."lineNo" = 1
  AND NOT EXISTS (SELECT 1 FROM "job_work_order_lines" o WHERE o."jobWorkOrderId" = j."id" AND o."lineNo" > 1)
  AND (j."jwoStatus" IN ('STOCK_UPDATED', 'CLOSED') OR j."receivedDate" IS NOT NULL);

ALTER TABLE "requirement_jwo_links" ALTER COLUMN "lineId" SET NOT NULL;
