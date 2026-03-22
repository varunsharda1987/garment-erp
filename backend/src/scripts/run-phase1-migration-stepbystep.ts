import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🚀 Running Phase 1 Migration: Lace, Button, Thread Masters\n');

    // Step 1: Add LACE to MaterialType enum (if not exists)
    console.log('Step 1: Adding LACE to MaterialType enum...');
    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE "MaterialType" ADD VALUE IF NOT EXISTS 'LACE'`);
      console.log('  ✅ LACE added to MaterialType');
    } catch (e: unknown) {
      if (e instanceof Error && e.message?.includes('already exists')) {
        console.log('  ℹ️  LACE already exists in MaterialType');
      } else {
        throw e;
      }
    }

    // Step 2: Add BUTTON to MaterialType enum (if not exists)
    console.log('Step 2: Adding BUTTON to MaterialType enum...');
    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE "MaterialType" ADD VALUE IF NOT EXISTS 'BUTTON'`);
      console.log('  ✅ BUTTON added to MaterialType');
    } catch (e: unknown) {
      if (e instanceof Error && e.message?.includes('already exists')) {
        console.log('  ℹ️  BUTTON already exists in MaterialType');
      } else {
        throw e;
      }
    }

    // Step 3: Create lace_master table
    console.log('\nStep 3: Creating lace_master table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "lace_master" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "laceCode" TEXT NOT NULL UNIQUE,
        "laceName" TEXT NOT NULL,
        "supplierCode" TEXT,
        "buyerCode" TEXT,
        "width" DECIMAL(10,2),
        "design" TEXT,
        "color" TEXT,
        "composition" TEXT,
        "pricePerMeter" DECIMAL(10,2),
        "image" TEXT,
        "supplierId" TEXT,
        "description" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdById" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ lace_master table created');

    // Step 4: Create button_master table
    console.log('\nStep 4: Creating button_master table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "button_master" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "buttonCode" TEXT NOT NULL UNIQUE,
        "buttonName" TEXT NOT NULL,
        "supplierCode" TEXT,
        "buyerCode" TEXT,
        "size" TEXT,
        "holes" INTEGER,
        "color" TEXT,
        "material" TEXT,
        "shape" TEXT,
        "pricePerPiece" DECIMAL(10,2),
        "pricePerGross" DECIMAL(10,2),
        "image" TEXT,
        "supplierId" TEXT,
        "description" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdById" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ button_master table created');

    // Step 5: Create thread_master table
    console.log('\nStep 5: Creating thread_master table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "thread_master" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "threadCode" TEXT NOT NULL UNIQUE,
        "threadName" TEXT NOT NULL,
        "supplierCode" TEXT,
        "buyerCode" TEXT,
        "threadCount" TEXT,
        "color" TEXT,
        "colorCode" TEXT,
        "composition" TEXT,
        "threadType" TEXT,
        "coneSize" TEXT,
        "pricePerCone" DECIMAL(10,2),
        "image" TEXT,
        "supplierId" TEXT,
        "description" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdById" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ thread_master table created');

    // Step 6: Add columns to materials table
    console.log('\nStep 6: Adding foreign key columns to materials table...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "laceId" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "buttonId" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "threadId" TEXT`);
    console.log('  ✅ Columns added to materials table');

    // Step 7: Add buyerStyleCode to styles table
    console.log('\nStep 7: Adding buyerStyleCode to styles table...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "styles" ADD COLUMN IF NOT EXISTS "buyerStyleCode" TEXT`);
    console.log('  ✅ buyerStyleCode added to styles table');

    // Step 8: Create indexes
    console.log('\nStep 8: Creating indexes...');
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "lace_master_laceCode_idx" ON "lace_master"("laceCode")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "button_master_buttonCode_idx" ON "button_master"("buttonCode")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "thread_master_threadCode_idx" ON "thread_master"("threadCode")`
    );
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "materials_laceId_idx" ON "materials"("laceId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "materials_buttonId_idx" ON "materials"("buttonId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "materials_threadId_idx" ON "materials"("threadId")`);
    console.log('  ✅ Indexes created');

    // Step 9: Seed material categories
    console.log('\nStep 9: Seeding material categories...');

    // Check if Trims category exists
    let trimsCategory = await prisma.material_categories.findFirst({
      where: { name: 'Trims' },
    });

    if (!trimsCategory) {
      trimsCategory = await prisma.material_categories.create({
        data: {
          id: 'cat-trims',
          name: 'Trims',
          description: 'Trims and accessories',
          level: 1,
          sortOrder: 1,
          isActive: true,
        },
      });
      console.log('  ✅ Created Trims category');
    } else {
      console.log('  ℹ️  Trims category already exists');
    }

    // Create Lace subcategory
    const laceExists = await prisma.material_categories.findFirst({ where: { name: 'Lace' } });
    if (!laceExists) {
      await prisma.material_categories.create({
        data: {
          id: 'cat-lace',
          name: 'Lace',
          description: 'Lace materials',
          parentCategoryId: trimsCategory.id,
          level: 2,
          sortOrder: 1,
          isActive: true,
        },
      });
      console.log('  ✅ Created Lace category');
    } else {
      console.log('  ℹ️  Lace category already exists');
    }

    // Create Buttons subcategory
    const buttonsExists = await prisma.material_categories.findFirst({ where: { name: 'Buttons' } });
    if (!buttonsExists) {
      await prisma.material_categories.create({
        data: {
          id: 'cat-buttons',
          name: 'Buttons',
          description: 'Button materials',
          parentCategoryId: trimsCategory.id,
          level: 2,
          sortOrder: 2,
          isActive: true,
        },
      });
      console.log('  ✅ Created Buttons category');
    } else {
      console.log('  ℹ️  Buttons category already exists');
    }

    // Create Threads subcategory
    const threadsExists = await prisma.material_categories.findFirst({ where: { name: 'Threads' } });
    if (!threadsExists) {
      await prisma.material_categories.create({
        data: {
          id: 'cat-threads',
          name: 'Threads',
          description: 'Thread materials',
          parentCategoryId: trimsCategory.id,
          level: 2,
          sortOrder: 3,
          isActive: true,
        },
      });
      console.log('  ✅ Created Threads category');
    } else {
      console.log('  ℹ️  Threads category already exists');
    }

    // Verification
    console.log('\n🔍 Verifying migration...');
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('lace_master', 'button_master', 'thread_master')
      ORDER BY tablename
    `;

    console.log('\nCreated tables:');
    tables.forEach((t) => console.log(`  ✅ ${t.tablename}`));

    const categories = await prisma.material_categories.findMany({
      where: { name: { in: ['Trims', 'Lace', 'Buttons', 'Threads'] } },
      select: { name: true, level: true },
    });

    console.log('\nMaterial categories:');
    categories.forEach((c) => console.log(`  ✅ ${c.name} (Level ${c.level})`));

    console.log('\n✅ Phase 1 migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
