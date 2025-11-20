/**
 * Hierarchical Material Categories Seed Script
 * Creates a two-level category structure for garment materials
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const uuidv4 = randomUUID;

interface Category {
  id: string;
  name: string;
  description: string;
  parentCategoryId: string | null;
  level: number;
  sortOrder: number;
}

const categories: Category[] = [
  // ============================================
  // PARENT CATEGORIES (Level 1)
  // ============================================
  // Note: Fabrics category removed - use dedicated Fabric/Greige Master modules
  {
    id: uuidv4(),
    name: 'Trims & Notions',
    description: 'Functional and decorative components for garments',
    parentCategoryId: null,
    level: 1,
    sortOrder: 1,
  },
  {
    id: uuidv4(),
    name: 'Threads',
    description: 'Sewing and embroidery threads',
    parentCategoryId: null,
    level: 1,
    sortOrder: 2,
  },
  {
    id: uuidv4(),
    name: 'Packaging',
    description: 'Packaging materials for finished garments',
    parentCategoryId: null,
    level: 1,
    sortOrder: 3,
  },
];

// Helper to find parent ID by name
const getParentId = (parentName: string): string => {
  const parent = categories.find(c => c.name === parentName);
  if (!parent) throw new Error(`Parent category "${parentName}" not found`);
  return parent.id;
};

// ============================================
// CHILD CATEGORIES (Level 2)
// ============================================
// Note: Fabric categories removed - use dedicated Fabric/Greige Master modules

// TRIMS & NOTIONS Children
const trimsChildren: Omit<Category, 'parentCategoryId'>[] = [
  {
    id: uuidv4(),
    name: 'Closures',
    description: 'Buttons, zippers, snaps, hooks, and fasteners',
    level: 2,
    sortOrder: 1,
  },
  {
    id: uuidv4(),
    name: 'Labels & Tags',
    description: 'Woven labels, printed labels, care labels, and hang tags',
    level: 2,
    sortOrder: 2,
  },
  {
    id: uuidv4(),
    name: 'Elastic & Tapes',
    description: 'Elastic bands, bias tape, twill tape, and bindings',
    level: 2,
    sortOrder: 3,
  },
  {
    id: uuidv4(),
    name: 'Decorative',
    description: 'Ribbons, laces, beads, sequins, and appliques',
    level: 2,
    sortOrder: 4,
  },
  {
    id: uuidv4(),
    name: 'Hardware',
    description: 'Grommets, rivets, buckles, D-rings, and sliders',
    level: 2,
    sortOrder: 5,
  },
];

// THREADS Children
const threadChildren: Omit<Category, 'parentCategoryId'>[] = [
  {
    id: uuidv4(),
    name: 'Sewing Thread',
    description: 'Core-spun, spun polyester, and cotton sewing threads',
    level: 2,
    sortOrder: 1,
  },
  {
    id: uuidv4(),
    name: 'Embroidery Thread',
    description: 'Rayon, polyester, and metallic embroidery threads',
    level: 2,
    sortOrder: 2,
  },
  {
    id: uuidv4(),
    name: 'Specialty Thread',
    description: 'Buttonhole, overlock, and blind stitch threads',
    level: 2,
    sortOrder: 3,
  },
];

// PACKAGING Children
const packagingChildren: Omit<Category, 'parentCategoryId'>[] = [
  {
    id: uuidv4(),
    name: 'Primary Packaging',
    description: 'Poly bags, hangers, and price tags',
    level: 2,
    sortOrder: 1,
  },
  {
    id: uuidv4(),
    name: 'Secondary Packaging',
    description: 'Cartons, tissue paper, and inner boxes',
    level: 2,
    sortOrder: 2,
  },
  {
    id: uuidv4(),
    name: 'Labeling',
    description: 'Barcode stickers, size stickers, and price labels',
    level: 2,
    sortOrder: 3,
  },
];

async function seed() {
  try {
    console.log('🌱 Starting material categories hierarchical seed...\n');

    // Step 1: Delete all existing materials (fresh start)
    console.log('🗑️  Step 1: Deleting existing materials...');
    const deletedMaterials = await prisma.materials.deleteMany({});
    console.log(`   ✅ Deleted ${deletedMaterials.count} materials\n`);

    // Step 2: Delete all existing categories
    console.log('🗑️  Step 2: Deleting existing material categories...');
    const deletedCategories = await prisma.material_categories.deleteMany({});
    console.log(`   ✅ Deleted ${deletedCategories.count} categories\n`);

    // Step 3: Insert parent categories
    console.log('📁 Step 3: Creating parent categories...');
    for (const category of categories) {
      await prisma.material_categories.create({ data: category });
      console.log(`   ✅ Created: ${category.name}`);
    }
    console.log('');

    // Step 4: Insert child categories
    console.log('📂 Step 4: Creating child categories...\n');

    const trimsParentId = getParentId('Trims & Notions');
    console.log('   TRIMS & NOTIONS:');
    for (const child of trimsChildren) {
      await prisma.material_categories.create({
        data: { ...child, parentCategoryId: trimsParentId },
      });
      console.log(`   ✅ ${child.name}`);
    }

    const threadsParentId = getParentId('Threads');
    console.log('\n   THREADS:');
    for (const child of threadChildren) {
      await prisma.material_categories.create({
        data: { ...child, parentCategoryId: threadsParentId },
      });
      console.log(`   ✅ ${child.name}`);
    }

    const packagingParentId = getParentId('Packaging');
    console.log('\n   PACKAGING:');
    for (const child of packagingChildren) {
      await prisma.material_categories.create({
        data: { ...child, parentCategoryId: packagingParentId },
      });
      console.log(`   ✅ ${child.name}`);
    }

    console.log('\n✅ Material categories hierarchy seed completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Parent Categories: 3 (Fabrics removed - use Fabric/Greige Master modules)`);
    console.log(`   - Child Categories: 11`);
    console.log(`   - Total Categories: 14\n`);

  } catch (error) {
    console.error('❌ Error seeding material categories:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed();
