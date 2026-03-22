-- Add numberOfLayers to cutting_lays (how many fabric plies stacked per lay)
ALTER TABLE "cutting_lays" ADD COLUMN "numberOfLayers" INTEGER NOT NULL DEFAULT 1;

-- Add fabricConsumed to cutting_batch_fabrics (per-fabric consumption tracking)
ALTER TABLE "cutting_batch_fabrics" ADD COLUMN "fabricConsumed" DECIMAL(10,2) NOT NULL DEFAULT 0;
