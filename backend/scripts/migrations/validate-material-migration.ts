/**
 * Validation Script: Verify Material Master Consolidation
 *
 * This script validates that the material master consolidation was successful by:
 * 1. Checking record counts match between old and new tables
 * 2. Verifying all specifications are preserved
 * 3. Checking supplier mappings are correct
 * 4. Ensuring no data loss occurred
 * 5. Validating JSON specifications are properly structured
 */

import { PrismaClient, MaterialType } from '@prisma/client';

const prisma = new PrismaClient();

interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    totalLegacyRecords: number;
    totalMigratedRecords: number;
    totalSupplierMappings: number;
    byType: Record<string, { legacy: number; migrated: number }>;
  };
}

const MATERIAL_TYPE_MAPPINGS: Record<string, MaterialType> = {
  lace_master: MaterialType.LACE,
  button_master: MaterialType.BUTTON,
  thread_master: MaterialType.THREAD,
  zipper_master: MaterialType.ZIPPER,
  elastic_master: MaterialType.ELASTIC,
  label_master: MaterialType.LABEL,
  packaging_master: MaterialType.PACKAGING,
  machine_part_master: MaterialType.MACHINE_PART,
};

async function validateMigration(): Promise<ValidationResult> {
  console.log('🔍 Starting Material Master Migration Validation...\n');

  const result: ValidationResult = {
    passed: true,
    errors: [],
    warnings: [],
    summary: {
      totalLegacyRecords: 0,
      totalMigratedRecords: 0,
      totalSupplierMappings: 0,
      byType: {},
    },
  };

  // Step 1: Count migrated records
  console.log('📊 Counting migrated records...');
  const migratedCount = await prisma.material_master.count();
  result.summary.totalMigratedRecords = migratedCount;
  console.log(`  ✓ Found ${migratedCount} migrated records\n`);

  // Step 2: Validate each material type
  for (const [tableName, materialType] of Object.entries(MATERIAL_TYPE_MAPPINGS)) {
    console.log(`\n🔎 Validating ${tableName} → MaterialType.${materialType}...`);

    try {
      // Count legacy records
      const legacyCount = await countLegacyRecords(tableName);
      result.summary.totalLegacyRecords += legacyCount;

      // Count migrated records for this type
      const migratedForType = await prisma.material_master.count({
        where: { materialType },
      });

      result.summary.byType[materialType] = {
        legacy: legacyCount,
        migrated: migratedForType,
      };

      console.log(`  📈 Legacy records: ${legacyCount}`);
      console.log(`  📈 Migrated records: ${migratedForType}`);

      // Check if counts match
      if (legacyCount !== migratedForType) {
        const error = `Count mismatch for ${materialType}: ${legacyCount} legacy vs ${migratedForType} migrated`;
        result.errors.push(error);
        result.passed = false;
        console.log(`  ❌ ${error}`);
      } else {
        console.log(`  ✓ Counts match`);
      }

      // Validate specifications
      await validateSpecifications(materialType, result);

      // Validate sample record
      await validateSampleRecord(tableName, materialType, result);
    } catch (error: any) {
      if (error.message.includes('does not exist')) {
        const warning = `Table ${tableName} does not exist - skipping validation`;
        result.warnings.push(warning);
        console.log(`  ⚠️  ${warning}`);
      } else {
        const errorMsg = `Failed to validate ${tableName}: ${error.message}`;
        result.errors.push(errorMsg);
        result.passed = false;
        console.log(`  ❌ ${errorMsg}`);
      }
    }
  }

  // Step 3: Validate supplier mappings
  console.log('\n\n🔗 Validating supplier mappings...');
  const supplierMappingCount = await prisma.material_supplier_mapping.count();
  result.summary.totalSupplierMappings = supplierMappingCount;
  console.log(`  ✓ Found ${supplierMappingCount} supplier mappings`);

  // Check for orphaned supplier mappings
  const orphanedMappings = await prisma.material_supplier_mapping.findMany({
    where: {
      material: { is: null },
    },
  });

  if (orphanedMappings.length > 0) {
    const error = `Found ${orphanedMappings.length} orphaned supplier mappings`;
    result.errors.push(error);
    result.passed = false;
    console.log(`  ❌ ${error}`);
  } else {
    console.log(`  ✓ No orphaned supplier mappings`);
  }

  // Step 4: Validate JSON specifications structure
  console.log('\n\n📋 Validating JSON specifications...');
  await validateAllSpecifications(result);

  // Step 5: Print summary
  printValidationSummary(result);

  return result;
}

