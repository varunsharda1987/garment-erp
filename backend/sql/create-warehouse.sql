-- Create a test warehouse for production
DO $$
DECLARE
    admin_id TEXT;
BEGIN
    -- Get admin user ID
    SELECT id INTO admin_id FROM users WHERE role = 'ADMIN' LIMIT 1;

    INSERT INTO warehouses (
        id,
        "warehouseCode",
        "warehouseName",
        "warehouseType",
        address,
        capacity,
        "isActive",
        "createdById",
        "createdAt",
        "updatedAt"
    )
    VALUES (
        gen_random_uuid(),
        'WH-MAIN',
        'Main Production Unit',
        'WORK_IN_PROGRESS',
        'Production Facility, Industrial Area',
        10000,
        true,
        admin_id,
        NOW(),
        NOW()
    )
    ON CONFLICT ("warehouseCode") DO NOTHING;
END $$;

-- Verify
SELECT id, "warehouseCode", "warehouseName", "warehouseType" FROM warehouses;
