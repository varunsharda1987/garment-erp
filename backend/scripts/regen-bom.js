const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Find admin user email
  const admin = await p.users.findFirst({ where: { role: 'ADMIN' }, select: { email: true, id: true } });
  console.log('Admin user:', admin?.email);

  // Just directly delete old BOM items and recreate via the service
  // First, let's delete the old BOM
  const bomId = 'c98d9f02-cdb1-454a-91d1-23758e0ce504';

  // Delete BOM items first, then BOM
  await p.order_bom_items.deleteMany({ where: { orderBomId: bomId } });
  await p.order_bom.delete({ where: { id: bomId } });
  console.log('Old BOM deleted');

  await p.$disconnect();
  console.log('Done. Now regenerate BOM from the UI (Order Detail page > Generate BOM)');
}

main().catch(e => { console.error(e); process.exit(1); });
