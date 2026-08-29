-- AlterTable
ALTER TABLE "styles" ADD COLUMN     "customerId" TEXT;

-- CreateIndex
CREATE INDEX "styles_customerId_idx" ON "styles"("customerId");

-- AddForeignKey
ALTER TABLE "styles" ADD CONSTRAINT "styles_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
