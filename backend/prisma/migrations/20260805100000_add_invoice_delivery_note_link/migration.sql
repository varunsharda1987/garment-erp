-- P7.4: Add delivery note link to invoices for dispatch→invoice traceability

-- Add deliveryNoteId column to invoices
ALTER TABLE "invoices" ADD COLUMN "deliveryNoteId" TEXT;

-- Add foreign key constraint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_deliveryNoteId_fkey"
    FOREIGN KEY ("deliveryNoteId") REFERENCES "delivery_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for lookup
CREATE INDEX "invoices_deliveryNoteId_idx" ON "invoices"("deliveryNoteId");
