-- Check for duplicate records that would violate the new unique constraint
-- New constraint: [costingStyleId, componentName, style_fabric_id, cutableWidth, purpose, approval_status]

SELECT
  costing_style_id,
  component_name,
  style_fabric_id,
  "cutableWidth",
  purpose,
  approval_status,
  COUNT(*) as duplicate_count
FROM fabric_width_cad
WHERE costing_style_id IS NOT NULL
  AND component_name IS NOT NULL
  AND purpose IS NOT NULL
GROUP BY
  costing_style_id,
  component_name,
  style_fabric_id,
  "cutableWidth",
  purpose,
  approval_status
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;
