-- BUG-S6: expectedOrderQuantity was validated by Zod and shown in the style form
-- but had no database column — the value was silently discarded on every save.
ALTER TABLE "styles" ADD COLUMN IF NOT EXISTS "expectedOrderQuantity" INTEGER;
