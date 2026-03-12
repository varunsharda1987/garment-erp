-- CreateTable: invoice_items
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "invoiceId" TEXT NOT NULL,
    "styleId" TEXT,
    "description" TEXT NOT NULL,
    "hsnCode" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "gstRate" DECIMAL(5,2),
    "cgstRate" DECIMAL(5,2),
    "cgstAmount" DECIMAL(12,2),
    "sgstRate" DECIMAL(5,2),
    "sgstAmount" DECIMAL(12,2),
    "igstRate" DECIMAL(5,2),
    "igstAmount" DECIMAL(12,2),
    "taxAmount" DECIMAL(12,2),
    "remarks" TEXT,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");
CREATE INDEX "invoice_items_styleId_idx" ON "invoice_items"("styleId");

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Add GST fields to quotation_items
ALTER TABLE "quotation_items" ADD COLUMN "hsnCode" TEXT;
ALTER TABLE "quotation_items" ADD COLUMN "gstRate" DECIMAL(5,2);
ALTER TABLE "quotation_items" ADD COLUMN "cgstRate" DECIMAL(5,2);
ALTER TABLE "quotation_items" ADD COLUMN "cgstAmount" DECIMAL(12,2);
ALTER TABLE "quotation_items" ADD COLUMN "sgstRate" DECIMAL(5,2);
ALTER TABLE "quotation_items" ADD COLUMN "sgstAmount" DECIMAL(12,2);
ALTER TABLE "quotation_items" ADD COLUMN "igstRate" DECIMAL(5,2);
ALTER TABLE "quotation_items" ADD COLUMN "igstAmount" DECIMAL(12,2);
ALTER TABLE "quotation_items" ADD COLUMN "taxAmount" DECIMAL(12,2);
