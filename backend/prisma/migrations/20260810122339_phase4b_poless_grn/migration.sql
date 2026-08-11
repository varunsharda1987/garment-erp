-- DropForeignKey
ALTER TABLE "goods_receiving_notes" DROP CONSTRAINT "goods_receiving_notes_poId_fkey";

-- AlterTable
ALTER TABLE "goods_receiving_notes" ALTER COLUMN "poId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "grn_items" ALTER COLUMN "poItemId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "goods_receiving_notes" ADD CONSTRAINT "goods_receiving_notes_poId_fkey" FOREIGN KEY ("poId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
