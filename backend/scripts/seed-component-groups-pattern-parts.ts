import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedComponentGroupsAndPatternParts() {
  console.log('Starting seed: Component Groups and Pattern Parts...');

  try {
    // Step 1: Seed Component Groups
    console.log('Seeding Component Groups...');

    const componentGroups = [
      {
        code: 'TOP',
        name: 'Top Wear',
        description: 'Upper body garments worn as main piece (Blouse, Shirt, Top, Kurti, Crop Top, T-Shirt, Kameez, Choli)',
        sortOrder: 1,
      },
      {
        code: 'BOTTOM',
        name: 'Bottom Wear',
        description: 'Lower body garments worn as main piece (Pants, Skirt, Palazzo, Sharara, Lehenga, Trousers, Jeans, Dhoti)',
        sortOrder: 2,
      },
      {
        code: 'FULL',
        name: 'Full Garment',
        description: 'Single-piece garments covering full body (Dress, Gown, Jumpsuit, Saree, Anarkali, Abaya, Kaftan, Romper)',
        sortOrder: 3,
      },
      {
        code: 'INNER',
        name: 'Inner Wear',
        description: 'Garments worn underneath main pieces (Lining, Petticoat, Slip, Camisole, Inner Kurti, Can-Can)',
        sortOrder: 4,
      },
      {
        code: 'OUTER',
        name: 'Outer Wear',
        description: 'Garments worn over other pieces as layers (Jacket, Shrug, Coat, Blazer, Cardigan, Cape, Overcoat, Nehru Jacket)',
        sortOrder: 5,
      },
      {
        code: 'ACCESS',
        name: 'Accessory',
        description: 'Additional decorative or functional pieces (Dupatta, Belt, Scarf, Stole, Odhni, Chunari, Sash)',
        sortOrder: 6,
      },
    ];

    for (const group of componentGroups) {
      const existing = await prisma.component_group_master.findFirst({
        where: { code: group.code },
      });

      if (existing) {
        await prisma.component_group_master.update({
          where: { id: existing.id },
          data: {
            name: group.name,
            description: group.description,
            sortOrder: group.sortOrder,
            isActive: true,
          },
        });
      } else {
        await prisma.component_group_master.create({
          data: group,
        });
      }
    }

    console.log('✅ Component Groups seeded successfully');

    // Step 2: Seed Pattern Parts (for future use)
    console.log('Seeding Pattern Parts...');

    const patternParts = [
      {
        code: 'ALL_PARTS',
        name: 'All Parts',
        description: 'Represents all pattern parts combined (for CAD planning when all parts use the same fabric)',
        sortOrder: -1, // Always appears first
      },
      {
        code: 'BODY_FRONT',
        name: 'Body Front',
        description: 'Front panel of garment (used in Blouse, Shirt, Kurti, Dress)',
        sortOrder: 1,
      },
      {
        code: 'BODY_BACK',
        name: 'Body Back',
        description: 'Back panel of garment (used in Blouse, Shirt, Kurti, Dress)',
        sortOrder: 2,
      },
      {
        code: 'SLEEVE',
        name: 'Sleeve',
        description: 'Sleeve pattern piece (used in Blouse, Shirt, Jacket, Kurti)',
        sortOrder: 3,
      },
      {
        code: 'COLLAR',
        name: 'Collar',
        description: 'Collar pattern piece (used in Shirt, Blouse, Jacket, Kurti)',
        sortOrder: 4,
      },
      {
        code: 'CUFF',
        name: 'Cuff',
        description: 'Cuff pattern piece (used in Shirt, Blouse, Kurta)',
        sortOrder: 5,
      },
      {
        code: 'YOKE',
        name: 'Yoke',
        description: 'Yoke panel for shoulders/chest area (used in Shirt, Kurti, Dress)',
        sortOrder: 6,
      },
      {
        code: 'POCKET',
        name: 'Pocket',
        description: 'Pocket pattern piece (used in Shirt, Pants, Jacket)',
        sortOrder: 7,
      },
      {
        code: 'WAISTBAND',
        name: 'Waistband',
        description: 'Waistband for bottoms (used in Pants, Skirt, Palazzo, Lehenga)',
        sortOrder: 8,
      },
      {
        code: 'PLACKET',
        name: 'Placket',
        description: 'Button placket (used in Shirt, Kurti, Kurta)',
        sortOrder: 9,
      },
      {
        code: 'GUSSET',
        name: 'Gusset',
        description: 'Underarm or side gusset (used in Kurta, Traditional garments)',
        sortOrder: 10,
      },
      {
        code: 'FLAP',
        name: 'Flap',
        description: 'Pocket flap or decorative flap (used in Jacket, Shirt, Pants)',
        sortOrder: 11,
      },
      {
        code: 'LINING',
        name: 'Lining',
        description: 'Lining layer (used in Jacket, Blazer, Coat)',
        sortOrder: 12,
      },
    ];

    for (const part of patternParts) {
      const existing = await prisma.pattern_part_master.findFirst({
        where: { code: part.code },
      });

      if (existing) {
        await prisma.pattern_part_master.update({
          where: { id: existing.id },
          data: {
            name: part.name,
            description: part.description,
            sortOrder: part.sortOrder,
            isActive: true,
          },
        });
      } else {
        await prisma.pattern_part_master.create({
          data: part,
        });
      }
    }

    console.log('✅ Pattern Parts seeded successfully');

    // Step 2.5: Ensure ALL_PARTS is assigned to all component groups
    console.log('Assigning ALL_PARTS to all component groups...');

    const allPartsPatternPart = await prisma.pattern_part_master.findFirst({
      where: { code: 'ALL_PARTS' },
    });

    if (allPartsPatternPart) {
      const allGroups = await prisma.component_group_master.findMany();
      let allPartsAssignments = 0;

      for (const group of allGroups) {
        const existing = await prisma.pattern_part_groups.findFirst({
          where: {
            patternPartId: allPartsPatternPart.id,
            componentGroupId: group.id,
          },
        });

        if (!existing) {
          await prisma.pattern_part_groups.create({
            data: {
              patternPartId: allPartsPatternPart.id,
              componentGroupId: group.id,
            },
          });
          allPartsAssignments++;
        }
      }

      console.log(`✅ Assigned ALL_PARTS to ${allPartsAssignments} component groups`);
    }

    // Step 3: Migrate existing component_masters data
    console.log('Migrating existing component data to new structure...');

    // Get all component groups for mapping
    const groups = await prisma.component_group_master.findMany();
    const groupMap = new Map(groups.map(g => [g.code, g.id]));

    // Map old componentCategory values to new component group codes
    const categoryMapping: Record<string, string> = {
      'Upper Wear': 'TOP',
      'Topwear': 'TOP',
      'Top Wear': 'TOP',
      'Lower Wear': 'BOTTOM',
      'Bottomwear': 'BOTTOM',
      'Bottom Wear': 'BOTTOM',
      'Accessory': 'ACCESS',
      'Accessories': 'ACCESS',
      'Inner Wear': 'INNER',
      'Innerwear': 'INNER',
      'Outer Wear': 'OUTER',
      'Outerwear': 'OUTER',
      'Full Garment': 'FULL',
      'One Piece': 'FULL',
    };

    // Get all components with old componentCategory values
    const components = await prisma.component_masters.findMany({
      where: {
        componentCategory: { not: null },
        componentGroupId: null, // Only update components that haven't been migrated yet
      },
    });

    let migratedCount = 0;
    for (const component of components) {
      if (component.componentCategory) {
        const groupCode = categoryMapping[component.componentCategory];
        if (groupCode) {
          const groupId = groupMap.get(groupCode);
          if (groupId) {
            await prisma.component_masters.update({
              where: { id: component.id },
              data: { componentGroupId: groupId },
            });
            migratedCount++;
          }
        }
      }
    }

    console.log(`✅ Migrated ${migratedCount} component(s) to new component groups`);

    // Step 4: Update existing product categories with default min/max components
    console.log('Updating product categories with default component counts...');

    const categoriesToUpdate = await prisma.product_category_master.findMany({
      where: {
        OR: [
          { minComponents: { equals: 1 } },
          { maxComponents: { equals: 1 } },
        ],
      },
    });

    // Set sensible defaults for specific categories
    const categoryDefaults: Record<string, { min: number; max: number }> = {
      'Co-Ords Set': { min: 2, max: 3 },
      'Co-Ord Set': { min: 2, max: 3 },
      'Coords Set': { min: 2, max: 3 },
      '3-Piece Suit': { min: 3, max: 3 },
      '2-Piece Suit': { min: 2, max: 2 },
      'Salwar Suit': { min: 2, max: 3 }, // Can have dupatta
      'Lehenga Choli': { min: 2, max: 3 }, // Can have dupatta
      'Kurti Set': { min: 2, max: 3 },
    };

    for (const category of categoriesToUpdate) {
      const defaults = categoryDefaults[category.name];
      if (defaults) {
        await prisma.product_category_master.update({
          where: { id: category.id },
          data: {
            minComponents: defaults.min,
            maxComponents: defaults.max,
          },
        });
      }
    }

    console.log('✅ Product categories updated with component count defaults');

    // Step 5: Seed Component → Pattern Part Mappings
    // Use pattern_part_groups to automatically assign parts based on component groups
    console.log('Seeding component pattern part mappings based on component groups...');

    // Get all components with their component groups
    const allComponents = await prisma.component_masters.findMany({
      include: {
        componentGroup: true,
      },
    });

    // Get pattern part to component group mappings
    const patternPartGroupMappings = await prisma.pattern_part_groups.findMany({
      include: {
        patternPart: true,
        componentGroup: true,
      },
    });

    // Build a map: componentGroupId -> list of pattern parts
    const groupToPartsMap = new Map<string, Array<{ id: string; code: string; name: string }>>();
    patternPartGroupMappings.forEach((mapping) => {
      const groupId = mapping.componentGroupId;
      if (!groupToPartsMap.has(groupId)) {
        groupToPartsMap.set(groupId, []);
      }
      groupToPartsMap.get(groupId)!.push({
        id: mapping.patternPart.id,
        code: mapping.patternPart.code,
        name: mapping.patternPart.name,
      });
    });

    let mappingCount = 0;
    let skippedComponents = 0;

    // For each component, assign all pattern parts from its component group
    for (const component of allComponents) {
      if (!component.componentGroupId) {
        console.log(`  ⚠️  Skipping ${component.name} - no component group assigned`);
        skippedComponents++;
        continue;
      }

      // Get pattern parts for this component's group
      const patternParts = groupToPartsMap.get(component.componentGroupId) || [];

      if (patternParts.length === 0) {
        console.log(`  ⚠️  No pattern parts found for ${component.name} (group: ${component.componentGroup?.name})`);
        continue;
      }

      // Create mappings for each pattern part
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
          mappingCount++;
        }
      }
    }

    console.log(`✅ Created ${mappingCount} component-pattern part mappings`);
    if (skippedComponents > 0) {
      console.log(`   ℹ️  Skipped ${skippedComponents} components without component group assignment`);
    }

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - ${componentGroups.length} Component Groups created`);
    console.log(`   - ${patternParts.length} Pattern Parts created`);
    console.log(`   - ${migratedCount} Components migrated to new structure`);
    console.log(`   - ${mappingCount} Component-Pattern Part mappings created`);
    console.log(`   - Product categories updated with component count defaults`);

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

async function main() {
  try {
    await seedComponentGroupsAndPatternParts();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
