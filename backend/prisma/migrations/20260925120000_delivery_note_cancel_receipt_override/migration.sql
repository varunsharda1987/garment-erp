-- A pending delivery note can be CANCELLED (record and number kept; stock and sale-order quantities handed back)
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "delivery_notes" ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancelledById" TEXT,
ADD COLUMN "cancelReason" TEXT,
ADD COLUMN "stockOverrideReason" TEXT;

-- What the buyer actually received per line (set by the proof of delivery; the invoice bills it)
ALTER TABLE "delivery_note_items" ADD COLUMN "receivedQty" INTEGER;
