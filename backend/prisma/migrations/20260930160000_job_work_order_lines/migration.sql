-- Job work orders with several lines (2026-09-30). A job used to expect ONE output; MRP bundled a Red, a
-- Black and a Teal order onto DJ-EBEW-002-001 and named the Red fabric for all of it. A line is one output
-- the processor sends back (a finished fabric or dyed lace at one asked width); the header keeps the totals
-- and the value every line shares. helpers/jwo-lines.helper.ts is the one writer.

CREATE TYPE "JwoLineClose" AS ENUM ('FINAL', 'SHORT');

CREATE TABLE "job_work_order_lines" (
    "id" TEXT NOT NULL,
    "jobWorkOrderId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "styleId" TEXT,
    "colorMasterId" TEXT,
    "colorName" TEXT,
    "finishedFabricId" TEXT,
    "finishedLaceId" TEXT,
    "sentWidthInches" DECIMAL(10,2),
    "expectedShrinkage" DECIMAL(5,2),
    "qtySent" DECIMAL(10,2) NOT NULL,
    "qtyExpected" DECIMAL(10,2),
    "closedAt" TIMESTAMP(3),
    "closedHow" "JwoLineClose",
    "closingGrnItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_work_order_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "job_work_order_lines_one_output" CHECK ("finishedFabricId" IS NULL OR "finishedLaceId" IS NULL)
);

CREATE UNIQUE INDEX "job_work_order_lines_jobWorkOrderId_lineNo_key" ON "job_work_order_lines"("jobWorkOrderId", "lineNo");
CREATE UNIQUE INDEX "job_work_order_lines_closingGrnItemId_key" ON "job_work_order_lines"("closingGrnItemId");
CREATE INDEX "job_work_order_lines_styleId_idx" ON "job_work_order_lines"("styleId");
CREATE INDEX "job_work_order_lines_colorMasterId_idx" ON "job_work_order_lines"("colorMasterId");
CREATE INDEX "job_work_order_lines_finishedFabricId_idx" ON "job_work_order_lines"("finishedFabricId");
CREATE INDEX "job_work_order_lines_finishedLaceId_idx" ON "job_work_order_lines"("finishedLaceId");

ALTER TABLE "job_work_order_lines" ADD CONSTRAINT "job_work_order_lines_jobWorkOrderId_fkey"
    FOREIGN KEY ("jobWorkOrderId") REFERENCES "job_work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_work_order_lines" ADD CONSTRAINT "job_work_order_lines_styleId_fkey"
    FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "job_work_order_lines" ADD CONSTRAINT "job_work_order_lines_colorMasterId_fkey"
    FOREIGN KEY ("colorMasterId") REFERENCES "color_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "job_work_order_lines" ADD CONSTRAINT "job_work_order_lines_finishedFabricId_fkey"
    FOREIGN KEY ("finishedFabricId") REFERENCES "fabric_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "job_work_order_lines" ADD CONSTRAINT "job_work_order_lines_finishedLaceId_fkey"
    FOREIGN KEY ("finishedLaceId") REFERENCES "lace_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "job_work_order_lines" ADD CONSTRAINT "job_work_order_lines_closingGrnItemId_fkey"
    FOREIGN KEY ("closingGrnItemId") REFERENCES "grn_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "requirement_jwo_links" ADD COLUMN "lineId" TEXT;
ALTER TABLE "grn_items" ADD COLUMN "jobWorkOrderLineId" TEXT;

-- Every existing job has exactly one output: line 1 is its own header. A job that is fully received is
-- closed (SHORT when Close short wrote its remark, else FINAL by its latest receipt).
INSERT INTO "job_work_order_lines" (
    "id", "jobWorkOrderId", "lineNo", "styleId", "colorMasterId", "colorName", "finishedFabricId",
    "finishedLaceId", "sentWidthInches", "expectedShrinkage", "qtySent", "qtyExpected",
    "closedAt", "closedHow", "closingGrnItemId", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text, j."id", 1, j."styleId", j."colorMasterId", j."colorName", j."finishedFabricId",
    j."finishedLaceId", j."sentWidthInches", j."expectedShrinkage", j."qtySentMeters", j."qtyBillable",
    CASE WHEN j."jwoStatus" IN ('STOCK_UPDATED', 'CLOSED') OR j."receivedDate" IS NOT NULL
         THEN COALESCE(j."receivedDate", j."updatedAt") END,
    CASE WHEN NOT (j."jwoStatus" IN ('STOCK_UPDATED', 'CLOSED') OR j."receivedDate" IS NOT NULL) THEN NULL
         WHEN j."remarks" LIKE '%[CLOSED SHORT%' THEN 'SHORT'::"JwoLineClose"
         ELSE 'FINAL'::"JwoLineClose" END,
    CASE WHEN (j."jwoStatus" IN ('STOCK_UPDATED', 'CLOSED') OR j."receivedDate" IS NOT NULL)
              AND COALESCE(j."remarks", '') NOT LIKE '%[CLOSED SHORT%'
         THEN (SELECT gi."id" FROM "grn_items" gi WHERE gi."grnId" = j."grnId" ORDER BY gi."id" LIMIT 1) END,
    j."createdAt", CURRENT_TIMESTAMP
FROM "job_work_orders" j;

UPDATE "requirement_jwo_links" l
SET "lineId" = jl."id"
FROM "job_work_order_lines" jl
WHERE jl."jobWorkOrderId" = l."jobWorkOrderId" AND jl."lineNo" = 1;

-- Job-work return receipts: filed on the job (PO-less), or on the job's linked purchase order (legacy)
UPDATE "grn_items" gi
SET "jobWorkOrderLineId" = jl."id"
FROM "goods_receiving_notes" g
JOIN "job_work_order_lines" jl ON jl."jobWorkOrderId" = g."jobWorkOrderId" AND jl."lineNo" = 1
WHERE gi."grnId" = g."id";

UPDATE "grn_items" gi
SET "jobWorkOrderLineId" = jl."id"
FROM "goods_receiving_notes" g
JOIN "job_work_orders" j ON j."purchaseOrderId" = g."poId"
JOIN "job_work_order_lines" jl ON jl."jobWorkOrderId" = j."id" AND jl."lineNo" = 1
WHERE gi."grnId" = g."id" AND g."jobWorkOrderId" IS NULL AND gi."jobWorkOrderLineId" IS NULL;

-- "lineId" stays nullable until the code that writes it is live: the running API links requirements with no
-- line until then. A follow-up migration backfills anything linked in between and makes it NOT NULL.

CREATE INDEX "requirement_jwo_links_lineId_idx" ON "requirement_jwo_links"("lineId");
CREATE INDEX "grn_items_jobWorkOrderLineId_idx" ON "grn_items"("jobWorkOrderLineId");

ALTER TABLE "requirement_jwo_links" ADD CONSTRAINT "requirement_jwo_links_lineId_fkey"
    FOREIGN KEY ("lineId") REFERENCES "job_work_order_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "grn_items" ADD CONSTRAINT "grn_items_jobWorkOrderLineId_fkey"
    FOREIGN KEY ("jobWorkOrderLineId") REFERENCES "job_work_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
