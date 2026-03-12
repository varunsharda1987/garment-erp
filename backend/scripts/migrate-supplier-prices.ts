/**
 * Data Migration: Copy supplier prices from material_supplier_mapping → material_suppliers
 *
 * Bridges the two parallel systems:
 *   material_supplier_mapping (Int materialId → material_master.id) — has prices
 *   material_suppliers (String materialId → materials.id) — needs prices
 *
 * Bridge path:
 *   material_master.legacyXxxId → materials.xxxId → material_suppliers.materialId
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Maps material_master legacy fields to materials fields
const LEGACY_FIELD_MAP: Record<string, string> = {
  legacyLabelId: 'labelId',
  legacyButtonId: 'buttonId',
  legacyThreadId: 'threadId',
  legacyZipperId: 'zipperId',
  legacyElasticId: 'elasticId',
  legacyPackagingId: 'packagingId',
  legacyMachinePartId: 'machinePartId',
  legacyHookEyeId: 'otherMaterialId', // hook_eye maps to other_material
  legacySnapButtonId: 'otherMaterialId',
  legacyBuckleId: 'otherMaterialId',
};

async function migrate() {
  console.log('=== Migrating supplier prices to material_suppliers ===\n');

  // Get all material_supplier_mapping records with their material_master data
  const mappings = await prisma.material_supplier_mapping.findMany({
    where: { isActive: true },
    include: {
      material: true, // material_master record
    },
  });

  console.log(`Found ${mappings.length} active material_supplier_mapping records\n`);

  let migrated = 0;
  let skipped = 0;
  let created = 0;
  let errors = 0;

  for (const mapping of mappings) {
    const master = mapping.material;

    // Find which legacy field links this material_master to a specific master
    let materialsId: string | null = null;

    for (const [legacyField, materialsField] of Object.entries(LEGACY_FIELD_MAP)) {
      const legacyValue = (master as any)[legacyField];
      if (legacyValue) {
        // Find the materials record that links to this specific master
        const mat = await prisma.materials.findFirst({
          where: { [materialsField]: legacyValue },
          select: { id: true },
        });
        if (mat) {
          materialsId = mat.id;
          break;
        }
      }
    }

    if (!materialsId) {
      // Try matching by code or name as fallback
      const mat = await prisma.materials.findFirst({
        where: {
          OR: [
            { code: master.code },
            { name: master.name },
          ],
        },
        select: { id: true },
      });
      if (mat) {
        materialsId = mat.id;
      }
    }

    if (!materialsId) {
      skipped++;
      continue;
    }

    try {
      // Upsert into material_suppliers
      const existing = await prisma.material_suppliers.findUnique({
        where: {
          materialId_supplierId: {
            materialId: materialsId,
            supplierId: mapping.supplierId,
          },
        },
      });

      if (existing) {
        // Update with price data
        await prisma.material_suppliers.update({
          where: { id: existing.id },
          data: {
            supplierPrice: mapping.supplierPrice,
            leadTimeDays: mapping.leadTimeDays,
            moq: mapping.moq,
            moqUnit: mapping.moqUnit,
            isPrimary: mapping.isPrimary,
          },
        });
        migrated++;
      } else {
        // Create new record
        await prisma.material_suppliers.create({
          data: {
            materialId: materialsId,
            supplierId: mapping.supplierId,
            supplierPrice: mapping.supplierPrice,
            leadTimeDays: mapping.leadTimeDays,
            moq: mapping.moq,
            moqUnit: mapping.moqUnit,
            isPrimary: mapping.isPrimary,
            isPreferred: mapping.isPrimary,
            isActive: true,
          },
        });
        created++;
      }
    } catch (e: any) {
      errors++;
      console.error(`  Error for master ${master.code} → supplier ${mapping.supplierId}: ${e.message}`);
    }
  }

  console.log('Results:');
  console.log(`  Updated existing: ${migrated}`);
  console.log(`  Created new:      ${created}`);
  console.log(`  Skipped (no match): ${skipped}`);
  console.log(`  Errors:           ${errors}`);
  console.log(`\nDone.`);

  await prisma.$disconnect();
}

migrate().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