async function countLegacyRecords(tableName: string): Promise<number> {
  try {
    const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM ${tableName} WHERE is_active = true`
    );
    return Number(result[0].count);
  } catch (error: any) {
    if (error.message.includes('does not exist')) {
      return 0;
    }
    throw error;
  }
}

async function validateSpecifications(materialType: MaterialType, result: ValidationResult) {
  // Check for records without specifications
  const missingSpecs = await prisma.material_master.count({
    where: {
      materialType,
      specifications: null,
    },
  });

  if (missingSpecs > 0) {
    const warning = `${missingSpecs} ${materialType} records have null specifications`;
    result.warnings.push(warning);
    console.log(`  ⚠️  ${warning}`);
  }

  // Check for empty specifications objects
  const emptySpecs = await prisma.material_master.findMany({
    where: {
      materialType,
      specifications: { not: null },
    },
    select: {
      id: true,
      code: true,
      specifications: true,
    },
  });

  let emptyCount = 0;
  for (const record of emptySpecs) {
    const specs = record.specifications as any;
    if (specs && Object.keys(specs).length === 0) {
      emptyCount++;
    }
  }

  if (emptyCount > 0) {
    const warning = `${emptyCount} ${materialType} records have empty specifications {}`;
    result.warnings.push(warning);
    console.log(`  ⚠️  ${warning}`);
  }
}

async function validateSampleRecord(
  tableName: string,
  materialType: MaterialType,
  result: ValidationResult
) {
  // Get a sample migrated record
  const migratedSample = await prisma.material_master.findFirst({
    where: { materialType },
    include: { suppliers: true },
  });

  if (!migratedSample) {
    console.log(`  ℹ️  No migrated records found for ${materialType}`);
    return;
  }

  console.log(`  📄 Sample migrated record: ${migratedSample.code}`);
  console.log(`     Name: ${migratedSample.name}`);
  console.log(`     Specifications:`, JSON.stringify(migratedSample.specifications, null, 2));
  console.log(`     Suppliers: ${migratedSample.suppliers.length}`);

  // Verify legacy ID is set
  const legacyIdField = `legacy${capitalize(getPrefix(tableName))}Id`;
  if (!(migratedSample as any)[legacyIdField]) {
    const warning = `Sample record ${migratedSample.code} missing ${legacyIdField}`;
    result.warnings.push(warning);
    console.log(`  ⚠️  ${warning}`);
  } else {
    console.log(`  ✓ Legacy ID preserved: ${(migratedSample as any)[legacyIdField]}`);
  }
}

async function validateAllSpecifications(result: ValidationResult) {
  // Get all records with specifications
  const recordsWithSpecs = await prisma.material_master.findMany({
    where: {
      specifications: { not: null },
    },
    select: {
      id: true,
      code: true,
      materialType: true,
      specifications: true,
    },
  });

  console.log(`  Found ${recordsWithSpecs.length} records with specifications`);

  // Validate JSON structure
  let invalidJsonCount = 0;
  for (const record of recordsWithSpecs) {
    try {
      const specs = record.specifications as any;
      if (typeof specs !== 'object' || Array.isArray(specs)) {
        invalidJsonCount++;
        const error = `Record ${record.code} has invalid specifications (not an object)`;
        result.errors.push(error);
        result.passed = false;
      }
    } catch (error) {
      invalidJsonCount++;
      const errorMsg = `Record ${record.code} has unparseable specifications`;
      result.errors.push(errorMsg);
      result.passed = false;
    }
  }

  if (invalidJsonCount > 0) {
    console.log(`  ❌ Found ${invalidJsonCount} records with invalid JSON specifications`);
  } else {
    console.log(`  ✓ All specifications have valid JSON structure`);
  }
}

function printValidationSummary(result: ValidationResult) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 Validation Summary');
  console.log('='.repeat(60));

  console.log(`\n📈 Record Counts:`);
  console.log(`  Total legacy records:    ${result.summary.totalLegacyRecords}`);
  console.log(`  Total migrated records:  ${result.summary.totalMigratedRecords}`);
  console.log(`  Supplier mappings:       ${result.summary.totalSupplierMappings}`);

  console.log(`\n📋 By Material Type:`);
  for (const [type, counts] of Object.entries(result.summary.byType)) {
    const status = counts.legacy === counts.migrated ? '✓' : '❌';
    console.log(`  ${status} ${type.padEnd(20)} : ${counts.legacy} → ${counts.migrated}`);
  }

  if (result.errors.length > 0) {
    console.log(`\n❌ Errors (${result.errors.length}):`);
    result.errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
  }

  if (result.warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${result.warnings.length}):`);
    result.warnings.forEach((warn, i) => console.log(`  ${i + 1}. ${warn}`));
  }

  console.log('\n' + '='.repeat(60));
  if (result.passed) {
    console.log('✅ VALIDATION PASSED - Migration successful!');
  } else {
    console.log('❌ VALIDATION FAILED - Please review errors above');
  }
  console.log('='.repeat(60) + '\n');
}

function getPrefix(tableName: string): string {
  return tableName.replace('_master', '').replace(/_/g, '');
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Run validation
validateMigration()
  .then((result) => {
    if (!result.passed) {
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Validation script failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
