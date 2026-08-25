-- DropForeignKey
ALTER TABLE "sale_order_items" DROP CONSTRAINT "sale_order_items_sizeId_fkey";

-- AlterTable
ALTER TABLE "sale_order_items" ALTER COLUMN "sizeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "sale_order_items" ADD CONSTRAINT "sale_order_items_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
