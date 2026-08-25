/**
 * Cost-sheet source-drift sweep (ESSKY091LS incident, 2026-08-25).
 *
 * style_costing_fabric_items freeze a rate snapshot from fabric_width_cad
 * (fabricCADId). If the source costing is later unapproved + re-priced, the
 * sheet silently no longer matches its source. This sweep finds every such
 * drift so the team can re-version sheets (or revert costings) deliberately.
 *
 *   npx ts-node scripts/check-costsheet-drift.ts                       (active sheets)
 *   npx ts-node scripts/check-costsheet-drift.ts --include-superseded  (+ historical)
 *
 * Report-only by design — NO --fix. These are money documents; repairs go
 * through cost-sheet versioning / the fabric-costing approve flow, not a script.
 *
 * DRIFT (exit 1):
 *   D1  price/consumption drift on active APPROVED sheets  (the ESSKY091LS class)
 *   D3  snapshot's source costing is no longer price-approved (SOURCE_UNAPPROVED)
 *   D4  snapshot's source costing was cleared entirely (SOURCE_UNCOSTED)
 *   B1  active order BOM whose source cost sheet is not APPROVED — the order's
 *       frozen prices no longer trace to an approved sheet (should be impossible
 *       once the cost-sheet order-consumption guard is live; catches legacy rows)
 * WARN (exit 0):
 *   D2  price/consumption drift on active PENDING/REJECTED sheets
 * INFO:
 *   I1  manual-override items (intentional divergence — overrideReason shown)
 *   I2  fabric items with no fabricCADId (legacy/untracked — not comparable)
 *   I3  active order BOMs with no source cost sheet link (legacy/deleted sheet)
 */

import prisma from '../src/config/database';
import {
  computeCostSheetSourceDrift,
  type SnapshotDriftFlag,
} from '../src/services/helpers/cad-costing-provenance.helper';

const INCLUDE_SUPERSEDED = process.argv.includes('--include-superseded');

const inr = (n: number) => `₹${n.toFixed(2)}`;

