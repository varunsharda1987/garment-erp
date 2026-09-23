/**
 * One-off backfill: link each received dyed/printed fabric to its style's fabric slot where the
 * job-work receipt could not (2026-09-23).
 *
 * The receipt links the slot through resolveFinishedFabricIdentity → stampStyleFabricLink. Until
 * 2026-09-23 that resolved the slot ONLY through the BOM line's selected CAD; a BOM line with none
 * (ESSKY085LS: selectedCadId NULL) left the slot unlinked, so CAD Planning's Create CAD had no slot to
 * hang the received lot on. The resolver now falls back to the greige lineage. This runs the SAME
 * resolver on the same inputs a receipt uses (jwoIdentityParams), for jobs already received.
 *
 *   npx ts-node scripts/repair-style-fabric-links.ts            (dry-run: prints the plan)
 *   npx ts-node scripts/repair-style-fabric-links.ts --apply    (snapshot, then stamp in one tx)
 *
 * Classes: STAMP (will link) · ALREADY (linked) · CONFLICT (slot claims another fabric — never
 * overwritten) · MASTER-CLAIMED (another slot already claims this fabric) · NO-ANCHOR (no single
 * slot matches the greige + colour).
 */

import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database';
import {
  JWO_GRN_INCLUDE,
  isFabricLotReprocessingJwo,
  jwoIdentityParams,
} from '../src/services/helpers/jwo-arriving-material.helper';
import { resolveFinishedFabricIdentity, stampStyleFabricLink } from '../src/services/helpers/fabric-identity.helper';

const APPLY = process.argv.includes('--apply');
const SNAPSHOT = path.join(__dirname, 'repair-style-fabric-links-snapshot.json');

type Verdict = 'STAMP' | 'ALREADY' | 'CONFLICT' | 'MASTER-CLAIMED' | 'NO-ANCHOR';

async function main() {
  const jobs = await prisma.job_work_orders.findMany({
    where: {
      finishedFabricId: { not: null },
      styleId: { not: null },
      jwoStatus: { not: 'CANCELLED' },
      OR: [{ fabricType: null }, { fabricType: { not: 'LACE' } }],
    },
    include: JWO_GRN_INCLUDE,
    orderBy: { createdAt: 'asc' },
  });

  const plan: Array<{
    jobWorkNumber: string;
    styleCode: string | null;
    fabricId: string;
    slotId: string | null;
    slotFabricBefore: string | null;
    verdict: Verdict;
  }> = [];

  for (const jwo of jobs) {
    if (isFabricLotReprocessingJwo(jwo)) continue; // keeps its source master — nothing to link
    const fabricId = jwo.finishedFabricId as string;

    const claims = await prisma.style_fabrics.findMany({
      where: { fabricId },
      select: { id: true, style_components: { select: { styleId: true } } },
    });
    const claimedInStyle = claims.find((c) => c.style_components?.styleId === jwo.styleId);
    if (claimedInStyle) {
      plan.push({
        jobWorkNumber: jwo.jobWorkNumber,
        styleCode: jwo.style?.styleCode ?? null,
        fabricId,
        slotId: claimedInStyle.id,
        slotFabricBefore: fabricId,
        verdict: 'ALREADY',
      });
      continue;
    }

    const identity = await resolveFinishedFabricIdentity(jwoIdentityParams(jwo, {}));
    const slotId = identity?.styleFabricId ?? null;
    const slot = slotId
      ? await prisma.style_fabrics.findUnique({ where: { id: slotId }, select: { fabricId: true } })
      : null;

    let verdict: Verdict;
    if (!slotId || !slot) verdict = 'NO-ANCHOR';
    else if (slot.fabricId && slot.fabricId !== fabricId) verdict = 'CONFLICT';
    else if (claims.length > 0) verdict = 'MASTER-CLAIMED';
    else verdict = 'STAMP';

    plan.push({
      jobWorkNumber: jwo.jobWorkNumber,
      styleCode: jwo.style?.styleCode ?? null,
      fabricId,
      slotId,
      slotFabricBefore: slot?.fabricId ?? null,
      verdict,
    });
  }

  console.log(`\n${jobs.length} received style job(s) with a finished fabric:\n`);
  for (const p of plan) {
    console.log(
      `  ${p.verdict.padEnd(15)} ${p.jobWorkNumber.padEnd(22)} ${(p.styleCode ?? '-').padEnd(12)} ` +
        `slot=${p.slotId ?? '—'} fabric=${p.fabricId}`
    );
  }
  const toStamp = plan.filter((p) => p.verdict === 'STAMP');
  console.log(`\n${toStamp.length} slot(s) to link.`);

  if (!APPLY) {
    console.log('Dry run. Re-run with --apply to write.');
    return;
  }
  if (toStamp.length === 0) return;

  fs.writeFileSync(SNAPSHOT, JSON.stringify({ takenAt: new Date().toISOString(), plan }, null, 2));
  console.log(`Snapshot written: ${SNAPSHOT}`);

  await prisma.$transaction(async (tx) => {
    for (const p of toStamp) {
      await stampStyleFabricLink(p.slotId, p.fabricId, tx);
    }
  });

  for (const p of toStamp) {
    const after = await prisma.style_fabrics.findUnique({ where: { id: p.slotId as string }, select: { fabricId: true } });
    console.log(`  ${after?.fabricId === p.fabricId ? 'LINKED ' : 'NOT LINKED'} ${p.jobWorkNumber} → slot ${p.slotId}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
