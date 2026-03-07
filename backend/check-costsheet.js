const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const bom = await prisma.order_bom.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    select: { styleId: true, sourceCostSheetId: true }
  });
  console.log('BOM styleId:', bom?.styleId, '| sourceCostSheetId:', bom?.sourceCostSheetId);

  const costSheet = await prisma.style_costing.findFirst({
    where: { styleId: bom?.styleId },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      fabricDetails: true,
      fabricItems: {
        select: { id: true, fabricId: true, fabricName: true, sourcingStrategy: true }
      }
    }
  });

  console.log('\nCost Sheet ID:', costSheet?.id);
  console.log('Relational fabricItems:', costSheet?.fabricItems?.length || 0);
  for (const fi of costSheet?.fabricItems || []) {
    console.log('  ', fi.fabricName, '| fabricId:', fi.fabricId, '| strategy:', fi.sourcingStrategy);
  }

  const fabricDetails = costSheet?.fabricDetails;
  console.log('\nJSON fabricDetails:', Array.isArray(fabricDetails) ? fabricDetails.length : typeof fabricDetails);
  if (Array.isArray(fabricDetails)) {
    for (const fd of fabricDetails) {
      console.log('  ', fd.fabricName, '| fabricId:', fd.fabricId || 'MISSING');
    }
  }

  await prisma.$disconnect();
}

check().catch(e => { console.error(e.message); process.exit(1); });
