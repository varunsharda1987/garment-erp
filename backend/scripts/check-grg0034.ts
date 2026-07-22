import prisma from '../src/config/database';

async function checkGreige() {
  const greige = await prisma.greige_master.findFirst({
    where: { greigeCode: 'GRG-0034' },
    select: { id: true, greigeCode: true, greigeName: true, isActive: true }
  });

  if (!greige) {
    console.log('Greige GRG-0034 not found in greige_master!');
    await prisma.$disconnect();
    return;
  }

  console.log('Greige found:', greige);

  const material = await prisma.materials.findFirst({
    where: { greigeId: greige.id },
    select: { id: true, code: true, name: true, materialType: true }
  });

  if (material) {
    console.log('Materials record EXISTS:', material);
  } else {
    console.log('NO materials record for this greige!');
  }

  await prisma.$disconnect();
}

checkGreige().catch(console.error);
