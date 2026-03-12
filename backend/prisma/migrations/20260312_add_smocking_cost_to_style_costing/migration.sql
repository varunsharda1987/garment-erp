-- AlterTable
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "smockingCost" DECIMAL(10,2) NOT NULL DEFAULT 0;
