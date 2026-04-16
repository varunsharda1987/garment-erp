-- AlterTable
ALTER TABLE "style_fabrics" ADD COLUMN     "color_master_id" TEXT,
ADD COLUMN     "print_design" TEXT;

-- CreateIndex
CREATE INDEX "style_fabrics_color_master_id_idx" ON "style_fabrics"("color_master_id");

-- AddForeignKey
ALTER TABLE "style_fabrics" ADD CONSTRAINT "style_fabrics_color_master_id_fkey" FOREIGN KEY ("color_master_id") REFERENCES "color_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;
