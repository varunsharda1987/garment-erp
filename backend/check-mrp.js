const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const bom = await prisma.order_bom.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        select: {
          id: true, materialType: true, materialId: true,
          fabricId: true, threadId: true, labelId: true,
          packagingId: true, buttonId: true, componentName: true,
        }
      }
    }
  });
  console.log('BOM ID:', bom?.id, '| Status:', bom?.status);
  for (const item of bom?.items || []) {
    const ids = [
      item.fabricId && 'fabricId:' + item.fabricId,
      item.threadId && 'threadId:' + item.threadId,
      item.labelId && 'labelId:' + item.labelId,
      item.packagingId && 'packagingId:' + item.packagingId,
      item.buttonId && 'buttonId:' + item.buttonId,
    ].filter(Boolean).join(', ');
    console.log('  ', item.componentName, '| type:', item.materialType, '| materialId:', item.materialId || 'NULL', '|', ids);
  }

  console.log('\n--- Materials linkages ---');
  for (const item of bom?.items || []) {
    const checks = [
      { field: 'fabricId', val: item.fabricId },
      { field: 'threadId', val: item.threadId },
      { field: 'labelId', val: item.labelId },
      { field: 'packagingId', val: item.packagingId },
      { field: 'buttonId', val: item.buttonId },
    ];
    for (const c of checks) {
      if (c.val) {
        const mat = await prisma.materials.findFirst({ where: { [c.field]: c.val }, select: { id: true, code: true } });
        console.log('  ', c.field, c.val, '->', mat ? mat.code : 'NO MATCH');
      }
    }
  }

  await prisma.$disconnect();
}

check().catch(e => { console.error(e.message); process.exit(1); });
