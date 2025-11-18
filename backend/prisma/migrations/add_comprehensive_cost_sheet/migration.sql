-- Add new fields to StyleCosting table for comprehensive cost sheet

-- Basic Information
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "numberOfComponents" INTEGER;
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "subCategory" TEXT;

-- Fabric Details (JSON)
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "fabricDetails" JSONB;
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "fabricTotal" DECIMAL(10,2) DEFAULT 0;

-- Trims Details (JSON)
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "trimsDetails" JSONB;
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "trimsTotal" DECIMAL(10,2) DEFAULT 0;

-- CMT Individual Breakdown
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "buttonAttachmentCost" DECIMAL(10,2) DEFAULT 0;
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "handworkCmtCost" DECIMAL(10,2) DEFAULT 0;
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "cmtTotal" DECIMAL(10,2) DEFAULT 0;

-- Embroidery Details (JSON)
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "embroideryDetails" JSONB;
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "embroideryTotal" DECIMAL(10,2) DEFAULT 0;

-- Accessories Details (JSON)
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "accessoriesDetails" JSONB;
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "accessoriesTotal" DECIMAL(10,2) DEFAULT 0;

-- Value Loss
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "valueLossPercent" DECIMAL(5,2) DEFAULT 2;
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "valueLossAmount" DECIMAL(10,2) DEFAULT 0;

-- Markup
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "markupPercent" DECIMAL(5,2) DEFAULT 15;
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "markupAmount" DECIMAL(10,2) DEFAULT 0;

-- Calculated Totals
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL(15,2) DEFAULT 0;
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "totalProductCost" DECIMAL(15,2) DEFAULT 0;

-- Tracking fields
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "isApproved" BOOLEAN DEFAULT FALSE;
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP;

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'style_costing_createdById_fkey'
  ) THEN
    ALTER TABLE "style_costing" ADD CONSTRAINT "style_costing_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'style_costing_approvedById_fkey'
  ) THEN
    ALTER TABLE "style_costing" ADD CONSTRAINT "style_costing_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
