/**
 * Give back the cutting pieces a stitching issue did not take (2026-09-30).
 *
 * Until today a stitching issue marked every cutting → stitching slip it drew from RECEIVED however
 * few pieces it took, so the rest vanished: SI-WO2609-0088-001 took size S (459) from
 * TS-20260930-0001 and the other 1,680 pcs (XS 283, M 469, L 459, XL 283, XXL 186) showed nowhere.
 * Issues now record what they took from each slip (stitching_issue_slip_skus) and a slip stays open
 * until it is fully issued (services/helpers/stitching-slip-balance.helper.ts).
 *
 * For every stitching issue with no takings recorded, this links the slips its create step closed:
 * cutting → stitching slips of the same run, RECEIVED within that create's transaction (receivedDate
 * from the issue's createdAt to +10 s — the create stamped both). Every size the issue holds must be
 * covered by those slips, and a slip may belong to one issue only; anything else is listed and
 * skipped. The takings are written oldest slip first, then a slip with pieces left opens again
 * (CREATED, receivedDate cleared) so *Incoming from Cutting* shows what is left.
 *
 *   npx ts-node --files scripts/repair-stitching-slip-allocations.ts           (dry run)
 *   npx ts-node --files scripts/repair-stitching-slip-allocations.ts --apply
 */

import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database';
import { skuKey } from '../src/services/helpers/sku-colour.helper';
import { slipSkuBalances, SLIP_TAKINGS_INCLUDE } from '../src/services/helpers/stitching-slip-balance.helper';

const APPLY = process.argv.includes('--apply');
const WINDOW_MS = 10_000;
const SNAPSHOT = path.join(__dirname, `repair-stitching-slip-allocations-snapshot-${Date.now()}.json`);

interface Taking {
  transferSlipId: string;
  colorId: string | null;
  sizeId: string;
  quantity: number;
}

async function main() {
  const issues = await prisma.stitching_issues.findMany({
    where: { slipAllocations: { none: {} } },
    include: { skuBreakdown: { include: { size: { select: { sizeName: true } } } } },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`${issues.length} stitching issue(s) with no slip takings recorded`);

  const plans: Array<{
    issueId: string;
    issueNumber: string;
    takings: Taking[];
    reopen: Array<{ slipId: string; slipNumber: string; left: Record<string, number> }>;
  }> = [];
  const claimedBy = new Map<string, string>();

  for (const issue of issues) {
    const created = issue.createdAt.getTime();
    const slips = await prisma.transfer_slips.findMany({
      where: {
        workOrderId: issue.workOrderId,
        fromStage: 'CUTTING',
        toStage: 'STITCHING',
        status: 'RECEIVED',
        receivedDate: { gte: new Date(created - 1000), lte: new Date(created + WINDOW_MS) },
      },
      include: {
        skuBreakdown: { include: { size: { select: { sizeName: true } } } },
        ...SLIP_TAKINGS_INCLUDE,
      },
      orderBy: [{ transferDate: 'asc' }, { slipNumber: 'asc' }],
    });
    if (slips.length === 0) {
      console.log(`  SKIP ${issue.issueNumber}: no slip closed by its create step`);
      continue;
    }
    const shared = slips.find((s) => claimedBy.has(s.id));
    if (shared) {
      console.log(`  SKIP ${issue.issueNumber}: slip ${shared.slipNumber} also matches ${claimedBy.get(shared.id)}`);
      continue;
    }

    const left = new Map(
      slips.map((s) => [s.id, new Map(slipSkuBalances(s).map((b) => [skuKey(b.colorId, b.sizeId), b.remaining]))])
    );
    const takings: Taking[] = [];
    let uncovered: string | null = null;
    for (const sku of issue.skuBreakdown) {
      const key = skuKey(sku.colorId, sku.sizeId);
      let need = sku.issuedQty;
      for (const slip of slips) {
        const onSlip = left.get(slip.id)!;
        const take = Math.min(onSlip.get(key) || 0, need);
        if (take <= 0) continue;
        onSlip.set(key, (onSlip.get(key) || 0) - take);
        need -= take;
        takings.push({ transferSlipId: slip.id, colorId: sku.colorId, sizeId: sku.sizeId, quantity: take });
      }
      if (need > 0) {
        uncovered = `${sku.size.sizeName}: ${need} of ${sku.issuedQty} not on the matching slips`;
        break;
      }
    }
    if (uncovered) {
      console.log(`  SKIP ${issue.issueNumber}: ${uncovered}`);
      continue;
    }

    const reopen = slips
      .map((s) => {
        const sizeName = new Map(s.skuBreakdown.map((k) => [skuKey(k.colorId, k.sizeId), k.size?.sizeName ?? k.sizeId]));
        const leftOn: Record<string, number> = {};
        for (const [key, qty] of left.get(s.id)!) if (qty > 0) leftOn[sizeName.get(key) ?? key] = qty;
        return { slipId: s.id, slipNumber: s.slipNumber, left: leftOn };
      })
      .filter((r) => Object.keys(r.left).length > 0);

    slips.forEach((s) => claimedBy.set(s.id, issue.issueNumber));
    plans.push({ issueId: issue.id, issueNumber: issue.issueNumber, takings, reopen });

    const took = takings.reduce((sum, t) => sum + t.quantity, 0);
    console.log(`  ${issue.issueNumber}: took ${took} pcs from ${slips.map((s) => s.slipNumber).join(', ')}`);
    for (const r of reopen) {
      const total = Object.values(r.left).reduce((sum, q) => sum + q, 0);
      const bySize = Object.entries(r.left)
        .map(([size, q]) => `${size} ${q}`)
        .join(', ');
      console.log(`    reopen ${r.slipNumber}: ${total} pcs left (${bySize})`);
    }
  }

  if (!APPLY) {
    console.log(`\nDry run — nothing written. ${plans.length} issue(s) would be linked. Re-run with --apply.`);
    return;
  }
  if (plans.length === 0) return;

  const slipIds = plans.flatMap((p) => p.reopen.map((r) => r.slipId));
  const before = await prisma.transfer_slips.findMany({
    where: { id: { in: [...new Set(plans.flatMap((p) => p.takings.map((t) => t.transferSlipId)))] } },
    select: { id: true, slipNumber: true, status: true, receivedDate: true, receivedById: true },
  });
  fs.writeFileSync(SNAPSHOT, JSON.stringify({ at: new Date().toISOString(), slipsBefore: before, plans }, null, 2));
  console.log(`Snapshot: ${SNAPSHOT}`);

  await prisma.$transaction(async (tx) => {
    for (const plan of plans) {
      await tx.stitching_issue_slip_skus.createMany({
        data: plan.takings.map((t) => ({ ...t, stitchingIssueId: plan.issueId })),
      });
    }
    if (slipIds.length) {
      const reopened = await tx.transfer_slips.updateMany({
        where: { id: { in: slipIds }, status: 'RECEIVED' },
        data: { status: 'CREATED', receivedDate: null, receivedById: null },
      });
      if (reopened.count !== slipIds.length) throw new Error('A slip changed while repairing — nothing written');
    }
  });
  console.log(`Applied: ${plans.length} issue(s) linked, ${slipIds.length} slip(s) reopened.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
