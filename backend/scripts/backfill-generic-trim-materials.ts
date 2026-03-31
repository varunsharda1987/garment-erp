/**
 * Backfill Script: Create materials entries for existing generic trim masters
 *
 * Generic trim masters (drawstring, buckle, hook_eye, etc.) were created without
 * corresponding materials table entries. This script creates them, following the
 * same pattern used by button/thread/zipper controllers.
 *
 * Usage: cd backend && npx ts-node scripts/backfill-generic-trim-materials.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TRIM_CONFIGS: Record<string, {
  model: string;
  codeField: string;
  nameField: string;
  materialType: string;
  defaultUnit: string;
  categoryName: string;
  fkField: string;
}> = {
  hook_eye: { model: 'hook_eye_master', codeField: 'hookEyeCode', nameField: 'hookEyeName', materialType: 'HOOK_EYE', defaultUnit: 'PAIR', categoryName: 'Accessories', fkField: 'hookEyeId' },
  snap_button: { model: 'snap_button_master', codeField: 'snapButtonCode', nameField: 'snapButtonName', materialType: 'SNAP_BUTTON', defaultUnit: 'PIECE', categoryName: 'Accessories', fkField: 'snapButtonId' },
  buckle: { model: 'buckle_master', codeField: 'buckleCode', nameField: 'buckleName', materialType: 'BUCKLE', defaultUnit: 'PIECE', categoryName: 'Accessories', fkField: 'buckleId' },
  belt: { model: 'belt_master', codeField: 'beltCode', nameField: 'beltName', materialType: 'BELT', defaultUnit: 'PIECE', categoryName: 'Accessories', fkField: 'beltId' },
  velcro: { model: 'velcro_master', codeField: 'velcroCode', nameField: 'velcroName', materialType: 'VELCRO', defaultUnit: 'METER', categoryName: 'Accessories', fkField: 'velcroId' },
  drawstring: { model: 'drawstring_master', codeField: 'drawstringCode', nameField: 'drawstringName', materialType: 'DRAWSTRING', defaultUnit: 'METER', categoryName: 'Accessories', fkField: 'drawstringId' },
  ribbon: { model: 'ribbon_master', codeField: 'ribbonCode', nameField: 'ribbonName', materialType: 'RIBBON', defaultUnit: 'METER', categoryName: 'Accessories', fkField: 'ribbonId' },
  sequin: { model: 'sequin_master', codeField: 'sequinCode', nameField: 'sequinName', materialType: 'SEQUIN', defaultUnit: 'METER', categoryName: 'Accessories', fkField: 'sequinId' },
  bead: { model: 'bead_master', codeField: 'beadCode', nameField: 'beadName', materialType: 'BEAD', defaultUnit: 'PACK', categoryName: 'Accessories', fkField: 'beadId' },
  motif: { model: 'motif_master', codeField: 'motifCode', nameField: 'motifName', materialType: 'MOTIF', defaultUnit: 'PIECE', categoryName: 'Accessories', fkField: 'motifId' },
  interlining: { model: 'interlining_master', codeField: 'interliningCode', nameField: 'interliningName', materialType: 'INTERLINING', defaultUnit: 'METER', categoryName: 'Accessories', fkField: 'interliningId' },
  padding: { model: 'padding_master', codeField: 'paddingCode', nameField: 'paddingName', materialType: 'PADDING', defaultUnit: 'PAIR', categoryName: 'Accessories', fkField: 'paddingId' },
  other_fastener: { model: 'other_fastener_master', codeField: 'otherFastenerCode', nameField: 'otherFastenerName', materialType: 'OTHER_FASTENER', defaultUnit: 'PIECE', categoryName: 'Accessories', fkField: 'otherFastenerId' },
  other_tape: { model: 'other_tape_master', codeField: 'otherTapeCode', nameField: 'otherTapeName', materialType: 'OTHER_TAPE', defaultUnit: 'METER', categoryName: 'Accessories', fkField: 'otherTapeId' },
  other_decorative: { model: 'other_decorative_master', codeField: 'otherDecorativeCode', nameField: 'otherDecorativeName', materialType: 'OTHER_DECORATIVE', defaultUnit: 'PIECE', categoryName: 'Accessories', fkField: 'otherDecorativeId' },
  other_functional: { model: 'other_functional_master', codeField: 'otherFunctionalCode', nameField: 'otherFunctionalName', materialType: 'OTHER_FUNCTIONAL', defaultUnit: 'PIECE', categoryName: 'Accessories', fkField: 'otherFunctionalId' },
};

async function backfill() {
  console.log('=== Backfill Generic Trim Materials ===\n');

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const [trimType, config] of Object.entries(TRIM_CONFIGS)) {
    const model = (prisma as any)[config.model];
    const allItems = await model.findMany({ where: { isActive: true } });

    if (allItems.length === 0) {
      console.log(`  ${trimType}: No records found, skipping`);
      continue;
    }

    // Find or create category
    let category = await prisma.material_categories.findFirst({
      where: { name: config.categoryName },
    });

    if (!category) {
      console.log(`  WARNING: Category "${config.categoryName}" not found, creating...`);
      category = await prisma.material_categories.create({
        data: {
          id: `cat-${config.categoryName.toLowerCase().replace(/\s+/g, '-')}`,
          name: config.categoryName,
          isActive: true,
        },
      });
    }

    let created = 0;
    let skipped = 0;

    for (const item of allItems) {
      // Check if materials entry already exists for this master
      const existing = await prisma.materials.findFirst({
        where: { [config.fkField]: item.id },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const code = item[config.codeField];
      const name = item[config.nameField];
      const materialId = `mat-${code.toLowerCase()}`;

      try {
        await prisma.materials.create({
          data: {
            id: materialId,
            code: code,
            name: name,
            materialType: config.materialType as any,
            [config.fkField]: item.id,
            categoryId: category.id,
            unit: config.defaultUnit as any,
            isActive: item.isActive ?? true,
          },
        });
        created++;
      } catch (err: any) {
        // Handle duplicate ID conflicts
        if (err.code === 'P2002') {
          console.log(`    Duplicate material ID ${materialId}, using UUID instead`);
          const { randomUUID } = await import('crypto');
          await prisma.materials.create({
            data: {
              id: randomUUID(),
              code: code,
              name: name,
              materialType: config.materialType as any,
              [config.fkField]: item.id,
              categoryId: category.id,
              unit: config.defaultUnit as any,
              isActive: item.isActive ?? true,
            },
          });
          created++;
        } else {
          console.error(`    Error creating material for ${code}: ${err.message}`);
        }
      }
    }

    console.log(`  ${trimType}: ${created} created, ${skipped} already existed (of ${allItems.length} total)`);
    totalCreated += created;
    totalSkipped += skipped;
  }

  console.log(`\n=== Done: ${totalCreated} materials created, ${totalSkipped} already existed ===`);
}

backfill()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
