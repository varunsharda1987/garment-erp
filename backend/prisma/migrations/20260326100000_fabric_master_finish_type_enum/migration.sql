-- Step 1: Convert existing lowercase string values to uppercase enum values
UPDATE "fabric_master" SET "finishType" = CASE "finishType"
    WHEN 'solid' THEN 'DYED'
    WHEN 'reactive' THEN 'DYED'
    WHEN 'pigment' THEN 'DYED'
    WHEN 'printed' THEN 'PRINTED'
    WHEN 'yarn_dyed' THEN 'YARN_DYED'
    WHEN 'other' THEN 'RAW'
    WHEN 'DYED' THEN 'DYED'
    WHEN 'PRINTED' THEN 'PRINTED'
    WHEN 'YARN_DYED' THEN 'YARN_DYED'
    WHEN 'RAW' THEN 'RAW'
    ELSE NULL
END
WHERE "finishType" IS NOT NULL;

-- Step 2: Change column type from text to FabricFinishType enum
ALTER TABLE "fabric_master" ALTER COLUMN "finishType" TYPE "FabricFinishType" USING "finishType"::"FabricFinishType";
