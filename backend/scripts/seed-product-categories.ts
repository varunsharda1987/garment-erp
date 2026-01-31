/**
 * Product Category Master Seed Script
 * Creates hierarchical product categories for garment types
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const uuidv4 = randomUUID;

interface ProductCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  parentId: string | null;
  level: number;
  sortOrder: number;
  minComponents?: number;
  maxComponents?: number;
}

// Store parent IDs for reference
const parentIds: Record<string, string> = {};

// ============================================
// LEVEL 1 - Main Categories
// ============================================
const mainCategories: ProductCategory[] = [
  {
    id: uuidv4(),
    code: 'WW',
    name: 'Western Wear',
    description: 'Western style clothing and apparel',
    parentId: null,
    level: 1,
    sortOrder: 1,
    minComponents: 1,
    maxComponents: 4,
  },
  {
    id: uuidv4(),
    code: 'EW',
    name: 'Ethnic Wear',
    description: 'Traditional Indian and ethnic clothing',
    parentId: null,
    level: 1,
    sortOrder: 2,
    minComponents: 1,
    maxComponents: 4,
  },
  {
    id: uuidv4(),
    code: 'FW',
    name: 'Fusion Wear',
    description: 'Blend of western and ethnic styles',
    parentId: null,
    level: 1,
    sortOrder: 3,
    minComponents: 1,
    maxComponents: 4,
  },
  {
    id: uuidv4(),
    code: 'KW',
    name: 'Kids Wear',
    description: 'Clothing for children',
    parentId: null,
    level: 1,
    sortOrder: 4,
    minComponents: 1,
    maxComponents: 4,
  },
  {
    id: uuidv4(),
    code: 'SW',
    name: 'Sleepwear',
    description: 'Sleepwear and nightwear',
    parentId: null,
    level: 1,
    sortOrder: 5,
    minComponents: 1,
    maxComponents: 3,
  },
  {
    id: uuidv4(),
    code: 'AW',
    name: 'Activewear',
    description: 'Sports and fitness clothing',
    parentId: null,
    level: 1,
    sortOrder: 6,
    minComponents: 1,
    maxComponents: 3,
  },
];

// Store parent IDs
mainCategories.forEach(cat => {
  parentIds[cat.code] = cat.id;
});

// ============================================
// LEVEL 2 - Sub Categories
// ============================================

// Western Wear Sub-categories
const westernWearSubs: Omit<ProductCategory, 'parentId'>[] = [
  { id: uuidv4(), code: 'WW-TSH', name: 'T-Shirts', description: 'Casual T-shirts and polo shirts', level: 2, sortOrder: 1, minComponents: 1, maxComponents: 1 },
  { id: uuidv4(), code: 'WW-SHR', name: 'Shirts', description: 'Formal and casual shirts', level: 2, sortOrder: 2, minComponents: 1, maxComponents: 1 },
  { id: uuidv4(), code: 'WW-JNS', name: 'Jeans', description: 'Denim jeans and pants', level: 2, sortOrder: 3, minComponents: 1, maxComponents: 1 },
  { id: uuidv4(), code: 'WW-TRS', name: 'Trousers', description: 'Formal and casual trousers', level: 2, sortOrder: 4, minComponents: 1, maxComponents: 1 },
  { id: uuidv4(), code: 'WW-DRS', name: 'Dresses', description: 'Western dresses and gowns', level: 2, sortOrder: 5, minComponents: 1, maxComponents: 2 },
  { id: uuidv4(), code: 'WW-SKT', name: 'Skirts', description: 'Mini, midi, and maxi skirts', level: 2, sortOrder: 6, minComponents: 1, maxComponents: 1 },
  { id: uuidv4(), code: 'WW-JKT', name: 'Jackets', description: 'Jackets and blazers', level: 2, sortOrder: 7, minComponents: 1, maxComponents: 3 },
  { id: uuidv4(), code: 'WW-SHT', name: 'Shorts', description: 'Casual shorts and bermudas', level: 2, sortOrder: 8, minComponents: 1, maxComponents: 1 },
  { id: uuidv4(), code: 'WW-JMP', name: 'Jumpsuits', description: 'Jumpsuits and rompers', level: 2, sortOrder: 9, minComponents: 1, maxComponents: 1 },
];

// Ethnic Wear Sub-categories
const ethnicWearSubs: Omit<ProductCategory, 'parentId'>[] = [
  { id: uuidv4(), code: 'EW-KRS', name: 'Kurta Sets', description: 'Kurta with bottom wear sets', level: 2, sortOrder: 1, minComponents: 1, maxComponents: 4 },
  { id: uuidv4(), code: 'EW-KRT', name: 'Kurtas', description: 'Standalone kurtas', level: 2, sortOrder: 2, minComponents: 1, maxComponents: 1 },
  { id: uuidv4(), code: 'EW-SAR', name: 'Sarees', description: 'Traditional sarees', level: 2, sortOrder: 3, minComponents: 1, maxComponents: 2 },
  { id: uuidv4(), code: 'EW-LHG', name: 'Lehengas', description: 'Bridal and festive lehengas', level: 2, sortOrder: 4, minComponents: 2, maxComponents: 4 },
  { id: uuidv4(), code: 'EW-ANK', name: 'Anarkalis', description: 'Anarkali suits and gowns', level: 2, sortOrder: 5, minComponents: 1, maxComponents: 2 },
  { id: uuidv4(), code: 'EW-SLS', name: 'Salwar Suits', description: 'Salwar kameez sets', level: 2, sortOrder: 6, minComponents: 2, maxComponents: 4 },
  { id: uuidv4(), code: 'EW-SHW', name: 'Sherwanis', description: 'Mens sherwanis and achkans', level: 2, sortOrder: 7, minComponents: 1, maxComponents: 3 },
  { id: uuidv4(), code: 'EW-DHT', name: 'Dhotis', description: 'Traditional dhoti and lungi', level: 2, sortOrder: 8, minComponents: 1, maxComponents: 1 },
  { id: uuidv4(), code: 'EW-PLZ', name: 'Palazzo Sets', description: 'Kurta with palazzo sets', level: 2, sortOrder: 9, minComponents: 2, maxComponents: 4 },
];

// Fusion Wear Sub-categories
const fusionWearSubs: Omit<ProductCategory, 'parentId'>[] = [
  { id: uuidv4(), code: 'FW-IWS', name: 'Indo-Western', description: 'Indo-western dresses and gowns', level: 2, sortOrder: 1, minComponents: 1, maxComponents: 2 },
  { id: uuidv4(), code: 'FW-FKT', name: 'Fusion Kurtas', description: 'Contemporary fusion kurtas', level: 2, sortOrder: 2, minComponents: 1, maxComponents: 2 },
  { id: uuidv4(), code: 'FW-DHP', name: 'Dhoti Pants', description: 'Modern dhoti pants and palazzos', level: 2, sortOrder: 3, minComponents: 1, maxComponents: 1 },
  { id: uuidv4(), code: 'FW-CPS', name: 'Cape Sets', description: 'Cape and jacket style ethnic wear', level: 2, sortOrder: 4, minComponents: 2, maxComponents: 3 },
  { id: uuidv4(), code: 'FW-FDS', name: 'Fusion Dresses', description: 'Ethnic-western fusion dresses', level: 2, sortOrder: 5, minComponents: 1, maxComponents: 2 },
];

// Kids Wear Sub-categories (Level 2 - will have Level 3 children)
const kidsWearSubs: Omit<ProductCategory, 'parentId'>[] = [
  { id: uuidv4(), code: 'KW-BOY', name: 'Boys', description: 'Clothing for boys', level: 2, sortOrder: 1, minComponents: 1, maxComponents: 3 },
  { id: uuidv4(), code: 'KW-GRL', name: 'Girls', description: 'Clothing for girls', level: 2, sortOrder: 2, minComponents: 1, maxComponents: 3 },
];

// Store kids sub-category IDs for Level 3
kidsWearSubs.forEach(cat => {
  parentIds[cat.code] = cat.id;
});

// Sleepwear Sub-categories
const sleepwearSubs: Omit<ProductCategory, 'parentId'>[] = [
  { id: uuidv4(), code: 'SW-PJS', name: 'Pajama Sets', description: 'Night suits and pajama sets', level: 2, sortOrder: 1, minComponents: 2, maxComponents: 3 },
  { id: uuidv4(), code: 'SW-NGW', name: 'Nightgowns', description: 'Nightgowns and nighties', level: 2, sortOrder: 2, minComponents: 1, maxComponents: 1 },
  { id: uuidv4(), code: 'SW-LNW', name: 'Loungewear', description: 'Casual home wear and loungewear', level: 2, sortOrder: 3, minComponents: 1, maxComponents: 2 },
];

// Activewear Sub-categories
const activewearSubs: Omit<ProductCategory, 'parentId'>[] = [
  { id: uuidv4(), code: 'AW-STS', name: 'Sports T-Shirts', description: 'Performance sports t-shirts', level: 2, sortOrder: 1, minComponents: 1, maxComponents: 1 },
  { id: uuidv4(), code: 'AW-TKP', name: 'Track Pants', description: 'Track pants and joggers', level: 2, sortOrder: 2, minComponents: 1, maxComponents: 1 },
  { id: uuidv4(), code: 'AW-YGW', name: 'Yoga Wear', description: 'Yoga and pilates clothing', level: 2, sortOrder: 3, minComponents: 1, maxComponents: 2 },
  { id: uuidv4(), code: 'AW-GYM', name: 'Gym Wear', description: 'Gym and workout clothing', level: 2, sortOrder: 4, minComponents: 1, maxComponents: 2 },
];

// ============================================
// LEVEL 3 - Kids Wear Sub-sub Categories
// ============================================

// Boys Sub-categories
const boysSubSubs: Omit<ProductCategory, 'parentId'>[] = [
  { id: uuidv4(), code: 'KW-BOY-TSH', name: 'T-Shirts', description: 'Boys t-shirts', level: 3, sortOrder: 1, minComponents: 1, maxComponents: 1 },
  { id: uuidv4(), code: 'KW-BOY-SHR', name: 'Shirts', description: 'Boys shirts', level: 3, sortOrder: 2, minComponents: 1, maxComponents: 1 },
  { id: uuidv4(), code: 'KW-BOY-KRT', name: 'Kurtas', description: 'Boys ethnic kurtas', level: 3, sortOrder: 3, minComponents: 1, maxComponents: 2 },
  { id: uuidv4(), code: 'KW-BOY-SHT', name: 'Shorts', description: 'Boys shorts and bermudas', level: 3, sortOrder: 4, minComponents: 1, maxComponents: 1 },
];

// Girls Sub-categories
const girlsSubSubs: Omit<ProductCategory, 'parentId'>[] = [
  { id: uuidv4(), code: 'KW-GRL-DRS', name: 'Dresses', description: 'Girls dresses and frocks', level: 3, sortOrder: 1, minComponents: 1, maxComponents: 2 },
  { id: uuidv4(), code: 'KW-GRL-TOP', name: 'Tops', description: 'Girls tops and blouses', level: 3, sortOrder: 2, minComponents: 1, maxComponents: 1 },
  { id: uuidv4(), code: 'KW-GRL-LHG', name: 'Lehengas', description: 'Girls ethnic lehengas', level: 3, sortOrder: 3, minComponents: 2, maxComponents: 3 },
  { id: uuidv4(), code: 'KW-GRL-SLS', name: 'Salwar Sets', description: 'Girls salwar kameez sets', level: 3, sortOrder: 4, minComponents: 2, maxComponents: 3 },
];

async function seed() {
  try {
    console.log('Starting product category master seed...\n');

    // Step 1: Delete existing product categories
    console.log('Step 1: Deleting existing product categories...');
    const deletedCategories = await prisma.product_category_master.deleteMany({});
    console.log(`   Deleted ${deletedCategories.count} categories\n`);

    // Step 2: Insert Level 1 - Main Categories
    console.log('Step 2: Creating Level 1 - Main Categories...');
    for (const category of mainCategories) {
      await prisma.product_category_master.create({ data: category });
      console.log(`   [${category.code}] ${category.name}`);
    }
    console.log('');

    // Step 3: Insert Level 2 - Sub Categories
    console.log('Step 3: Creating Level 2 - Sub Categories...\n');

    console.log('   WESTERN WEAR:');
    for (const sub of westernWearSubs) {
      await prisma.product_category_master.create({
        data: { ...sub, parentId: parentIds['WW'] },
      });
      console.log(`   [${sub.code}] ${sub.name}`);
    }

    console.log('\n   ETHNIC WEAR:');
    for (const sub of ethnicWearSubs) {
      await prisma.product_category_master.create({
        data: { ...sub, parentId: parentIds['EW'] },
      });
      console.log(`   [${sub.code}] ${sub.name}`);
    }

    console.log('\n   FUSION WEAR:');
    for (const sub of fusionWearSubs) {
      await prisma.product_category_master.create({
        data: { ...sub, parentId: parentIds['FW'] },
      });
      console.log(`   [${sub.code}] ${sub.name}`);
    }

    console.log('\n   KIDS WEAR:');
    for (const sub of kidsWearSubs) {
      await prisma.product_category_master.create({
        data: { ...sub, parentId: parentIds['KW'] },
      });
      console.log(`   [${sub.code}] ${sub.name}`);
    }

    console.log('\n   SLEEPWEAR:');
    for (const sub of sleepwearSubs) {
      await prisma.product_category_master.create({
        data: { ...sub, parentId: parentIds['SW'] },
      });
      console.log(`   [${sub.code}] ${sub.name}`);
    }

    console.log('\n   ACTIVEWEAR:');
    for (const sub of activewearSubs) {
      await prisma.product_category_master.create({
        data: { ...sub, parentId: parentIds['AW'] },
      });
      console.log(`   [${sub.code}] ${sub.name}`);
    }

    // Step 4: Insert Level 3 - Kids Sub-sub Categories
    console.log('\n\nStep 4: Creating Level 3 - Kids Sub-sub Categories...\n');

    console.log('   BOYS:');
    for (const sub of boysSubSubs) {
      await prisma.product_category_master.create({
        data: { ...sub, parentId: parentIds['KW-BOY'] },
      });
      console.log(`   [${sub.code}] ${sub.name}`);
    }

    console.log('\n   GIRLS:');
    for (const sub of girlsSubSubs) {
      await prisma.product_category_master.create({
        data: { ...sub, parentId: parentIds['KW-GRL'] },
      });
      console.log(`   [${sub.code}] ${sub.name}`);
    }

    // Summary
    const totalCategories = await prisma.product_category_master.count();
    console.log('\n\nProduct category master seed completed successfully!');
    console.log('\nSummary:');
    console.log(`   - Level 1 (Main): ${mainCategories.length}`);
    console.log(`   - Level 2 (Sub): ${westernWearSubs.length + ethnicWearSubs.length + fusionWearSubs.length + kidsWearSubs.length + sleepwearSubs.length + activewearSubs.length}`);
    console.log(`   - Level 3 (Sub-sub): ${boysSubSubs.length + girlsSubSubs.length}`);
    console.log(`   - Total: ${totalCategories}\n`);

  } catch (error) {
    console.error('Error seeding product categories:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed();
