/**
 * Category Component Defaults Seed Script
 * Creates default component mappings for product categories
 *
 * This script maps garment components to product categories so that when
 * creating a new style, the system can auto-suggest which components are
 * typically included (e.g., Anarkali → Kurta + Pajama + Dupatta)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Component name mappings - maps product categories to their typical components
interface CategoryComponentMapping {
  categoryCode: string;
  components: {
    name: string;
    isRequired: boolean;
    sortOrder: number;
  }[];
}

// Define default component mappings for each product category
const categoryComponentMappings: CategoryComponentMapping[] = [
  // Ethnic Wear - Kurta Sets
  {
    categoryCode: 'EW-KRS',
    components: [
      { name: 'Kurta', isRequired: true, sortOrder: 1 },
      { name: 'Bottom', isRequired: true, sortOrder: 2 },
      { name: 'Dupatta', isRequired: false, sortOrder: 3 },
    ],
  },
  // Ethnic Wear - Kurtas (standalone)
  {
    categoryCode: 'EW-KRT',
    components: [
      { name: 'Kurta', isRequired: true, sortOrder: 1 },
    ],
  },
  // Ethnic Wear - Sarees
  {
    categoryCode: 'EW-SAR',
    components: [
      { name: 'Saree', isRequired: true, sortOrder: 1 },
      { name: 'Blouse', isRequired: true, sortOrder: 2 },
    ],
  },
  // Ethnic Wear - Lehengas
  {
    categoryCode: 'EW-LHG',
    components: [
      { name: 'Lehenga Skirt', isRequired: true, sortOrder: 1 },
      { name: 'Blouse', isRequired: true, sortOrder: 2 },
      { name: 'Dupatta', isRequired: true, sortOrder: 3 },
    ],
  },
  // Ethnic Wear - Anarkalis
  {
    categoryCode: 'EW-ANK',
    components: [
      { name: 'Kurta', isRequired: true, sortOrder: 1 },
      { name: 'Pajama', isRequired: false, sortOrder: 2 },
      { name: 'Dupatta', isRequired: false, sortOrder: 3 },
    ],
  },
  // Ethnic Wear - Salwar Suits
  {
    categoryCode: 'EW-SLS',
    components: [
      { name: 'Kameez', isRequired: true, sortOrder: 1 },
      { name: 'Salwar', isRequired: true, sortOrder: 2 },
      { name: 'Dupatta', isRequired: false, sortOrder: 3 },
    ],
  },
  // Ethnic Wear - Sherwanis
  {
    categoryCode: 'EW-SHW',
    components: [
      { name: 'Sherwani', isRequired: true, sortOrder: 1 },
      { name: 'Churidar', isRequired: true, sortOrder: 2 },
      { name: 'Stole', isRequired: false, sortOrder: 3 },
    ],
  },
  // Ethnic Wear - Dhotis
  {
    categoryCode: 'EW-DHT',
    components: [
      { name: 'Dhoti', isRequired: true, sortOrder: 1 },
      { name: 'Kurta', isRequired: false, sortOrder: 2 },
    ],
  },
  // Ethnic Wear - Palazzo Sets
  {
    categoryCode: 'EW-PLZ',
    components: [
      { name: 'Kurta', isRequired: true, sortOrder: 1 },
      { name: 'Palazzo', isRequired: true, sortOrder: 2 },
      { name: 'Dupatta', isRequired: false, sortOrder: 3 },
    ],
  },
  // Western Wear - T-Shirts
  {
    categoryCode: 'WW-TSH',
    components: [
      { name: 'T-Shirt', isRequired: true, sortOrder: 1 },
    ],
  },
  // Western Wear - Shirts
  {
    categoryCode: 'WW-SHR',
    components: [
      { name: 'Shirt', isRequired: true, sortOrder: 1 },
    ],
  },
  // Western Wear - Jeans
  {
    categoryCode: 'WW-JNS',
    components: [
      { name: 'Jeans', isRequired: true, sortOrder: 1 },
    ],
  },
  // Western Wear - Trousers
  {
    categoryCode: 'WW-TRS',
    components: [
      { name: 'Trouser', isRequired: true, sortOrder: 1 },
    ],
  },
  // Western Wear - Dresses
  {
    categoryCode: 'WW-DRS',
    components: [
      { name: 'Dress', isRequired: true, sortOrder: 1 },
    ],
  },
  // Western Wear - Skirts
  {
    categoryCode: 'WW-SKT',
    components: [
      { name: 'Skirt', isRequired: true, sortOrder: 1 },
    ],
  },
  // Western Wear - Jackets
  {
    categoryCode: 'WW-JKT',
    components: [
      { name: 'Jacket', isRequired: true, sortOrder: 1 },
    ],
  },
  // Western Wear - Shorts
  {
    categoryCode: 'WW-SHT',
    components: [
      { name: 'Shorts', isRequired: true, sortOrder: 1 },
    ],
  },
  // Western Wear - Jumpsuits
  {
    categoryCode: 'WW-JMP',
    components: [
      { name: 'Jumpsuit', isRequired: true, sortOrder: 1 },
    ],
  },
  // Fusion Wear - Indo-Western
  {
    categoryCode: 'FW-IWS',
    components: [
      { name: 'Top', isRequired: true, sortOrder: 1 },
      { name: 'Bottom', isRequired: true, sortOrder: 2 },
    ],
  },
  // Fusion Wear - Fusion Kurtas
  {
    categoryCode: 'FW-FKT',
    components: [
      { name: 'Kurta', isRequired: true, sortOrder: 1 },
    ],
  },
  // Fusion Wear - Dhoti Pants
  {
    categoryCode: 'FW-DHP',
    components: [
      { name: 'Top', isRequired: true, sortOrder: 1 },
      { name: 'Dhoti Pant', isRequired: true, sortOrder: 2 },
    ],
  },
  // Fusion Wear - Cape Sets
  {
    categoryCode: 'FW-CPS',
    components: [
      { name: 'Inner', isRequired: true, sortOrder: 1 },
      { name: 'Cape', isRequired: true, sortOrder: 2 },
      { name: 'Bottom', isRequired: false, sortOrder: 3 },
    ],
  },
  // Fusion Wear - Fusion Dresses
  {
    categoryCode: 'FW-FDS',
    components: [
      { name: 'Dress', isRequired: true, sortOrder: 1 },
    ],
  },
  // Kids Boys - T-Shirts
  {
    categoryCode: 'KW-BOY-TSH',
    components: [
      { name: 'T-Shirt', isRequired: true, sortOrder: 1 },
    ],
  },
  // Kids Boys - Shirts
  {
    categoryCode: 'KW-BOY-SHR',
    components: [
      { name: 'Shirt', isRequired: true, sortOrder: 1 },
    ],
  },
  // Kids Boys - Kurtas
  {
    categoryCode: 'KW-BOY-KRT',
    components: [
      { name: 'Kurta', isRequired: true, sortOrder: 1 },
      { name: 'Pajama', isRequired: false, sortOrder: 2 },
    ],
  },
  // Kids Boys - Shorts
  {
    categoryCode: 'KW-BOY-SHT',
    components: [
      { name: 'Shorts', isRequired: true, sortOrder: 1 },
    ],
  },
  // Kids Girls - Dresses
  {
    categoryCode: 'KW-GRL-DRS',
    components: [
      { name: 'Dress', isRequired: true, sortOrder: 1 },
    ],
  },
  // Kids Girls - Tops
  {
    categoryCode: 'KW-GRL-TOP',
    components: [
      { name: 'Top', isRequired: true, sortOrder: 1 },
    ],
  },
  // Kids Girls - Lehengas
  {
    categoryCode: 'KW-GRL-LHG',
    components: [
      { name: 'Lehenga Skirt', isRequired: true, sortOrder: 1 },
      { name: 'Choli', isRequired: true, sortOrder: 2 },
      { name: 'Dupatta', isRequired: false, sortOrder: 3 },
    ],
  },
  // Kids Girls - Salwar Sets
  {
    categoryCode: 'KW-GRL-SLS',
    components: [
      { name: 'Kameez', isRequired: true, sortOrder: 1 },
      { name: 'Salwar', isRequired: true, sortOrder: 2 },
      { name: 'Dupatta', isRequired: false, sortOrder: 3 },
    ],
  },
  // Sleepwear - Pajama Sets
  {
    categoryCode: 'SW-PJS',
    components: [
      { name: 'Top', isRequired: true, sortOrder: 1 },
      { name: 'Bottom', isRequired: true, sortOrder: 2 },
    ],
  },
  // Sleepwear - Nightgowns
  {
    categoryCode: 'SW-NGW',
    components: [
      { name: 'Nightgown', isRequired: true, sortOrder: 1 },
    ],
  },
  // Sleepwear - Loungewear
  {
    categoryCode: 'SW-LNW',
    components: [
      { name: 'Top', isRequired: true, sortOrder: 1 },
      { name: 'Bottom', isRequired: true, sortOrder: 2 },
    ],
  },
  // Activewear - Sports T-Shirts
  {
    categoryCode: 'AW-STS',
    components: [
      { name: 'T-Shirt', isRequired: true, sortOrder: 1 },
    ],
  },
  // Activewear - Track Pants
  {
    categoryCode: 'AW-TKP',
    components: [
      { name: 'Track Pant', isRequired: true, sortOrder: 1 },
    ],
  },
  // Activewear - Yoga Wear
  {
    categoryCode: 'AW-YGW',
    components: [
      { name: 'Top', isRequired: true, sortOrder: 1 },
      { name: 'Leggings', isRequired: true, sortOrder: 2 },
    ],
  },
  // Activewear - Gym Wear
  {
    categoryCode: 'AW-GYM',
    components: [
      { name: 'Top', isRequired: true, sortOrder: 1 },
      { name: 'Shorts', isRequired: false, sortOrder: 2 },
    ],
  },
];

async function seed() {
  try {
    console.log('Starting category component defaults seed...\n');

    // Get admin user for creating new component masters
    const adminUser = await prisma.users.findFirst({
      where: { role: 'ADMIN' },
    });

    if (!adminUser) {
      throw new Error('Admin user not found. Please run authentication setup first.');
    }

    console.log(`Found admin user: ${adminUser.email}\n`);

    // Step 1: Get all product categories by code
    console.log('Step 1: Fetching product categories...');
    const categories = await prisma.product_category_master.findMany({
      select: { id: true, code: true, name: true },
    });

    const categoryMap = new Map(categories.map(c => [c.code, c]));
    console.log(`   Found ${categories.length} product categories\n`);

    // Step 2: Get all component masters
    console.log('Step 2: Fetching component masters...');
    const componentMasters = await prisma.component_masters.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    const componentMap = new Map(componentMasters.map(c => [c.name.toLowerCase(), c]));
    console.log(`   Found ${componentMasters.length} active component masters\n`);

    // Step 3: Delete existing defaults
    console.log('Step 3: Clearing existing category component defaults...');
    const deleted = await prisma.category_component_defaults.deleteMany({});
    console.log(`   Deleted ${deleted.count} existing records\n`);

    // Step 4: Create new defaults
    console.log('Step 4: Creating category component defaults...\n');

    let createdCount = 0;
    let skippedCategories: string[] = [];
    let skippedComponents: string[] = [];

    for (const mapping of categoryComponentMappings) {
      const category = categoryMap.get(mapping.categoryCode);

      if (!category) {
        skippedCategories.push(mapping.categoryCode);
        continue;
      }

      console.log(`   ${category.name} (${mapping.categoryCode}):`);

      for (const comp of mapping.components) {
        // Try to find the component by name (case-insensitive)
        const componentMaster = componentMap.get(comp.name.toLowerCase());

        if (!componentMaster) {
          // Component not found - we'll create it
          console.log(`      - ${comp.name}: Creating new component master...`);

          const newComponent = await prisma.component_masters.create({
            data: {
              name: comp.name,
              description: `${comp.name} garment component`,
              isActive: true,
              sortOrder: createdCount,
              createdById: adminUser.id,
            },
          });

          // Add to map for future lookups
          componentMap.set(comp.name.toLowerCase(), newComponent);

          // Create the default mapping
          await prisma.category_component_defaults.create({
            data: {
              productCategoryId: category.id,
              componentMasterId: newComponent.id,
              isRequired: comp.isRequired,
              sortOrder: comp.sortOrder,
            },
          });

          console.log(`         Created component and mapping`);
        } else {
          // Create the default mapping with existing component
          await prisma.category_component_defaults.create({
            data: {
              productCategoryId: category.id,
              componentMasterId: componentMaster.id,
              isRequired: comp.isRequired,
              sortOrder: comp.sortOrder,
            },
          });
          console.log(`      - ${comp.name} (${comp.isRequired ? 'required' : 'optional'})`);
        }

        createdCount++;
      }
      console.log('');
    }

    // Summary
    console.log('\n============================================================');
    console.log('Category Component Defaults Seed Complete!');
    console.log('============================================================\n');

    const finalCount = await prisma.category_component_defaults.count();
    const componentCount = await prisma.component_masters.count({ where: { isActive: true } });

    console.log('Summary:');
    console.log(`   - Total mappings created: ${finalCount}`);
    console.log(`   - Categories processed: ${categoryComponentMappings.length - skippedCategories.length}`);
    console.log(`   - Active component masters: ${componentCount}`);

    if (skippedCategories.length > 0) {
      console.log(`\n   Skipped categories (not found):`);
      skippedCategories.forEach(code => console.log(`      - ${code}`));
    }

    console.log('\nUsage:');
    console.log('   - Go to Product Category Master page');
    console.log('   - Click the purple "Components" icon on any category');
    console.log('   - View/modify default components for that category');
    console.log('   - When creating a Style, components will auto-populate based on category\n');

  } catch (error) {
    console.error('Error seeding category component defaults:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed();
