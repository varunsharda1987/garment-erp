-- Add unique constraints to document number fields (prevents duplicate numbers from race conditions)
CREATE UNIQUE INDEX IF NOT EXISTS "goods_receiving_notes_grnNumber_key" ON "goods_receiving_notes"("grnNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "orders_orderNumber_key" ON "orders"("orderNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_poNumber_key" ON "purchase_orders"("poNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "quotations_quotationNumber_key" ON "quotations"("quotationNumber");

-- Create code_sequences table for atomic code generation
CREATE TABLE IF NOT EXISTS "code_sequences" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "code_sequences_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on prefix (each prefix has exactly one sequence row)
CREATE UNIQUE INDEX IF NOT EXISTS "code_sequences_prefix_key" ON "code_sequences"("prefix");
