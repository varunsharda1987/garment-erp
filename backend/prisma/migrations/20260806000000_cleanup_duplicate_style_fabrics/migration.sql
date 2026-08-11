-- Migration: Cleanup duplicate style_fabrics entries
-- Created: 2026-08-06
-- Issue: Multiple identical fabric entries were created in same component
-- due to no duplicate prevention in frontend/backend/database

-- Step 1: Delete duplicate style_fabrics, keeping the first (oldest) occurrence
-- Uses composite key: componentId + genericGreigeName + hasEmbroidery + embroideryId
-- (fabricFinishType is excluded from index due to enum type constraints)
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY "componentId",
      COALESCE("genericGreigeName", ''),
      "hasEmbroidery",
      COALESCE("embroideryId", '')
    ORDER BY "createdAt" ASC
  ) as rn
  FROM style_fabrics
)
DELETE FROM style_fabrics
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Step 2: Create partial unique index to prevent future duplicates
-- Using only scalar columns that work with COALESCE (no enum cast)
CREATE UNIQUE INDEX IF NOT EXISTS "style_fabrics_unique_component_fabric"
ON style_fabrics (
  "componentId",
  COALESCE("genericGreigeName", ''),
  "hasEmbroidery",
  COALESCE("embroideryId", '')
);
