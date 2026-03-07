const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfill() {
  // Find all cost sheets that have NO fabric items populated
  const costSheets = await prisma.style_costing.findMany({
    where: { fabricItems: { none: {} } },
    select: { id: true, styleId: true, fabricDetails: true },
  });

  console.log('Cost sheets missing fabric items:', costSheets.length);

  let totalCreated = 0;

  for (const cs of costSheets) {
    const cadRows = await prisma.fabric_width_cad.findMany({
      where: { costingStyleId: cs.styleId },
      include: {
        fabric: { select: { id: true, fabricName: true, greigeId: true } },
        greige: { select: { id: true, greigeName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (cadRows.length === 0) continue;

    const fabricDetails = Array.isArray(cs.fabricDetails) ? cs.fabricDetails : [];
    const seenComponents = new Set();
    const itemsToCreate = [];

    for (const cad of cadRows) {
      const key = cad.componentName || cad.styleFabricId || cad.id;
      if (seenComponents.has(key)) continue;
      seenComponents.add(key);

      const idx = itemsToCreate.length;
      const jsonFabric = fabricDetails[idx] || {};

      const cadAvg = jsonFabric.fabricAverage || 0;
      const cadRate = jsonFabric.fabricRate || 0;
      const wastage = Number(cad.cadWastagePercent) || 5;
      const effectiveCad = cadAvg * (1 + wastage / 100);

      itemsToCreate.push({
        costingId: cs.id,
        fabricCADId: cad.id,
        fabricId: cad.fabricId || null,
        greigeId: cad.greigeId || null,
        fabricName: jsonFabric.fabricName || (cad.fabric ? cad.fabric.fabricName : null) || (cad.greige ? cad.greige.greigeName : null) || 'Unknown Fabric',
        width: cad.cutableWidth || 0,
        cadMeters: cadAvg,
        cadWastagePercent: wastage,
        effectiveCad: effectiveCad,
        costPerMeter: cadRate,
        totalCost: effectiveCad * cadRate,
        sourcingStrategy: cad.processorId ? 'GREIGE_PROCESSED' : 'READY_FABRIC',
        processorId: cad.processorId || null,
        greigeCost: cad.greigeCostPerMeter || null,
        processingCost: cad.processingPricePerMeter || null,
      });
    }

    if (itemsToCreate.length > 0) {
      await prisma.style_costing_fabric_items.createMany({ data: itemsToCreate });
      totalCreated += itemsToCreate.length;
      console.log('Backfilled cost sheet', cs.id, '- created', itemsToCreate.length, 'fabric items');
      for (const item of itemsToCreate) {
        console.log('  -', item.fabricName, '| strategy:', item.sourcingStrategy, '| greigeId:', item.greigeId, '| processorId:', item.processorId);
      }
    }
  }

  console.log('\nTotal fabric items created:', totalCreated);
  await prisma.$disconnect();
}

backfill().catch(e => {
  console.error(e);
  process.exit(1);
});
