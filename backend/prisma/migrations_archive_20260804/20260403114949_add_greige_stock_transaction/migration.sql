-- CreateTable
CREATE TABLE "greige_stock_transaction" (
    "id" VARCHAR(50) NOT NULL,
    "stockId" VARCHAR(50) NOT NULL,
    "transactionType" VARCHAR(30) NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "balanceAfter" DECIMAL(12,4) NOT NULL,
    "costPerUnit" DECIMAL(12,4),
    "totalValue" DECIMAL(12,4),
    "referenceType" VARCHAR(30),
    "referenceId" VARCHAR(50),
    "notes" TEXT,
    "performedById" VARCHAR(50) NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "greige_stock_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "greige_stock_transaction_stockId_idx" ON "greige_stock_transaction"("stockId");

-- CreateIndex
CREATE INDEX "greige_stock_transaction_transactionType_idx" ON "greige_stock_transaction"("transactionType");

-- CreateIndex
CREATE INDEX "greige_stock_transaction_transactionDate_idx" ON "greige_stock_transaction"("transactionDate");

-- AddForeignKey
ALTER TABLE "greige_stock_transaction" ADD CONSTRAINT "greige_stock_transaction_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "greige_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "greige_stock_transaction" ADD CONSTRAINT "greige_stock_transaction_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
