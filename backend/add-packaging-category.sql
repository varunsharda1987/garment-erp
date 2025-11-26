-- Add Packaging category if it doesn't exist
INSERT INTO material_categories (id, name, description, "createdAt", level, "sortOrder", "isActive")
SELECT 
  gen_random_uuid(),
  'Packaging',
  'Packaging materials',
  NOW(),
  1,
  0,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM material_categories WHERE name = 'Packaging'
);

-- Show all categories
SELECT id, name, description FROM material_categories ORDER BY name;
