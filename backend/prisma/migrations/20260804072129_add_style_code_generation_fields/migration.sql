-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "style_code_prefix" TEXT;

-- AlterTable
ALTER TABLE "product_category_master" ADD COLUMN     "code_prefix" TEXT;

-- AlterTable
ALTER TABLE "styles" ADD COLUMN     "buyer_style_ref" TEXT;
