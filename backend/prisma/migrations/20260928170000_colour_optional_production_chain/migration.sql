-- Colour is optional (owner, 2026-09-28). The colour is recorded when the style has one and left
-- blank when it does not (backend/src/services/helpers/sku-colour.helper.ts). Until now stitching,
-- finishing, packing, finished-goods stock, delivery-note and ASN rows demanded a colour, so a style
-- with no colour could be cut but never stitched. All eight tables were empty when this ran.

-- AlterTable
ALTER TABLE "stage_receipt_skus" ALTER COLUMN "colorId" DROP NOT NULL;
ALTER TABLE "stitching_output_skus" ALTER COLUMN "colorId" DROP NOT NULL;
ALTER TABLE "finishing_output_skus" ALTER COLUMN "colorId" DROP NOT NULL;
ALTER TABLE "polybag_skus" ALTER COLUMN "colorId" DROP NOT NULL;
ALTER TABLE "carton_skus" ALTER COLUMN "colorId" DROP NOT NULL;
ALTER TABLE "finished_goods_stock" ALTER COLUMN "colorId" DROP NOT NULL;
ALTER TABLE "delivery_note_items" ALTER COLUMN "colorId" DROP NOT NULL;
ALTER TABLE "asn_skus" ALTER COLUMN "colorId" DROP NOT NULL;

-- A blank colour is ONE value for uniqueness: Postgres treats NULLs as distinct in a unique index, so
-- without NULLS NOT DISTINCT two blank-colour rows for the same size would both be accepted (and
-- finished-goods stock would split instead of adding up — addFinishedGoods relies on ON CONFLICT
-- against this index). Same names as before; Prisma cannot express NULLS NOT DISTINCT, so the schema
-- keeps a plain @@unique and a note. Never drop/recreate these through Prisma. transfer_slip_skus and
-- cutting_batch_skus were already nullable and carried the same hole.
DROP INDEX "stage_receipt_skus_stageReceiptId_colorId_sizeId_key";
CREATE UNIQUE INDEX "stage_receipt_skus_stageReceiptId_colorId_sizeId_key" ON "stage_receipt_skus"("stageReceiptId", "colorId", "sizeId") NULLS NOT DISTINCT;

DROP INDEX "stitching_output_skus_dailyOutputId_colorId_sizeId_key";
CREATE UNIQUE INDEX "stitching_output_skus_dailyOutputId_colorId_sizeId_key" ON "stitching_output_skus"("dailyOutputId", "colorId", "sizeId") NULLS NOT DISTINCT;

DROP INDEX "finishing_output_skus_dailyOutputId_colorId_sizeId_key";
CREATE UNIQUE INDEX "finishing_output_skus_dailyOutputId_colorId_sizeId_key" ON "finishing_output_skus"("dailyOutputId", "colorId", "sizeId") NULLS NOT DISTINCT;

DROP INDEX "polybag_skus_polybagEntryId_colorId_sizeId_key";
CREATE UNIQUE INDEX "polybag_skus_polybagEntryId_colorId_sizeId_key" ON "polybag_skus"("polybagEntryId", "colorId", "sizeId") NULLS NOT DISTINCT;

DROP INDEX "carton_skus_cartonId_colorId_sizeId_key";
CREATE UNIQUE INDEX "carton_skus_cartonId_colorId_sizeId_key" ON "carton_skus"("cartonId", "colorId", "sizeId") NULLS NOT DISTINCT;

DROP INDEX "finished_goods_stock_styleId_colorId_sizeId_locationId_key";
CREATE UNIQUE INDEX "finished_goods_stock_styleId_colorId_sizeId_locationId_key" ON "finished_goods_stock"("styleId", "colorId", "sizeId", "locationId") NULLS NOT DISTINCT;

DROP INDEX "asn_skus_asnId_colorId_sizeId_key";
CREATE UNIQUE INDEX "asn_skus_asnId_colorId_sizeId_key" ON "asn_skus"("asnId", "colorId", "sizeId") NULLS NOT DISTINCT;

DROP INDEX "transfer_slip_skus_transferSlipId_colorId_sizeId_key";
CREATE UNIQUE INDEX "transfer_slip_skus_transferSlipId_colorId_sizeId_key" ON "transfer_slip_skus"("transferSlipId", "colorId", "sizeId") NULLS NOT DISTINCT;

DROP INDEX "cutting_batch_skus_cuttingBatchId_colorId_sizeId_key";
CREATE UNIQUE INDEX "cutting_batch_skus_cuttingBatchId_colorId_sizeId_key" ON "cutting_batch_skus"("cuttingBatchId", "colorId", "sizeId") NULLS NOT DISTINCT;
