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
      await prisma.component_group_master.upsert({
        where: { code: group.code },
        update: {
          name: group.name,
          description: group.description,
          sortOrder: group.sortOrder,
          isActive: true,
        },
        create: group,
      });
    }

    console.log('✅ Component Groups seeded successfully');

    // Step 2: Seed Pattern Parts (for future use)
    console.log('Seeding Pattern Parts...');

    const patternParts = [
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
      await prisma.pattern_part_master.upsert({
        where: { code: part.code },
        update: {
          name: part.name,
          description: part.description,
          sortOrder: part.sortOrder,
          isActive: true,
        },
        create: part,
      });
    }

    console.log('✅ Pattern Parts seeded successfully');

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

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - ${componentGroups.length} Component Groups created`);
    console.log(`   - ${patternParts.length} Pattern Parts created`);
    console.log(`   - ${migratedCount} Components migrated to new structure`);
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
