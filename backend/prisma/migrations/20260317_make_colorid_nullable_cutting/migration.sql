-- Make colorId nullable in cutting/transfer SKU tables
-- Supports size-only orders without color variants

-- cutting_batch_skus: make colorId nullable
ALTER TABLE "cutting_batch_skus" ALTER COLUMN "colorId" DROP NOT NULL;

-- cutting_batch_defects: make colorId nullable
ALTER TABLE "cutting_batch_defects" ALTER COLUMN "colorId" DROP NOT NULL;

-- cutting_lay_skus: make colorId nullable
ALTER TABLE "cutting_lay_skus" ALTER COLUMN "colorId" DROP NOT NULL;

-- transfer_slip_skus: make colorId nullable
ALTER TABLE "transfer_slip_skus" ALTER COLUMN "colorId" DROP NOT NULL;
