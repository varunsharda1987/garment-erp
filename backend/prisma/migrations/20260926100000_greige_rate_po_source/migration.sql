-- Greige rate provenance (2026-09-26): the live rate now reads placed greige POs, and a saved rate
-- records which document it came from and who set it. Additive only.
ALTER TYPE "GreigeRateSource" ADD VALUE IF NOT EXISTS 'PURCHASE_ORDER';

ALTER TABLE "fabric_width_cad"
  ADD COLUMN IF NOT EXISTS "greige_rate_source_ref" TEXT,
  ADD COLUMN IF NOT EXISTS "greige_rate_set_by_id" TEXT;
