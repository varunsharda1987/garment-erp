const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const bom = await p.order_bom.findUnique({
    where: { id: 'c98d9f02-cdb1-454a-91d1-23758e0ce504' },
    select: { id: true, orderId: true, sourceCostSheetId: true, order: { select: { orderNumber: true } } },
  });
  console.log('BOM:', JSON.stringify(bom, null, 2));
  await p.$disconnect();
})();
