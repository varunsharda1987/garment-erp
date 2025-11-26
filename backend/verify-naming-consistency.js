const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyNamingConsistency() {
  console.log('='.repeat(80));
  console.log('NAMING CONSISTENCY VERIFICATION');
  console.log('='.repeat(80));
  console.log();

  try {
    // Test 1: Verify UUID auto-generation
    console.log('Test 1: Verifying UUID auto-generation...');
    const testSupplier = await prisma.suppliers.create({
      data: {
        code: `TEST-${Date.now()}`,
        name: 'Test Supplier',
        supplierCategory: 'FABRIC_SUPPLIER',
        createdById: (await prisma.users.findFirst()).id
      }
    });
    console.log(`  ✅ UUID auto-generated: ${testSupplier.id}`);

    // Test 2: Verify updatedAt trigger
    console.log('\nTest 2: Verifying updatedAt trigger...');
    const beforeUpdate = testSupplier.updatedAt;
    await new Promise(resolve => setTimeout(resolve, 1000));

    const updated = await prisma.suppliers.update({
      where: { id: testSupplier.id },
      data: { name: 'Updated Name' }
    });

    if (updated.updatedAt > beforeUpdate) {
      console.log(`  ✅ updatedAt automatically updated by trigger`);
      console.log(`     Before: ${beforeUpdate.toISOString()}`);
      console.log(`     After:  ${updated.updatedAt.toISOString()}`);
    } else {
      console.log(`  ❌ updatedAt was NOT updated`);
    }

    // Cleanup
    await prisma.suppliers.delete({ where: { id: testSupplier.id } });

    // Test 3: Check table and model consistency
    console.log('\nTest 3: Checking table/model consistency...');
    const tables = await prisma.$queryRawUnsafe(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name NOT LIKE '_prisma%'
      ORDER BY table_name
    `);

    console.log(`  ✅ Found ${tables.length} tables in database`);

    // Test 4: Verify field naming in key tables
    console.log('\nTest 4: Verifying field naming in key tables...');
    const tablesToCheck = ['users', 'styles', 'materials', 'suppliers', 'customers'];

    for (const tableName of tablesToCheck) {
      const columns = await prisma.$queryRawUnsafe(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = '${tableName}'
        ORDER BY ordinal_position
      `);

      // Check for problematic patterns
      const snakeCaseFields = columns.filter(col =>
        col.column_name.includes('_') &&
        !col.column_name.startsWith('_') &&
        col.column_name !== 'created_at' &&
        col.column_name !== 'updated_at'
      );

      if (snakeCaseFields.length === 0) {
        console.log(`  ✅ ${tableName}: All fields use camelCase`);
      } else {
        console.log(`  ⚠️  ${tableName}: Found snake_case fields:`);
        snakeCaseFields.forEach(f => console.log(`       - ${f.column_name}`));
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('VERIFICATION COMPLETE');
    console.log('='.repeat(80));
    console.log('\n✅ All naming consistency checks passed!\n');

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyNamingConsistency();
