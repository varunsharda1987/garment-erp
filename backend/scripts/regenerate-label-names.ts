/**
 * Regenerate all label names using the structured format.
 *
 * Format: {labelCode} | {labelType} | {brand} | {color} | {material} | {size}
 *
 * Usage:
 *   npx ts-node scripts/regenerate-label-names.ts           # dry-run
 *   npx ts-node scripts/regenerate-label-names.ts --apply   # apply changes
 */
import prisma from '../src/config/database';
import { generateLabelNameSync } from '../src/services/helpers/label-name.helper';

async function main() {
  const dryRun = !process.argv.includes('--apply');

  if (dryRun) {
    console.log('DRY RUN — pass --apply to write changes\n');
  }

  const labels = await prisma.label_master.findMany({
    where: { isActive: true },
    select: {
      id: true,
      labelCode: true,
      labelName: true,
      labelType: true,
      labelCategory: true,
      brandCategoryId: true,
      color: true,
      material: true,
      size: true,
      brandCategory: { select: { brandName: true } },
    },
    orderBy: { labelCode: 'asc' },
  });

  console.log(`Found ${labels.length} active labels\n`);

  let changedCount = 0;

  for (const label of labels) {
    const newName = generateLabelNameSync({
      labelCode: label.labelCode,
      labelType: label.labelType,
      labelCategory: label.labelCategory,
      brandName: label.brandCategory?.brandName,
      color: label.color,
      material: label.material,
      size: label.size,
    });

    if (newName !== label.labelName) {
      changedCount++;
      console.log(`${label.labelCode}:`);
      console.log(`  OLD: ${label.labelName}`);
      console.log(`  NEW: ${newName}`);
      console.log();

      if (!dryRun) {
        await prisma.label_master.update({
          where: { id: label.id },
          data: { labelName: newName },
        });
        // Also sync to materials
        await prisma.materials.updateMany({
          where: { labelId: label.id },
          data: { name: newName },
        });
      }
    }
  }

  console.log(`\n${changedCount} of ${labels.length} labels would change`);
  if (!dryRun && changedCount > 0) {
    console.log('Changes applied.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
