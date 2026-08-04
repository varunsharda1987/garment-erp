-- Non-negativity CHECK constraints on the stock tables (bug-hunt BH-0301 / REPAIR_PLAN Step 1.4).
-- The 2026-07 audit found ZERO user-defined CHECK constraints across 576 money/quantity columns —
-- which is how stock_levels once reached -7,589.6 m. Application code is the first line of defence;
-- these hold no matter which code path writes.
--
-- Verified before authoring (2026-08-02): all three tables have zero negative rows, so these apply
-- cleanly. If this migration ever fails on apply, a negative quantity has crept back in — that is a
-- live corruption signal, not a reason to drop the constraint. Investigate with:
--   cd backend && npx ts-node scripts/verify-stock-identity.ts

-- Guarded (constraint-exists check) so a re-run or partially-applied deploy is safe: Postgres has
-- no ADD CONSTRAINT IF NOT EXISTS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_levels_qty_nonneg') THEN
    ALTER TABLE "stock_levels"
      ADD CONSTRAINT "stock_levels_qty_nonneg" CHECK ("quantity" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'greige_stock_qty_nonneg') THEN
    ALTER TABLE "greige_stock"
      ADD CONSTRAINT "greige_stock_qty_nonneg"
      CHECK ("quantityAvailable" >= 0 AND "quantityConsumed" >= 0 AND "quantityReserved" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fabric_stock_qty_nonneg') THEN
    ALTER TABLE "fabric_stock"
      ADD CONSTRAINT "fabric_stock_qty_nonneg"
      CHECK ("quantityAvailable" >= 0 AND "quantityConsumed" >= 0 AND "quantityReserved" >= 0);
  END IF;
END $$;
