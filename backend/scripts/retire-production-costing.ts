/**
 * Retire PRODUCTION costing data (2026-09-25).
 *
 * PRODUCTION is now a CAD-only purpose: a Production CAD is the marker for one received fabric lot,
 * made and approved in CAD Planning, and it is never costed. Fabric Costing, costing runs and cost
 * sheets offer only COSTING / RAW_MATERIAL_CALCULATION, and the API refuses PRODUCTION on every
 * costing write. This script clears what the old Production mode left behind:
 *
 *   1. Production CAD rows carrying a costing — the costing columns are cleared exactly as
 *      "Remove Costing" (deleteCostingOption) clears them, plus the isLocked the old promote flow
 *      stamped. The CAD row itself is KEPT (CLAUDE.md: clear costing, never delete the CAD row).
 *   2. Production costing runs — their CAD rows are unlinked, then the run is deleted (as deleteRun).
 *   3. Production cost sheets — deleted only when nothing references them (no order BOM, order-item
 *      costing, linked CAD row, PO generation, later version or order link) and not approved.
 *      Anything referenced is LISTED and left alone, and the script exits non-zero.
 *
 * Usage:
 *   cd backend && npx ts-node scripts/retire-production-costing.ts            # dry run (default)
 *   cd backend && npx ts-node scripts/retire-production-costing.ts --apply    # writes, in one transaction
 */
import prisma from '../src/config/database';

const APPLY = process.argv.includes('--apply');

const PRODUCTION_CAD = { OR: [{ purpose: 'PRODUCTION' }, { purposeEnum: 'PRODUCTION' as const }] };

async function main() {
  // 1. Production CAD rows that carry any costing
  const costedCads = await prisma.fabric_width_cad.findMany({
    where: {
      AND: [
        PRODUCTION_CAD,
        {
          OR: [
            { costingStyleId: { not: null } },
            { totalCostPerMeter: { not: null } },
            { costingRunId: { not: null } },
            { isLocked: true },
          ],
        },
      ],
    },
    select: {
      id: true,
      componentName: true,
      cutableWidth: true,
      approvalStatus: true, // allow-cad-approval: reported only, never changed
      costingApprovalStatus: true,
      totalCostPerMeter: true,
      isLocked: true,
      fabricStockId: true,
      styleFabric: { select: { style_components: { select: { styles: { select: { styleCode: true } } } } } },
    },
  });

  console.log(`\n${APPLY ? 'APPLY' : 'DRY RUN'} — retire PRODUCTION costing data\n`);
  console.log(`1. Production CAD rows carrying a costing: ${costedCads.length}`);
  for (const c of costedCads) {
    const style = c.styleFabric?.style_components?.styles?.styleCode ?? '?';
    console.log(
      `   ${style} ${c.componentName ?? '-'} ${c.cutableWidth}"  cost ${c.totalCostPerMeter ?? '-'}  ` +
        `CAD ${c.approvalStatus ?? '-'}  price ${c.costingApprovalStatus ?? '-'}  locked ${c.isLocked}  ` +
        `lot ${c.fabricStockId ? 'yes' : 'no'}  (${c.id})`
    );
  }

  // 2. Production costing runs
  const runs = await prisma.fabric_costing_run.findMany({
    where: { purpose: 'PRODUCTION' },
    select: { id: true, runName: true, style: { select: { styleCode: true } }, _count: { select: { fabricCads: true } } },
  });
  console.log(`\n2. Production costing runs: ${runs.length}`);
  for (const r of runs) console.log(`   ${r.style.styleCode} ${r.runName} — ${r._count.fabricCads} CAD row(s)  (${r.id})`);

  // 3. Production cost sheets
  const sheets = await prisma.style_costing.findMany({
    where: { purpose: 'PRODUCTION' },
    select: {
      id: true,
      version: true,
      approvalStatus: true,
      isApproved: true,
      lockedForOrders: true,
      orderId: true,
      orderItemId: true,
      styles: { select: { styleCode: true } },
      _count: {
        select: {
          orderBoms: true,
          order_item_costings: true,
          cadCostingRecords: true,
          costSheetPoGenerations: true,
          olderVersions: true,
          copiedToCosting: true,
        },
      },
    },
  });
  const deletable = sheets.filter(
    (s) =>
      s.approvalStatus !== 'APPROVED' &&
      !s.isApproved &&
      !s.lockedForOrders &&
      !s.orderId &&
      !s.orderItemId &&
      Object.values(s._count).every((n) => n === 0)
  );
  const blocked = sheets.filter((s) => !deletable.includes(s));
  console.log(`\n3. Production cost sheets: ${sheets.length}`);
  for (const s of sheets) {
    const links = Object.entries(s._count)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${k}=${n}`);
    if (s.orderId) links.push('orderId');
    if (s.orderItemId) links.push('orderItemId');
    console.log(
      `   ${s.styles.styleCode} v${s.version} ${s.approvalStatus}  ` +
        `${deletable.includes(s) ? 'unreferenced → delete' : `KEPT — ${links.join(', ') || 'approved/locked'}`}  (${s.id})`
    );
  }

  if (!APPLY) {
    console.log(
      `\nDry run — nothing written. Would clear ${costedCads.length} CAD costing(s), delete ${runs.length} run(s) ` +
        `and ${deletable.length} cost sheet(s). Re-run with --apply.`
    );
    if (blocked.length) process.exitCode = 1;
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (costedCads.length) {
      await tx.fabric_width_cad.updateMany({
        where: { id: { in: costedCads.map((c) => c.id) } },
        data: {
          // Same set deleteCostingOption clears (fabric-costing.controller.ts)
          costingStyleId: null,
          totalCostPerMeter: null,
          transportCostPerMeter: null,
          processingPricePerMeter: null,
          shrinkagePercent: null,
          shrinkageCostPerMeter: null,
          screenCostPerMeter: null,
          screenType: null,
          numberOfColors: null,
          processorId: null,
          rateCardId: null,
          orderQuantityPcs: null,
          costedAtQuantityMeters: null,
          costedRateIsBatch: false,
          processingBatchGroupColorId: null,
          costingRunId: null,
          costingApprovalStatus: null,
          costingApprovedBy: null,
          costingApprovedAt: null,
          isPreferred: false,
          // Stamped by the retired promote-to-PRODUCTION flow; clearing it lets CAD Planning edit
          // or delete the row like any other.
          isLocked: false,
          // NOT touched: approvalStatus/approvedBy/approvedAt — the CAD-geometry approval survives.
        },
      });
    }
    for (const r of runs) {
      await tx.fabric_width_cad.updateMany({ where: { costingRunId: r.id }, data: { costingRunId: null } });
      await tx.fabric_costing_run.delete({ where: { id: r.id } });
    }
    if (deletable.length) {
      // Line-item tables cascade from style_costing
      await tx.style_costing.deleteMany({ where: { id: { in: deletable.map((s) => s.id) } } });
    }
  });

  const [cadsLeft, runsLeft, sheetsLeft] = await Promise.all([
    prisma.fabric_width_cad.count({
      where: { AND: [PRODUCTION_CAD, { OR: [{ costingStyleId: { not: null } }, { totalCostPerMeter: { not: null } }] }] },
    }),
    prisma.fabric_costing_run.count({ where: { purpose: 'PRODUCTION' } }),
    prisma.style_costing.count({ where: { purpose: 'PRODUCTION' } }),
  ]);
  console.log(
    `\nApplied. Remaining: ${cadsLeft} costed Production CAD row(s), ${runsLeft} Production run(s), ` +
      `${sheetsLeft} Production cost sheet(s).`
  );
  if (blocked.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