async function main() {
  const sheets = await prisma.style_costing.findMany({
    where: {
      ...(INCLUDE_SUPERSEDED ? {} : { supersededById: null }),
      fabricItems: { some: { fabricCADId: { not: null } } },
    },
    select: {
      id: true,
      version: true,
      approvalStatus: true,
      purpose: true,
      supersededById: true,
      styles: { select: { styleCode: true, styleName: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(
    `Sweeping ${sheets.length} cost sheet(s) with CAD-tracked fabric items` +
      `${INCLUDE_SUPERSEDED ? ' (superseded included)' : ''}...\n`
  );

  let d1 = 0;
  let d2 = 0;
  let d3 = 0;
  let d4 = 0;
  let untrackedTotal = 0;
  let grandImpactPerPiece = 0;

  for (const sheet of sheets) {
    const drift = await computeCostSheetSourceDrift(sheet.id);
    untrackedTotal += drift.untrackedItems;
    if (!drift.hasDrift) continue;

    const isApproved = String(sheet.approvalStatus) === 'APPROVED';
    const isSuperseded = sheet.supersededById !== null;
    const label = isSuperseded ? 'SUPERSEDED' : String(sheet.approvalStatus);
    const style = sheet.styles?.styleCode ?? '?';

    console.log(`${style}  ${sheet.id} (v${sheet.version}, ${String(sheet.purpose)}, ${label})`);

    for (const item of drift.items) {
      const flags = item.flags.join('+');
      const cadRef = `${item.current.componentName ?? '-'}/${item.current.cutableWidth ?? '?'}"`;
      console.log(`   ${item.fabricName} [${cadRef}]  flags: ${flags}`);
      if (item.flags.includes('PRICE_CHANGED')) {
        console.log(
          `      rate ${item.snapshot.costPerMeter} -> ${item.current.totalCostPerMeter}` +
            `  (greige ${item.snapshot.greigeCost} -> ${item.current.greigeCostPerMeter},` +
            ` processing ${item.snapshot.processingCost} -> ${item.current.processingPricePerMeter})` +
            (item.estimatedImpactPerPiece !== null
              ? `  impact ${inr(item.estimatedImpactPerPiece)}/pc`
              : '')
        );
      }
      if (item.flags.includes('CONSUMPTION_CHANGED')) {
        console.log(`      average ${item.snapshot.cadMeters} -> ${item.current.cadAverage} m/pc`);
      }
      if (item.flags.includes('SOURCE_UNAPPROVED') || item.flags.includes('SOURCE_UNCOSTED')) {
        console.log(
          `      source costing now: status=${item.current.costingApprovalStatusCurrent ?? 'null'},` +
            ` cost=${item.current.totalCostPerMeter ?? 'null'} (CAD updated ${item.current.cadUpdatedAt.toISOString()})`
        );
      }

      const has = (f: SnapshotDriftFlag) => item.flags.includes(f);
      // A superseded sheet never raises errors — it is history by definition.
      if (!isSuperseded) {
        if (has('SOURCE_UNAPPROVED')) d3 += 1;
        if (has('SOURCE_UNCOSTED')) d4 += 1;
        if (has('PRICE_CHANGED') || has('CONSUMPTION_CHANGED')) {
          if (isApproved) {
            d1 += 1;
            grandImpactPerPiece += item.estimatedImpactPerPiece ?? 0;
          } else {
            d2 += 1;
          }
        }
      }
    }
    console.log('');
  }

  // B1: active order BOM whose source sheet lost its approval (broken lineage)
  const b1 = await prisma.order_bom.findMany({
    where: { isActive: true, sourceCostSheet: { approvalStatus: { not: 'APPROVED' } } },
    select: {
      version: true,
      status: true,
      order: { select: { orderNumber: true } },
      style: { select: { styleCode: true } },
      sourceCostSheet: { select: { id: true, approvalStatus: true } },
    },
  });
  for (const bom of b1) {
    console.log(
      `B1  ${bom.style.styleCode}  ${bom.order.orderNumber}  BOM v${bom.version} (${String(bom.status)})` +
        `  <- sheet ${bom.sourceCostSheet!.id} is ${String(bom.sourceCostSheet!.approvalStatus)}`
    );
  }
  // I3: active BOMs with no sheet link at all (legacy rows / deleted sheets)
  const i3 = await prisma.order_bom.count({ where: { isActive: true, sourceCostSheetId: null } });

  // I1: intentional manual overrides on active sheets (visibility only)
  const i1 = await prisma.style_costing_fabric_items.findMany({
    where: {
      isManualOverride: true,
      fabricCADId: { not: null },
      costing: { supersededById: null },
    },
    select: {
      id: true,
      fabricName: true,
      overrideReason: true,
      costing: { select: { id: true, styles: { select: { styleCode: true } } } },
    },
  });

  console.log('--- Summary ---');
  console.log(`D1 drift on active APPROVED sheets:            ${d1}  (net impact ${inr(grandImpactPerPiece)}/pc across items)`);
  console.log(`D2 drift on active PENDING/REJECTED sheets:    ${d2}`);
  console.log(`D3 source costing unapproved under a snapshot: ${d3}`);
  console.log(`D4 source costing cleared under a snapshot:    ${d4}`);
  console.log(`I1 manual-override items (intentional):        ${i1.length}`);
  for (const item of i1) {
    console.log(
      `   ${item.costing.styles?.styleCode ?? '?'}  ${item.costing.id}  ${item.fabricName}` +
        `  reason: ${item.overrideReason ?? '-'}`
    );
  }
  console.log(`I2 untracked fabric items (no fabricCADId):    ${untrackedTotal}`);
  console.log(`B1 active BOMs on a non-APPROVED sheet:        ${b1.length}`);
  console.log(`I3 active BOMs with no sheet link (info):      ${i3}`);

  const failing = d1 + d3 + d4 + b1.length;
  console.log(
    failing > 0
      ? `\n${failing} drift finding(s) need attention — re-version the sheet from current costing, or revert the costing.`
      : '\nClean — every active sheet matches its source costings.'
  );
  process.exitCode = failing > 0 ? 1 : 0;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
