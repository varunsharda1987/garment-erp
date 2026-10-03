-- Job work lines, part 2 (2026-10-03): a colour can come back undyed (RETURNED) or be dropped unsent (DROPPED),
-- be sent on its own challan, and carry its own rate. jwo-lines.helper is the one writer.

-- allow-contract: adds two enum values (additive, nothing existing changes)
ALTER TYPE "JwoLineClose" ADD VALUE IF NOT EXISTS 'RETURNED';
ALTER TYPE "JwoLineClose" ADD VALUE IF NOT EXISTS 'DROPPED';

ALTER TABLE "job_work_order_lines"
    ADD COLUMN "qtyReturned" DECIMAL(10,2),
    ADD COLUMN "sentDate" TIMESTAMP(3),
    ADD COLUMN "outwardChallanId" TEXT,
    ADD COLUMN "statutoryDueDate" TIMESTAMP(3),
    ADD COLUMN "ratePerUnit" DECIMAL(12,2),
    ADD COLUMN "rateSource" TEXT,
    ADD COLUMN "rateCardId" TEXT,
    ADD COLUMN "slabId" TEXT,
    ADD COLUMN "rateBasisQuantity" DECIMAL(12,2),
    ADD COLUMN "costedRatePerUnit" DECIMAL(12,2),
    ADD COLUMN "rateVarianceReason" TEXT;

CREATE INDEX "job_work_order_lines_outwardChallanId_idx" ON "job_work_order_lines"("outwardChallanId");
ALTER TABLE "job_work_order_lines" ADD CONSTRAINT "job_work_order_lines_outwardChallanId_fkey"
    FOREIGN KEY ("outwardChallanId") REFERENCES "challans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- What each issue sent, by line. NULL = sent for the whole job at once (every issue before 2026-10-03).
ALTER TABLE "job_work_order_components" ADD COLUMN "lineId" TEXT;
CREATE INDEX "job_work_order_components_lineId_idx" ON "job_work_order_components"("lineId");
ALTER TABLE "job_work_order_components" ADD CONSTRAINT "job_work_order_components_lineId_fkey"
    FOREIGN KEY ("lineId") REFERENCES "job_work_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "challan_items" ADD COLUMN "jobWorkOrderLineId" TEXT;
CREATE INDEX "challan_items_jobWorkOrderLineId_idx" ON "challan_items"("jobWorkOrderLineId");
ALTER TABLE "challan_items" ADD CONSTRAINT "challan_items_jobWorkOrderLineId_fkey"
    FOREIGN KEY ("jobWorkOrderLineId") REFERENCES "job_work_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every line carries its job's rate and provenance, and — when the job went out — its send.
UPDATE "job_work_order_lines" l
SET "ratePerUnit" = j."agreedRatePerMeter",
    "rateSource" = j."rateSource",
    "rateCardId" = j."rateCardId",
    "slabId" = j."slabId",
    "rateBasisQuantity" = j."rateBasisQuantity",
    "costedRatePerUnit" = j."costedRatePerMeter",
    "rateVarianceReason" = j."rateVarianceReason",
    "sentDate" = j."sentDate",
    "outwardChallanId" = j."outwardChallanId",
    "statutoryDueDate" = j."statutoryDueDate"
FROM "job_work_orders" j
WHERE j."id" = l."jobWorkOrderId";

-- A one-line job's issue and challan items are that line's
UPDATE "job_work_order_components" c
SET "lineId" = l."id"
FROM "job_work_order_lines" l
WHERE l."jobWorkOrderId" = c."jobWorkOrderId"
  AND NOT EXISTS (SELECT 1 FROM "job_work_order_lines" o WHERE o."jobWorkOrderId" = c."jobWorkOrderId" AND o."lineNo" > 1);

UPDATE "challan_items" ci
SET "jobWorkOrderLineId" = l."id"
FROM "job_work_order_lines" l
WHERE l."jobWorkOrderId" = ci."jobWorkOrderId"
  AND NOT EXISTS (SELECT 1 FROM "job_work_order_lines" o WHERE o."jobWorkOrderId" = ci."jobWorkOrderId" AND o."lineNo" > 1);
