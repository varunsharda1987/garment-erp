/**
 * Sync Trim Supplier Prices → material_suppliers
 *
 * Copies prices from trim-specific supplier tables (button_suppliers, label_suppliers, etc.)
 * into the unified material_suppliers table so PO generation can look up prices directly.
 *
 * Bridge path per type:
 *   button_suppliers.buttonId → materials.buttonId → material_suppliers.materialId
 *   label_suppliers.labelId → materials.labelId → material_suppliers.materialId
 *   etc.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TrimConfig {
  name: string;
  table: string;
  masterIdField: string;       // Field name in trim supplier table (e.g., buttonId)
  materialsField: string;      // Matching field in materials table (e.g., buttonId)
  priceField: string;          // Price field to copy (e.g., pricePerPiece)
}

const TRIM_CONFIGS: TrimConfig[] = [
  { name: 'Button', table: 'button_suppliers', masterIdField: 'buttonId', materialsField: 'buttonId', priceField: 'pricePerPiece' },
  { name: 'Label', table: 'label_suppliers', masterIdField: 'labelId', materialsField: 'labelId', priceField: 'pricePerPiece' },
  { name: 'Thread', table: 'thread_suppliers', masterIdField: 'threadId', materialsField: 'threadId', priceField: 'pricePerCone' },
  { name: 'Zipper', table: 'zipper_suppliers', masterIdField: 'zipperId', materialsField: 'zipperId', priceField: 'pricePerPiece' },
  { name: 'Elastic', table: 'elastic_suppliers', masterIdField: 'elasticId', materialsField: 'elasticId', priceField: 'pricePerMeter' },
  { name: 'Packaging', table: 'packaging_suppliers', masterIdField: 'packagingId', materialsField: 'packagingId', priceField: 'pricePerPiece' },
];

async function syncTrimPrices() {
  console.log('=== Syncing Trim Supplier Prices → material_suppliers ===\n');

  let totalUpdated = 0;
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const config of TRIM_CONFIGS) {
    console.log(`--- ${config.name} (${config.table}) ---`);

    // Get all active supplier records from the trim-specific table
    const trimSuppliers = await (prisma as any)[config.table].findMany({
      where: { isActive: true },
      select: {
        [config.masterIdField]: true,
        supplierId: true,
        isPreferred: true,
        isActive: true,
        notes: true,
        [config.priceField]: true,
      },
    });

    console.log(`  Found ${trimSuppliers.length} active records`);

    let updated = 0;
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const ts of trimSuppliers) {
      const masterId = ts[config.masterIdField];
      const price = ts[config.priceField];

      if (!masterId || !ts.supplierId) {
        skipped++;
        continue;
      }

      // Find the materials record linked to this master
      const material = await prisma.materials.findFirst({
        where: { [config.materialsField]: masterId },
        select: { id: true },
      });

      if (!material) {
        skipped++;
        continue;
      }

      try {
        const existing = await prisma.material_suppliers.findUnique({
          where: {
            materialId_supplierId: {
              materialId: material.id,
              supplierId: ts.supplierId,
            },
          },
        });

        if (existing) {
          // Update with price if we have one and existing doesn't
          if (price && Number(price) > 0 && (!existing.supplierPrice || Number(existing.supplierPrice) === 0)) {
            await prisma.material_suppliers.update({
              where: { id: existing.id },
              data: {
                supplierPrice: price,
                isPrimary: ts.isPreferred || false,
              },
            });
            updated++;
          } else {
            skipped++;
          }
        } else {
          // Create new material_suppliers record
          await prisma.material_suppliers.create({
            data: {
              materialId: material.id,
              supplierId: ts.supplierId,
              supplierPrice: price || null,
              isPreferred: ts.isPreferred || false,
              isPrimary: ts.isPreferred || false,
              isActive: true,
              notes: ts.notes || `Synced from ${config.table}`,
            },
          });
          created++;
        }
      } catch (e: any) {
        errors++;
        if (!e.message.includes('Unique constraint')) {
          console.error(`  Error: ${e.message}`);
        }
      }
    }

    console.log(`  Updated: ${updated}, Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`);
    totalUpdated += updated;
    totalCreated += created;
    totalSkipped += skipped;
    totalErrors += errors;
  }

  console.log('\n=== Summary ===');
  console.log(`  Total updated: ${totalUpdated}`);
  console.log(`  Total created: ${totalCreated}`);
  console.log(`  Total skipped: ${totalSkipped}`);
  console.log(`  Total errors:  ${totalErrors}`);

  await prisma.$disconnect();
}

syncTrimPrices().catch((e) => {
  console.error('Sync failed:', e);
  process.exit(1);
});
