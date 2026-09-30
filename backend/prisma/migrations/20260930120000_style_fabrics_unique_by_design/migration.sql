-- One part may carry two fabrics on one greige when they differ in finish, print design or colour
-- (LNG129, 2026-09-30: a Nightgown in Poplin printed "Butta" AND Poplin printed "Border"). The index this
-- replaces (20260806000000) keyed on greige + embroidery only, so the second print could never be stored and
-- the style save silently dropped it. A ready fabric (no greige name) is now keyed by its fabric master, so
-- two different ready fabrics in one part no longer collide either.
--
-- Strictly looser than the old index (every old key column is still in it), so no existing row can violate it.
-- NULLS NOT DISTINCT makes a blank finish equal a blank finish. Prisma cannot express this index —
-- do not drop it. The style save refuses a duplicate with a message before this index is reached
-- (style.service.ts assertNoDuplicateStyleFabrics).
DROP INDEX IF EXISTS "style_fabrics_unique_component_fabric";

CREATE UNIQUE INDEX "style_fabrics_unique_component_fabric" ON "style_fabrics" (
  "componentId",
  COALESCE(NULLIF("genericGreigeName", ''), 'fabric:' || "fabricId", ''),
  "fabricFinishType",
  COALESCE("print_design", ''),
  COALESCE("color_master_id", ''),
  "hasEmbroidery",
  COALESCE("embroideryId", '')
) NULLS NOT DISTINCT;
