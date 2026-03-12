-- CreateEnum: DocumentStatus
DO $$ BEGIN
  CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'APPROVED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: CreditNoteReason
DO $$ BEGIN
  CREATE TYPE "CreditNoteReason" AS ENUM ('SALES_RETURN', 'RATE_DIFFERENCE', 'QUALITY_ISSUE', 'QUANTITY_DIFFERENCE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: DebitNoteReason
DO $$ BEGIN
  CREATE TYPE "DebitNoteReason" AS ENUM ('PURCHASE_RETURN', 'RATE_DIFFERENCE', 'QUALITY_ISSUE', 'QUANTITY_SHORT', 'DAMAGED_GOODS', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable: credit_notes
CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "creditNoteNumber" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "creditNoteDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" "CreditNoteReason" NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "cgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalTax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "isInterstate" BOOLEAN NOT NULL DEFAULT false,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: credit_notes
CREATE UNIQUE INDEX "credit_notes_creditNoteNumber_key" ON "credit_notes"("creditNoteNumber");
CREATE INDEX "credit_notes_invoiceId_idx" ON "credit_notes"("invoiceId");
CREATE INDEX "credit_notes_customerId_idx" ON "credit_notes"("customerId");
CREATE INDEX "credit_notes_creditNoteNumber_idx" ON "credit_notes"("creditNoteNumber");
CREATE INDEX "credit_notes_status_idx" ON "credit_notes"("status");

-- AddForeignKey: credit_notes
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: credit_note_items
CREATE TABLE "credit_note_items" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "creditNoteId" TEXT NOT NULL,
    "invoiceItemId" TEXT,
    "description" TEXT NOT NULL,
    "hsnCode" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "gstRate" DECIMAL(5,2),
    "cgstAmount" DECIMAL(12,2),
    "sgstAmount" DECIMAL(12,2),
    "igstAmount" DECIMAL(12,2),
    "taxAmount" DECIMAL(12,2),

    CONSTRAINT "credit_note_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: credit_note_items
CREATE INDEX "credit_note_items_creditNoteId_idx" ON "credit_note_items"("creditNoteId");

-- AddForeignKey: credit_note_items
ALTER TABLE "credit_note_items" ADD CONSTRAINT "credit_note_items_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: debit_notes
CREATE TABLE "debit_notes" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "debitNoteNumber" TEXT NOT NULL,
    "poId" TEXT,
    "supplierId" TEXT NOT NULL,
    "debitNoteDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" "DebitNoteReason" NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "cgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalTax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "isInterstate" BOOLEAN NOT NULL DEFAULT false,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: debit_notes
CREATE UNIQUE INDEX "debit_notes_debitNoteNumber_key" ON "debit_notes"("debitNoteNumber");
CREATE INDEX "debit_notes_poId_idx" ON "debit_notes"("poId");
CREATE INDEX "debit_notes_supplierId_idx" ON "debit_notes"("supplierId");
CREATE INDEX "debit_notes_debitNoteNumber_idx" ON "debit_notes"("debitNoteNumber");
CREATE INDEX "debit_notes_status_idx" ON "debit_notes"("status");

-- AddForeignKey: debit_notes
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_poId_fkey" FOREIGN KEY ("poId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: debit_note_items
CREATE TABLE "debit_note_items" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "debitNoteId" TEXT NOT NULL,
    "poItemId" TEXT,
    "description" TEXT NOT NULL,
    "hsnCode" TEXT,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "gstRate" DECIMAL(5,2),
    "cgstAmount" DECIMAL(12,2),
    "sgstAmount" DECIMAL(12,2),
    "igstAmount" DECIMAL(12,2),
    "taxAmount" DECIMAL(12,2),

    CONSTRAINT "debit_note_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: debit_note_items
CREATE INDEX "debit_note_items_debitNoteId_idx" ON "debit_note_items"("debitNoteId");

-- AddForeignKey: debit_note_items
ALTER TABLE "debit_note_items" ADD CONSTRAINT "debit_note_items_debitNoteId_fkey" FOREIGN KEY ("debitNoteId") REFERENCES "debit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
