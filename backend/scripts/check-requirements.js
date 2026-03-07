const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const orderId = '6148db84-0353-4757-b7e2-bd7677831116';

  // Check material requirements for this order
  const reqs = await p.material_requirements.findMany({
    where: { orderId },
    select: {
      id: true,
      requirementType: true,
      requirementNumber: true,
      status: true,
      totalRequired: true,
      processorId: true,
      processingCost: true,
      linkedRequirementId: true,
      materials: { select: { name: true, code: true } },
    },
  });
  console.log('Material requirements:', reqs.length);
  for (const r of reqs) {
    console.log(`  - [${r.requirementType}] ${r.materials?.name || 'N/A'} (${r.materials?.code || 'N/A'}) | status=${r.status} | qty=${Number(r.totalRequired)} | processorId=${r.processorId || 'none'} | linkedReqId=${r.linkedRequirementId || 'none'}`);
  }

  const processingReqs = reqs.filter(r => r.requirementType === 'PROCESSING');
  console.log('\nProcessing requirements:', processingReqs.length);

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
