-- Add colors and sizes to TEST-001 style
-- First, get the style ID
DO $$
DECLARE
    style_id UUID;
    admin_id UUID;
    color_red_id UUID := gen_random_uuid();
    color_blue_id UUID := gen_random_uuid();
    size_s_id UUID := gen_random_uuid();
    size_m_id UUID := gen_random_uuid();
    size_l_id UUID := gen_random_uuid();
BEGIN
    -- Get TEST-001 style ID
    SELECT id INTO style_id FROM styles WHERE "styleCode" = 'TEST-001' LIMIT 1;

    -- Get admin user ID
    SELECT id INTO admin_id FROM users WHERE role = 'ADMIN' LIMIT 1;

    IF style_id IS NOT NULL THEN
        -- Insert colors
        INSERT INTO color_options (id, "styleId", "colorName", "colorCode", "sortOrder", "isActive")
        VALUES
            (color_red_id, style_id, 'Red', '#FF0000', 1, true),
            (color_blue_id, style_id, 'Blue', '#0000FF', 2, true)
        ON CONFLICT DO NOTHING;

        -- Insert sizes
        INSERT INTO size_options (id, "styleId", "sizeName", "sizeCode", "sortOrder", "isActive")
        VALUES
            (size_s_id, style_id, 'Small', 'S', 1, true),
            (size_m_id, style_id, 'Medium', 'M', 2, true),
            (size_l_id, style_id, 'Large', 'L', 3, true)
        ON CONFLICT DO NOTHING;

        RAISE NOTICE 'Added 2 colors and 3 sizes to TEST-001';
    ELSE
        RAISE NOTICE 'TEST-001 style not found';
    END IF;
END $$;

-- Verify
SELECT
    s."styleCode",
    (SELECT COUNT(*) FROM color_options WHERE "styleId" = s.id) as colors,
    (SELECT COUNT(*) FROM size_options WHERE "styleId" = s.id) as sizes
FROM styles s
WHERE "styleCode" = 'TEST-001';
