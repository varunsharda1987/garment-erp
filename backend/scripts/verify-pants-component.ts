/**
 * Verification Script: Check "Pants" Component Configuration
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verifying "Pants" Component Configuration\n');

  // Check "Pants" component master
  const pantsComponent = await prisma.component_masters.findFirst({
    where: { name: 'Pants' },
    include: {
      componentGroup: true,
    },
  });

  if (!pantsComponent) {
    console.log('❌ "Pants" component not found in database');
    return;
  }

  console.log('📋 "Pants" Component Details:');
  console.log(`   ID: ${pantsComponent.id}`);
  console.log(`   Name: ${pantsComponent.name}`);
  console.log(`   Component Group ID: ${pantsComponent.componentGroupId || 'NULL'}`);
  console.log(`   Component Group: ${pantsComponent.componentGroup?.name || 'NONE'}`);
  console.log(`   Active: ${pantsComponent.isActive}`);
  console.log('');

  // Check pattern parts assigned to "Pants"
  const patternParts = await prisma.component_pattern_parts.findMany({
    where: { componentId: pantsComponent.id },
    include: {
      patternPart: true,
    },
  });

  console.log('📋 Pattern Parts Assigned to "Pants":');
  if (patternParts.length === 0) {
    console.log('   ❌ NO PATTERN PARTS ASSIGNED');
  } else {
    console.log(`   ✅ ${patternParts.length} pattern part(s) assigned:`);
    patternParts.forEach(pp => {
      console.log(`      - ${pp.patternPart.name} (${pp.patternPart.code}) - Qty: ${pp.quantity}, Required: ${pp.isRequired}`);
    });
  }
  console.log('');

  // Check if componentGroupId exists but has no pattern parts
  if (pantsComponent.componentGroupId && patternParts.length === 0) {
    console.log('⚠️  Component has group assigned but NO pattern parts!');
    console.log('   This is the root cause of the empty dropdown.');
    console.log('\n💡 Solution: Run pattern parts assignment');
    console.log('   Option 1: npx ts-node scripts/seed-component-groups-pattern-parts.ts');
    console.log('   Option 2: Manually assign via database or UI');
  } else if (!pantsComponent.componentGroupId) {
    console.log('⚠️  Component has NO component group assigned!');
    console.log('   This is the root cause of the empty dropdown.');
    console.log('\n💡 Solution: Run backfill script');
    console.log('   npx ts-node scripts/backfill-component-groups.ts');
  } else {
    console.log('✅ Component is properly configured with group and pattern parts!');
  }

  await prisma.$disconnect();
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
