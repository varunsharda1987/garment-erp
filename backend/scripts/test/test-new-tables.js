const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testNewTables() {
  try {
    // Check if tables exist by querying information schema
    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('greige_master', 'fabric_master', 'fabric_width_cad')
      ORDER BY table_name
    `;

    console.log('New tables found in database:');
    console.log(JSON.stringify(tables, null, 2));

    // Test that we can access the models
    console.log('\nPrisma models available:');
    console.log('- greige_master:', typeof prisma.greige_master);
    console.log('- fabric_master:', typeof prisma.fabric_master);
    console.log('- fabric_width_cad:', typeof prisma.fabric_width_cad);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testNewTables();
