-- Seed Material Categories for Controllers
-- This script adds all required material categories that controllers expect
-- Run with: npx prisma db execute --file seed-material-categories.sql

-- Categories required by controllers:
-- 1. Buttons (button.controller.ts)
-- 2. Threads (thread.controller.ts)
-- 3. Lace (lace.controller.ts)
-- 4. Zipper (zipper.controller.ts)
-- 5. Elastic (elastic.controller.ts)
-- 6. Label (label.controller.ts)
-- 7. Packaging (packaging.controller.ts)

-- Insert categories if they don't exist (using ON CONFLICT for safety)
INSERT INTO material_categories (id, name, description, "createdAt", level, "sortOrder", "isActive")
VALUES
  (gen_random_uuid(), 'Buttons', 'Button materials and accessories', NOW(), 1, 1, true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO material_categories (id, name, description, "createdAt", level, "sortOrder", "isActive")
VALUES
  (gen_random_uuid(), 'Threads', 'Thread and sewing materials', NOW(), 1, 2, true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO material_categories (id, name, description, "createdAt", level, "sortOrder", "isActive")
VALUES
  (gen_random_uuid(), 'Lace', 'Lace and trim materials', NOW(), 1, 3, true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO material_categories (id, name, description, "createdAt", level, "sortOrder", "isActive")
VALUES
  (gen_random_uuid(), 'Zipper', 'Zipper materials', NOW(), 1, 4, true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO material_categories (id, name, description, "createdAt", level, "sortOrder", "isActive")
VALUES
  (gen_random_uuid(), 'Elastic', 'Elastic materials', NOW(), 1, 5, true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO material_categories (id, name, description, "createdAt", level, "sortOrder", "isActive")
VALUES
  (gen_random_uuid(), 'Label', 'Label materials', NOW(), 1, 6, true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO material_categories (id, name, description, "createdAt", level, "sortOrder", "isActive")
VALUES
  (gen_random_uuid(), 'Packaging', 'Packaging materials', NOW(), 1, 7, true)
ON CONFLICT (name) DO NOTHING;

-- Show all categories after seeding
SELECT id, name, description, "isActive" FROM material_categories ORDER BY "sortOrder", name;
