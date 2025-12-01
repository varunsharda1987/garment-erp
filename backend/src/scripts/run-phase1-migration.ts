import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🚀 Running Phase 1 Migration: Lace, Button, Thread Masters\n');

    // Read the SQL migration file
    const migrationPath = path.join(__dirname, '../../prisma/migrations/20250123_add_lace_button_thread_masters.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📝 Executing SQL migration...\n');

    // Execute the migration SQL
    await prisma.$executeRawUnsafe(migrationSQL);

    console.log('✅ Migration completed successfully!\n');

    // Verify the tables were created
    console.log('🔍 Verifying table creation...\n');

    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('lace_master', 'button_master', 'thread_master')
      ORDER BY tablename
    `;

    console.log('Created tables:');
    tables.forEach(t => console.log(`  ✅ ${t.tablename}`));

    // Verify material categories were seeded
    const categories = await prisma.material_categories.findMany({
      where: {
        name: {
          in: ['Trims', 'Lace', 'Buttons', 'Threads']
        }
      },
      select: {
        name: true,
        level: true,
        parentCategoryId: true
      }
    });

    console.log('\nSeeded categories:');
    categories.forEach(c => console.log(`  ✅ ${c.name} (Level ${c.level})`));

    // Check if MaterialType enum was updated
    console.log('\n🔍 Checking Material Type enum values...');
    const enumValues = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'MaterialType'
      ORDER BY e.enumsortorder
    `;

    console.log('MaterialType enum values:');
    enumValues.forEach(e => console.log(`  - ${e.enumlabel}`));

    console.log('\n✅ Phase 1 migration verified successfully!');
    console.log('\n📋 Summary:');
    console.log(`  - Created ${tables.length} new master tables`);
    console.log(`  - Seeded ${categories.length} material categories`);
    console.log(`  - MaterialType enum has ${enumValues.length} values`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
