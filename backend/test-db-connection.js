const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgres@localhost:5432/garment_erp'
    }
  }
});

async function main() {
  try {
    // Test connection
    await prisma.$connect();
    console.log('✅ Successfully connected to local database!');

    // Count tables
    const userCount = await prisma.users.count();
    console.log(`✅ Users table accessible (count: ${userCount})`);

    console.log('✅ Database is ready to use!');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
