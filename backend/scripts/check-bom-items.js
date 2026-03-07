const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const bom = await p.order_bom.findFirst({
    where: { orderId: '6148db84-0353-4757-b7e2-bd7677831116', isActive: true },
    include: {
      items: {
        include: {
          greige: { select: { id: true, greigeCode: true, greigeName: true } },
          fabric_master: { select: { id: true, fabricCode: true, fabricName: true } },
        },
        where: { materialType: { in: ['GREIGE', 'FABRIC'] } },
      },
    },
  });

  if (!bom) {
    console.log('No active BOM found');
    return;
  }

  console.log('BOM ID:', bom.id);
  for (const item of bom.items) {
    console.log({
      materialType: item.materialType,
      componentName: item.componentName,
      fabricId: item.fabricId,
      greigeId: item.greigeId,
      unitPrice: Number(item.unitPrice),
      greige: item.greige,
      fabric_master: item.fabric_master,
    });
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
