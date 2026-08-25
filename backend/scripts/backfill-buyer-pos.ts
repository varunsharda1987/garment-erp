import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfill() {
  const orders = await prisma.sale_orders.findMany({
    where: { buyerPoNumber: { not: null } },
    select: { id: true, buyerPoNumber: true }
  });

  console.log(`Found ${orders.length} orders with buyerPoNumber`);

  let created = 0;
  for (const order of orders) {
    if (!order.buyerPoNumber) continue;

    const existing = await prisma.sale_order_buyer_pos.findUnique({
      where: { saleOrderId_buyerPoNumber: { saleOrderId: order.id, buyerPoNumber: order.buyerPoNumber } }
    });

    if (!existing) {
      await prisma.sale_order_buyer_pos.create({
        data: {
          saleOrderId: order.id,
          buyerPoNumber: order.buyerPoNumber,
          isPrimary: true
        }
      });
      created++;
    }
  }

  console.log(`Created ${created} buyer PO records`);
  await prisma.$disconnect();
}

backfill().catch((e) => {
  console.error(e);
  process.exit(1);
});
