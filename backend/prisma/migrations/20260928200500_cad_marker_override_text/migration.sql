-- fabric_width_cad.marker_override_differences: JSONB -> TEXT (JSON text). Rows are copied with `...row` in
-- Fabric Costing's promote, and a Json? column's null does not type-check in a Prisma create. Empty on every
-- row when changed (the column was added minutes earlier by 20260928200000_cad_marker_images).
ALTER TABLE "fabric_width_cad" ALTER COLUMN "marker_override_differences" TYPE TEXT USING "marker_override_differences"::text;
