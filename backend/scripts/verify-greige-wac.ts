/**
 * T2-1 Stage C: verify getGreigeWAC (derived) picks the SAME greige rate as the current fabric-cost code
 * (stock_levels.findFirst: materials.greigeId+GREIGE, quantity>0, valuationRate NOT NULL, ORDER BY rate ASC).
 * Read-only.
 */
import prisma from '../src/config/database';
import { getGreigeWAC } from '../src/services/helpers/derived-stock.helper';

async function main() {
  // greigeIds that have at least one rated GREIGE material stock row (the universe that can hit STOCK_WAC)
  const rated = await prisma.stock_levels.findMany({
    where: { valuationRate: { not: null }, quantity: { gt: 0 }, materials: { materialType: 'GREIGE', greigeId: { not: null } } },
    select: { materials: { select: { greigeId: true } } },
  });
  const greigeIds = [...new Set(rated.map((r) => r.materials?.greigeId).filter(Boolean))] as string[];
  console.log('Greige masters with a rated in-stock GREIGE material:', greigeIds.length);

  let ok = 0, mismatch = 0;
  for (const gid of greigeIds) {
    // OLD pick (current fabric-cost code)
    const old = await prisma.stock_levels.findFirst({
      where: { materials: { greigeId: gid, materialType: 'GREIGE' }, quantity: { gt: 0 }, valuationRate: { not: null } },
      orderBy: { valuationRate: 'asc' },
    });
    const oldRate = old?.valuationRate?.toString() ?? null;
    // NEW pick (derived helper)
    const wac = await getGreigeWAC(gid);
    const newRate = wac?.rate?.toString() ?? null;
    const same = oldRate === newRate;
    if (same) ok++; else { mismatch++; console.log(`  MISMATCH greige=${gid} old=${oldRate} new=${newRate}`); }
  }
  console.log(`getGreigeWAC vs current pick: match=${ok} mismatch=${mismatch}`, mismatch ? '❌' : '✅');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
