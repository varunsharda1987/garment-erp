// Temporary script to delete all suppliers before schema migration
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Deleting all suppliers...');
  const result = await prisma.supplier.deleteMany({});
  console.log(`✅ Deleted ${result.count} suppliers`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
