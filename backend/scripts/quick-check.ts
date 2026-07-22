import prisma from '../src/config/database';

async function check() {
  const supplier = await prisma.suppliers.findFirst({
    where: { code: 'SUP90574166' },
    select: { id: true, code: true, name: true, isActive: true }
  });
  console.log('Supplier SUP90574166:', supplier);

  const material = await prisma.materials.findFirst({
    where: { greigeId: '58ac84d1-a181-407c-9287-c0791c9d5f82' },
    select: { id: true, code: true, name: true }
  });
  console.log('Material for GRG-0034:', material);

  await prisma.$disconnect();
  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
