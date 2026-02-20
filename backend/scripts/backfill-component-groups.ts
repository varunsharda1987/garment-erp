/**
 * Backfill Script: Assign Component Groups to Components
 *
 * This script finds all components with NULL componentGroupId and assigns them
 * to appropriate component groups, then assigns pattern parts to them.
 *
 * Usage: npx ts-node scripts/backfill-component-groups.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Map component names to component group codes
const COMPONENT_GROUP_MAPPINGS: Record<string, string> = {
  // Bottom Wear
  'Pants': 'BOTTOM',
  'Farshi Pants': 'BOTTOM',
  'Trouser': 'BOTTOM',
  'Jeans': 'BOTTOM',
  'Palazzo': 'BOTTOM',
  'Salwar': 'BOTTOM',
  'Sharara': 'BOTTOM',
  'Lehenga Skirt': 'BOTTOM',
  'Skirt': 'BOTTOM',
  'Shorts': 'BOTTOM',
  'Leggings': 'BOTTOM',
  'Dhoti Pant': 'BOTTOM',
  'Track Pant': 'BOTTOM',
  'Pajama': 'BOTTOM',
  'Churidar': 'BOTTOM',
  'Dhoti': 'BOTTOM',

  // Top Wear
  'Shirt': 'TOP',
  'Blouse': 'TOP',
  'Top': 'TOP',
  'T-Shirt': 'TOP',
  'Kurta': 'TOP',
  'Kameez': 'TOP',
  'Choli': 'TOP',

  // Full Garments
  'Dress': 'FULL',
  'Jumpsuit': 'FULL',
  'Gown': 'FULL',
  'Nightgown': 'FULL',
  'Saree': 'FULL',

  // Outer Wear
  'Jacket': 'OUTER',
  'Sherwani': 'OUTER',
  'Cape': 'OUTER',

  // Inner Wear
  'Inner': 'INNER',

  // Accessories
  'Dupatta': 'ACCESS',
  'Stole': 'ACCESS',
};

async function main() {
  console.log('🔧 Backfill Script: Assign Component Groups to Components\n');

  try {
    // Step 1: Find all components with NULL componentGroupId
    console.log('📊 Step 1: Finding components with NULL componentGroupId...');
    const affectedComponents = await prisma.component_masters.findMany({
      where: {
        componentGroupId: null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        componentGroupId: true,
      },
    });

    if (affectedComponents.length === 0) {
      console.log('✅ No components found with NULL componentGroupId. All components are properly configured!\n');
      return;
    }

    console.log(`   Found ${affectedComponents.length} component(s) without component group assignment:`);
    affectedComponents.forEach(comp => {
      console.log(`   - ${comp.name}`);
    });
    console.log('');

    // Step 2: Get all component groups for validation
    console.log('📊 Step 2: Loading component groups...');
    const componentGroups = await prisma.component_group_master.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
    });

    const groupCodeToIdMap = new Map(
      componentGroups.map(g => [g.code, g.id])
    );

    console.log(`   Loaded ${componentGroups.length} component group(s):\n`);
    componentGroups.forEach(g => {
      console.log(`   - ${g.code}: ${g.name}`);
    });
    console.log('');

    // Step 3: Update components with appropriate componentGroupId
    console.log('📊 Step 3: Assigning component groups...');
    let updatedCount = 0;
    let unmappedComponents: string[] = [];

    for (const component of affectedComponents) {
      const groupCode = COMPONENT_GROUP_MAPPINGS[component.name];

      if (!groupCode) {
        console.log(`   ⚠️  No mapping found for "${component.name}" - skipping`);
        unmappedComponents.push(component.name);
        continue;
      }

      const groupId = groupCodeToIdMap.get(groupCode);

      if (!groupId) {
        console.log(`   ⚠️  Component group "${groupCode}" not found - skipping "${component.name}"`);
        unmappedComponents.push(component.name);
        continue;
      }

      // Update component with componentGroupId
      await prisma.component_masters.update({
        where: { id: component.id },
        data: { componentGroupId: groupId },
      });

      const groupName = componentGroups.find(g => g.id === groupId)?.name || groupCode;
      console.log(`   ✅ Assigned "${component.name}" → ${groupName} (${groupCode})`);
      updatedCount++;
    }

    console.log(`\n✅ Updated ${updatedCount} component(s) with component group assignments`);

    if (unmappedComponents.length > 0) {
      console.log(`\n⚠️  ${unmappedComponents.length} component(s) could not be mapped automatically:`);
      unmappedComponents.forEach(name => {
        console.log(`   - ${name}`);
      });
      console.log('\n   These components need to be mapped manually via the Component Masters UI or by adding');
      console.log('   them to the COMPONENT_GROUP_MAPPINGS in this script and running it again.');
    }

    // Step 4: Assign pattern parts to updated components
    let mappingCount = 0;

    if (updatedCount > 0) {
      console.log('\n📊 Step 4: Assigning pattern parts to updated components...');
      console.log('   (This will assign pattern parts based on component group)');
      console.log('\n   Loading pattern part groups...');

      // Get pattern part groups mapping
      const patternPartGroups = await prisma.pattern_part_groups.findMany({
        include: {
          patternPart: true,
          componentGroup: true,
        },
      });

      // Build map of componentGroupId -> pattern parts
      const groupToPartsMap = new Map<string, Array<{ id: string; code: string }>>();
      patternPartGroups.forEach(ppg => {
        if (!groupToPartsMap.has(ppg.componentGroupId)) {
          groupToPartsMap.set(ppg.componentGroupId, []);
        }
        groupToPartsMap.get(ppg.componentGroupId)!.push({
          id: ppg.patternPartId,
          code: ppg.patternPart.code,
        });
      });

      console.log(`   Loaded ${patternPartGroups.length} pattern part group mapping(s)\n`);

      // Get the updated components with their componentGroupId
      const updatedComponents = await prisma.component_masters.findMany({
        where: {
          id: { in: affectedComponents.map(c => c.id) },
          componentGroupId: { not: null },
        },
        include: {
          componentGroup: true,
        },
      });

      for (const component of updatedComponents) {
        if (!component.componentGroupId) continue;

        const patternParts = groupToPartsMap.get(component.componentGroupId) || [];

        if (patternParts.length === 0) {
          console.log(`   ⚠️  No pattern parts found for ${component.name} (group: ${component.componentGroup?.name})`);
          continue;
        }

        console.log(`\n   Processing ${component.name} (${component.componentGroup?.name})...`);

        for (const part of patternParts) {
          // Check if mapping already exists
          const existing = await prisma.component_pattern_parts.findFirst({
            where: {
              componentId: component.id,
              patternPartId: part.id,
            },
          });

          if (!existing) {
            await prisma.component_pattern_parts.create({
              data: {
                componentId: component.id,
                patternPartId: part.id,
                quantity: part.code === 'SLEEVE' ? 2 : 1, // 2 sleeves, 1 for others
                isRequired: part.code === 'ALL_PARTS' || part.code === 'BODY_FRONT' || part.code === 'BODY_BACK',
              },
            });
            console.log(`     ✓ Added pattern part: ${part.code}`);
            mappingCount++;
          }
        }
      }

      console.log(`\n✅ Created ${mappingCount} component-pattern part mapping(s)`);
    }

    // Step 5: Verification
    console.log('\n📊 Step 5: Verification...');
    const remainingNull = await prisma.component_masters.count({
      where: {
        componentGroupId: null,
        isActive: true,
      },
    });

    console.log(`   Components with NULL componentGroupId: ${remainingNull}`);

    if (remainingNull > 0) {
      console.log('   ⚠️  Some components still have NULL componentGroupId (see unmapped list above)');
    }

    // Summary
    console.log('\n🎉 Backfill completed!');
    console.log('\n📊 Summary:');
    console.log(`   - Components found: ${affectedComponents.length}`);
    console.log(`   - Components updated: ${updatedCount}`);
    console.log(`   - Pattern parts assigned: ${mappingCount}`);
    console.log(`   - Remaining NULL: ${remainingNull}`);

    if (updatedCount > 0) {
      console.log('\n✅ Next steps:');
      console.log('   1. Test CAD Planning for styles using updated components');
      console.log('   2. Verify pattern parts appear in Part dropdown');
      console.log('   3. Create a test CAD entry to confirm calculations work');
    }

  } catch (error) {
    console.error('\n❌ Error during backfill:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
