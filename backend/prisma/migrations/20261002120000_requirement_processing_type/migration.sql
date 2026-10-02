-- A PROCESSING requirement records its process (owner, 02-Oct-2026). Until now only printingType was
-- stored, so a blank print type was read as DYEING — wrong for a printed line with no rate card, and
-- the only trace of a Convert-to-greige requirement's process was that guess.

ALTER TABLE "material_requirements" ADD COLUMN "processingType" TEXT;

ALTER TABLE "material_requirements"
  ADD CONSTRAINT "material_requirements_processing_type"
  CHECK ("processingType" IS NULL OR ("requirementType" = 'PROCESSING' AND "processingType" IN ('DYEING', 'PRINTING')));

-- Backfill, best evidence first; whatever none of these settles stays NULL (= not known).
-- 1. The Order BOM line's rate card
UPDATE "material_requirements" mr
   SET "processingType" = rc."processingType"
  FROM "order_bom_items" obi
  JOIN "processor_rate_card" rc ON rc."id" = obi."rateCardId"
 WHERE mr."orderBomItemId" = obi."id"
   AND mr."requirementType" = 'PROCESSING'
   AND rc."processingType" IN ('DYEING', 'PRINTING');

-- 2. A lace line: lace is dyed to its shade (lace lines never carry a card)
UPDATE "material_requirements" mr
   SET "processingType" = 'DYEING'
  FROM "order_bom_items" obi
 WHERE mr."orderBomItemId" = obi."id"
   AND mr."requirementType" = 'PROCESSING'
   AND mr."processingType" IS NULL
   AND obi."greigeLaceId" IS NOT NULL;

-- 3. A print type: only printing has one
UPDATE "material_requirements"
   SET "processingType" = 'PRINTING'
 WHERE "requirementType" = 'PROCESSING'
   AND "processingType" IS NULL
   AND "printingType" IS NOT NULL;

-- 4. The job work order it went out on — what was actually done — when its jobs agree
UPDATE "material_requirements" mr
   SET "processingType" = j.process
  FROM (
    SELECT l."requirementId", MIN(jwo."processType") AS process
      FROM "requirement_jwo_links" l
      JOIN "job_work_orders" jwo ON jwo."id" = l."jobWorkOrderId"
     WHERE jwo."processType" IN ('DYEING', 'PRINTING')
     GROUP BY l."requirementId"
    HAVING COUNT(DISTINCT jwo."processType") = 1
  ) j
 WHERE mr."id" = j."requirementId"
   AND mr."requirementType" = 'PROCESSING'
   AND mr."processingType" IS NULL;
