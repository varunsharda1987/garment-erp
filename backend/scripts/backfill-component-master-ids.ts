/**
 * Backfill script to populate componentMasterId in style_components table
 *
 * This script matches existing style_components records to component_masters
 * by comparing componentName (case-insensitive).
 *
 * Run with: npx ts-node scripts/backfill-component-master-ids.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting componentMasterId backfill...\n');

  // Get all component masters for lookup
  const componentMasters = await prisma.component_masters.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
    },
  });

  console.log(`Found ${componentMasters.length} component masters:\n`);
  componentMasters.forEach(cm => console.log(`  - ${cm.name} (${cm.id.substring(0, 8)}...)`));
  console.log('');

  // Create a case-insensitive lookup map
  const masterLookup = new Map<string, string>();
  componentMasters.forEach(cm => {
    masterLookup.set(cm.name.toLowerCase().trim(), cm.id);
  });

  // Get all style_components without componentMasterId
  const styleComponents = await prisma.style_components.findMany({
    where: {
      componentMasterId: null,
    },
    select: {
      id: true,
      componentName: true,
      styleId: true,
    },
  });

  console.log(`Found ${styleComponents.length} style_components without componentMasterId\n`);

  let matched = 0;
  let unmatched = 0;
  const unmatchedNames = new Set<string>();

  for (const sc of styleComponents) {
    const normalizedName = sc.componentName.toLowerCase().trim();
    const masterId = masterLookup.get(normalizedName);

    if (masterId) {
      await prisma.style_components.update({
        where: { id: sc.id },
        data: { componentMasterId: masterId },
      });
      matched++;
    } else {
      unmatched++;
      unmatchedNames.add(sc.componentName);
    }
  }

  console.log('Backfill complete!\n');
  console.log(`  Matched:   ${matched}`);
  console.log(`  Unmatched: ${unmatched}`);

  if (unmatchedNames.size > 0) {
    console.log('\nUnmatched component names (need manual review or new master entries):');
    unmatchedNames.forEach(name => console.log(`  - "${name}"`));
  }

  // Show summary of current state
  const totalWithMaster = await prisma.style_components.count({
    where: { componentMasterId: { not: null } },
  });
  const totalWithoutMaster = await prisma.style_components.count({
    where: { componentMasterId: null },
  });

  console.log('\nFinal state:');
  console.log(`  With componentMasterId:    ${totalWithMaster}`);
  console.log(`  Without componentMasterId: ${totalWithoutMaster}`);
}

main()
  .catch((error) => {
    console.error('Error during backfill:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
