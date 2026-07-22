-- Migration to sync lace_master processedForStyle fields
-- These changes were applied directly to the database and schema.prisma
-- This migration exists to sync the migration history

-- AlterTable (columns already exist in DB - using IF NOT EXISTS pattern)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lace_master' AND column_name = 'processedForStyleId') THEN
        ALTER TABLE "lace_master" ADD COLUMN "processedForStyleId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lace_master' AND column_name = 'processedForStyleCode') THEN
        ALTER TABLE "lace_master" ADD COLUMN "processedForStyleCode" TEXT;
    END IF;
END $$;

-- CreateIndex (if not exists)
CREATE INDEX IF NOT EXISTS "lace_master_processedForStyleId_idx" ON "lace_master"("processedForStyleId");

-- AddForeignKey (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'lace_master_processedForStyleId_fkey') THEN
        ALTER TABLE "lace_master" ADD CONSTRAINT "lace_master_processedForStyleId_fkey" FOREIGN KEY ("processedForStyleId") REFERENCES "styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
