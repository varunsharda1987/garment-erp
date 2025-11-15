-- Create a test location for production
DO $$
DECLARE
    admin_id TEXT;
BEGIN
    -- Get admin user ID
    SELECT id INTO admin_id FROM users WHERE role = 'ADMIN' LIMIT 1;

    INSERT INTO locations (
        id,
        "locationCode",
        "locationName",
        "locationType",
        address,
        "isActive",
        "createdById",
        "createdAt",
        "updatedAt"
    )
    VALUES (
        gen_random_uuid(),
        'LOC-MAIN',
        'Main Production Floor',
        'PRODUCTION',
        'Production Building 1',
        true,
        admin_id,
        NOW(),
        NOW()
    )
    ON CONFLICT ("locationCode") DO NOTHING;
END $$;

-- Verify
SELECT id, "locationCode", "locationName", "locationType" FROM locations;
