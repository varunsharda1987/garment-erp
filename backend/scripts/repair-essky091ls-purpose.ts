/**
 * One-off repair: ESSKY091LS cost sheet v2 / v3 read COSTING with no closed cost (2026-09-28).
 *
 * v1 (CS-1787573178242-lntimvq) is RAW_MATERIAL_CALCULATION, closed cost ₹290. The 25-Aug drift repair
 * made v2 through create-version, which until 23-Sep (4eb1314f) left purpose and closed cost out of the
 * clone: v2 became COSTING with no closed cost. The 28-Sep CAD correction versioned v2 faithfully, so
 * v3 (pending) inherited both. Order BOMs, greige send-out and the PO pre-fill read only Raw Material
 * sheets, so the style could not move on. The edit screen refuses a mode change by design — hence this.
 *
 * Also relabels the correction's recorded impact, which the cost sheet banner matches by purpose.
 *
 *   npx ts-node scripts/repair-essky091ls-purpose.ts            (dry run)
 *   npx ts-node scripts/repair-essky091ls-purpose.ts --apply    (writes; snapshot saved next to this file)
 */

import fs from 'fs';
import path from 'path';
import type { Prisma } from '@prisma/client';
import prisma from '../src/config/database';

const APPLY = process.argv.includes('--apply');

const V1 = 'CS-1787573178242-lntimvq';
const TARGETS = ['CS-1787665155067-lrf8yvx', 'CS-1790600239121-p8042h3']; // v2 (approved), v3 (pending)

const SHEET_SELECT = {
  id: true,
  styleId: true,
  version: true,
  purpose: true,
  approvalStatus: true,
  supersededById: true,
  closedCost: true,
  closedCostCurrency: true,
  closedCostNotes: true,
} satisfies Prisma.style_costingSelect;

async function main() {
  const v1 = await prisma.style_costing.findUniqueOrThrow({ where: { id: V1 }, select: SHEET_SELECT });
  const targets = await prisma.style_costing.findMany({ where: { id: { in: TARGETS } }, select: SHEET_SELECT });
  if (targets.length !== TARGETS.length) throw new Error(`Expected ${TARGETS.length} sheets, found ${targets.length}`);

  if (v1.purpose !== 'RAW_MATERIAL_CALCULATION') throw new Error(`v1 is ${v1.purpose}, expected RAW_MATERIAL_CALCULATION`);
  const toFix = targets.filter((t) => t.purpose !== v1.purpose || (t.closedCost === null && v1.closedCost !== null));
  if (toFix.length === 0) {
    console.log('Nothing to repair — v2 and v3 already read Raw Material with the closed cost.');
    return;
  }
  for (const t of toFix) {
    const clash = await prisma.style_costing.findFirst({
      where: { styleId: t.styleId, purpose: v1.purpose, version: t.version, id: { not: t.id } },
      select: { id: true },
    });
    if (clash) throw new Error(`${v1.purpose} v${t.version} already exists (${clash.id}) — cannot relabel ${t.id}`);
  }

  const corrections = await prisma.cad_corrections.findMany({
    where: { newCostSheetIds: { hasSome: TARGETS } },
    select: { id: true, status: true, impact: true },
  });

  console.log(`v1 ${V1}: ${v1.purpose}, closed cost ${v1.closedCost} ${v1.closedCostCurrency ?? ''}`);
  for (const t of toFix) {
    console.log(
      `  v${t.version} ${t.id} (${t.approvalStatus}): ${t.purpose} → ${v1.purpose}; closed cost ${t.closedCost} → ${
        t.closedCost ?? v1.closedCost
      }`
    );
  }
  for (const c of corrections) console.log(`  correction ${c.id} (${c.status}): impact purpose relabelled`);

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to write.');
    return;
  }

  const snapshotPath = path.join(__dirname, 'repair-essky091ls-purpose-snapshot.json');
  fs.writeFileSync(
    snapshotPath,
    JSON.stringify({ takenAt: new Date().toISOString(), v1, targets, corrections }, null, 2)
  );

  await prisma.$transaction(async (tx) => {
    for (const t of toFix) {
      await tx.style_costing.update({
        where: { id: t.id },
        data: {
          purpose: v1.purpose,
          ...(t.closedCost === null
            ? {
                closedCost: v1.closedCost,
                closedCostCurrency: v1.closedCostCurrency,
                closedCostNotes: v1.closedCostNotes,
              }
            : {}),
        },
      });
    }
    for (const c of corrections) {
      const impact = (c.impact ?? {}) as { costSheets?: Array<{ costSheetId: string; purpose: string }> };
      const costSheets = (impact.costSheets ?? []).map((s) =>
        TARGETS.includes(s.costSheetId) || s.costSheetId === V1 ? { ...s, purpose: v1.purpose } : s
      );
      await tx.cad_corrections.update({
        where: { id: c.id },
        data: { impact: { ...impact, costSheets } as unknown as Prisma.InputJsonValue },
      });
    }
  });

  const after = await prisma.style_costing.findMany({
    where: { id: { in: [V1, ...TARGETS] } },
    orderBy: { version: 'asc' },
    select: SHEET_SELECT,
  });
  for (const s of after) {
    console.log(`  after: v${s.version} ${s.purpose} ${s.approvalStatus} closed ${s.closedCost}`);
  }
  console.log(`\nApplied. Snapshot: ${snapshotPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
