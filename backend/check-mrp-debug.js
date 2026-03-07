const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  // Get the latest active BOM
  const bom = await prisma.order_bom.findFirst({
    where: { isActive: true, status: { in: ['APPROVED', 'LOCKED'] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, orderId: true, styleId: true, status: true }
  });
  console.log('BOM:', bom);

  if (!bom) { console.log('No approved BOM found!'); return; }

  // Get order with items
  const order = await prisma.orders.findUnique({
    where: { id: bom.orderId },
    include: {
      order_items: true,
      orderBoms: {
        where: { isActive: true },
        include: {
          items: {
            select: { id: true, materialType: true, materialId: true, fabricId: true, threadId: true, labelId: true, packagingId: true, buttonId: true, componentName: true }
          }
        }
      }
    }
  });

  console.log('\nOrder:', order?.id, '| Items:', order?.order_items?.length);
  for (const oi of order?.order_items || []) {
    console.log('  OrderItem:', oi.id, '| styleId:', oi.styleId, '| qty:', oi.totalQuantity);
  }

  console.log('\nOrder BOMs:', order?.orderBoms?.length);
  for (const ob of order?.orderBoms || []) {
    console.log('  BOM:', ob.id, '| styleId:', ob.styleId, '| status:', ob.status, '| items:', ob.items?.length);

    // Check if any order_item matches this BOM's styleId
    const matchingItem = order?.order_items?.find(oi => oi.styleId === ob.styleId);
    console.log('  Matching order item?', matchingItem ? 'YES (qty: ' + matchingItem.totalQuantity + ')' : 'NO MATCH!');

    for (const item of ob.items || []) {
      const ids = [item.fabricId && 'fabricId', item.threadId && 'threadId', item.labelId && 'labelId', item.packagingId && 'packagingId', item.buttonId && 'buttonId'].filter(Boolean).join(',');
      console.log('    ', item.componentName, '| type:', item.materialType, '| materialId:', item.materialId || 'NULL', '| masterIds:', ids || 'NONE');
    }
  }

  await prisma.$disconnect();
}

check().catch(e => { console.error(e.message); process.exit(1); });
