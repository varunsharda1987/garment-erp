/**
 * Fix LNG Style Components to Nightgown
 *
 * For all styles starting with "LNG", updates their style_components
 * to use the "Nightgown" component master.
 *
 * - If a style has no components: creates one with Nightgown
 * - If a style has components but not Nightgown: updates the first component
 * - If a style already has Nightgown: skips
 *
 * Usage:
 *   npx ts-node scripts/fix-lng-component-nightgown.ts
 *   npx ts-node scripts/fix-lng-component-nightgown.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(`=== Fix LNG Style Components → Nightgown ===${isDryRun ? ' (DRY RUN)' : ''}\n`);

  // Step 1: Find the Nightgown component master
  const nightgownMaster = await prisma.component_masters.findFirst({
    where: { name: { equals: 'Nightgown', mode: 'insensitive' }, isActive: true },
    include: { componentGroup: true },
  });

  if (!nightgownMaster) {
    console.error('ERROR: "Nightgown" component master not found. Aborting.');
    process.exit(1);
  }
  console.log(`Nightgown master: ${nightgownMaster.name} (${nightgownMaster.id})`);
  console.log(`  Group: ${nightgownMaster.componentGroup?.name || nightgownMaster.componentCategory || 'N/A'}\n`);

  // Step 2: Find all LNG styles with their components
  const lngStyles = await prisma.styles.findMany({
    where: { styleCode: { startsWith: 'LNG' } },
    include: {
      style_components: {
        include: { componentMaster: true },
      },
    },
    orderBy: { styleCode: 'asc' },
  });

  console.log(`Found ${lngStyles.length} styles starting with "LNG"\n`);

  if (lngStyles.length === 0) {
    console.log('No LNG styles found. Nothing to do.');
    return;
  }

  let updated = 0;
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const style of lngStyles) {
    const components = style.style_components;

    // Check if already has Nightgown
    const hasNightgown = components.some(
      c => c.componentMasterId === nightgownMaster.id ||
           c.componentName.toLowerCase() === 'nightgown'
    );

    if (hasNightgown) {
      console.log(`  SKIP ${style.styleCode} - already has Nightgown`);
      skipped++;
      continue;
    }

    try {
      if (components.length > 0) {
        // Update the first component to Nightgown
        const firstComponent = components[0];
        console.log(`  UPDATE ${style.styleCode} - changing "${firstComponent.componentName}" → "Nightgown"`);

        if (!isDryRun) {
          await prisma.style_components.update({
            where: { id: firstComponent.id },
            data: {
              componentName: 'Nightgown',
              componentType: nightgownMaster.componentGroup?.code || nightgownMaster.componentCategory || 'FULL',
              componentMasterId: nightgownMaster.id,
            },
          });
        }
        updated++;
      } else {
        // No components - create one
        console.log(`  CREATE ${style.styleCode} - adding Nightgown component`);

        if (!isDryRun) {
          await prisma.style_components.create({
            data: {
              id: randomUUID(),
              styleId: style.id,
              componentName: 'Nightgown',
              componentType: nightgownMaster.componentGroup?.code || nightgownMaster.componentCategory || 'FULL',
              componentMasterId: nightgownMaster.id,
              sortOrder: 0,
            },
          });

          // Also set numberOfComponents = 1 if it's null/0
          if (!style.numberOfComponents || style.numberOfComponents === 0) {
            await prisma.styles.update({
              where: { id: style.id },
              data: { numberOfComponents: 1 },
            });
          }
        }
        created++;
      }
    } catch (error: any) {
      console.error(`  ERROR ${style.styleCode}: ${error.message}`);
      errors++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`  Total LNG styles: ${lngStyles.length}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Created: ${created}`);
  console.log(`  Skipped (already Nightgown): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  if (isDryRun) console.log('\n  (Dry run - no changes were made)');
  console.log('=== Done ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
