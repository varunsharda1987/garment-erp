const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
  const orderId = '7b7f72f7-baf3-481c-b3d1-cf1238a40c4c';

  const bom = await p.order_bom.findFirst({
    where: { orderId, isActive: true },
    include: { items: true }
  });

  if (!bom) {
    console.log('No active BOM found');
    return;
  }

  console.log('BOM ID:', bom.id);
  console.log('Items:', bom.items.length);

  for (const item of bom.items) {
    console.log('---');
    console.log('Type:', item.materialType, '| materialId:', item.materialId, '| fabricId:', item.fabricId, '| Name:', item.componentName);

    if (item.fabricId && !item.materialId) {
      const mat = await p.materials.findFirst({ where: { fabricId: item.fabricId }});
      console.log('  -> Materials record by fabricId:', mat ? mat.id : 'NOT FOUND');
    }
  }
}

check().catch(console.error).finally(() => p.$disconnect());
