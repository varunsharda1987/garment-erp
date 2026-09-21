/**
 * Backfill challans left stranded by the missing job-work challan lifecycle writer.
 *
 * Until 2026-09-21 a job-work return created its INWARD challan as `DRAFT` and never moved the
 * OUTWARD challan off `ISSUED`. Both halves of the document trail stayed open forever, so
 * "OUTWARD + ISSUED" — the only cheap signal for *goods still at a vendor* — was meaningless, and
 * the Manufacturing Control Center's overdue-challan alert could not be made to work.
 *
 * The writer is fixed in `services/helpers/jwo-challan-lifecycle.helper.ts`. This script repairs the
 * rows created before that fix. RUN IT AFTER DEPLOYING THE WRITER, or new receipts keep laying down
 * stale rows behind the backfill.
 *
 * Classes:
 *   S1  INWARD + DRAFT with an ACCEPTED GRN            → RECEIVED (the goods demonstrably arrived)
 *   S2  OUTWARD open, every linked job settled         → RECEIVED, or CANCELLED if all jobs cancelled
 *   S3  OUTWARD open, no linked job at all             → REPORT ONLY, never written
 *   S4  OUTWARD open, expectedDate NULL, job knows it  → backfill expectedDate
 *
 * S3 is report-only on purpose, following the ERROR-vs-REPORT-ONLY split in
 * check-phantom-approved-costings.ts. CH2607-0001 (500 units at Manish Textiles since 2026-07-29)
 * has no job link, so nothing in the data says whether it came back. Closing it would invent a
 * receipt; it is exactly the row a human must decide on. Leaving it open is also what finally makes
 * the Control Center earn its name.
 *
 *   npx ts-node scripts/backfill-challan-lifecycle.ts           # dry-run (default)
 *   npx ts-node scripts/backfill-challan-lifecycle.ts --apply   # write
 */

import 'dotenv/config';
import { writeFileSync } from 'fs';
import { join } from 'path';
import prisma from '../src/config/database';
import { JWO_RECEIVED_STATUSES } from '../src/services/helpers/jwo-status.helper';

const APPLY = process.argv.includes('--apply');

const SETTLED = [...JWO_RECEIVED_STATUSES, 'CANCELLED', 'CLOSED'];
const OUTWARD_OPEN = ['ISSUED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'] as const;

/** Days an orphan outward challan must be open before it is worth reporting. */
const ORPHAN_REPORT_AFTER_DAYS = 14;

function days(from: Date | null): number | null {
  if (!from) return null;
  return Math.floor((Date.now() - from.getTime()) / 86_400_000);
}

function iso(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : '—';
}

type Planned = { challanNumber: string; from: string; to: string; detail: string };

async function main() {
  console.log(`=== Challan lifecycle backfill (${APPLY ? 'APPLY' : 'DRY RUN'}) ===\n`);

  const snapshot: unknown[] = [];
  const s1: Planned[] = [];
  const s2: Planned[] = [];
  const s4: Planned[] = [];

  // ── S1: INWARD challans still DRAFT whose receipt was ACCEPTED ──────────────────────────────
  const draftInward = await prisma.challans.findMany({
    where: { challanType: 'INWARD', status: 'DRAFT', grnId: { not: null } },
    select: { id: true, challanNumber: true, grnId: true, totalQuantity: true, issuedById: true },
  });

  for (const c of draftInward) {
    const grn = await prisma.goods_receiving_notes.findUnique({
      where: { id: c.grnId! },
      select: { grnNumber: true, status: true, receivingDate: true, receivedById: true },
    });
    // Only an ACCEPTED receipt proves arrival. A reversed or pending one stays DRAFT.
    if (!grn || grn.status !== 'ACCEPTED') continue;

    const when = grn.receivingDate ?? new Date();
    s1.push({
      challanNumber: c.challanNumber,
      from: 'DRAFT',
      to: 'RECEIVED',
      detail: `GRN ${grn.grnNumber} ACCEPTED ${iso(grn.receivingDate)}`,
    });
    snapshot.push({ id: c.id, challanNumber: c.challanNumber, was: { status: 'DRAFT' } });

    if (APPLY) {
      const lines = await prisma.challan_items.findMany({
        where: { challanId: c.id },
        select: { id: true, quantity: true },
      });
      await prisma.$transaction(async (tx) => {
        await tx.challans.update({
          where: { id: c.id },
          data: {
            status: 'RECEIVED',
            receivedDate: when,
            receivedById: grn.receivedById ?? c.issuedById,
            receivedQuantity: c.totalQuantity,
          },
        });
        // An arrival document whose lines claim nothing arrived is not a repaired document. Each
        // line's receivedQty mirrors its own quantity, which one updateMany cannot express.
        for (const line of lines) {
          await tx.challan_items.update({ where: { id: line.id }, data: { receivedQty: line.quantity } });
        }
      });
    }
  }

  // ── S2 / S4: open OUTWARD challans ──────────────────────────────────────────────────────────
  const openOutward = await prisma.challans.findMany({
    where: { challanType: 'OUTWARD', status: { in: [...OUTWARD_OPEN] } },
    select: {
      id: true,
      challanNumber: true,
      status: true,
      issuedDate: true,
      challanDate: true,
      expectedDate: true,
      toName: true,
      totalQuantity: true,
      unit: true,
    },
  });

  const orphans: { challanNumber: string; age: number | null; vendor: string; qty: string; unit: string }[] = [];

  for (const c of openOutward) {
    // Every job riding this challan — header FK and the per-job dispatch FK both count, because a
    // consolidated dispatch leaves the header NULL and stamps outwardChallanId on each job.
    const linked = await prisma.job_work_orders.findMany({
      where: { OR: [{ outwardChallanId: c.id }, { headerChallans: { some: { id: c.id } } }] },
      select: { jobWorkNumber: true, jwoStatus: true, receivedDate: true, expectedReturnDate: true },
    });

    if (linked.length === 0) {
      const age = days(c.issuedDate ?? c.challanDate);
      if (age != null && age >= ORPHAN_REPORT_AFTER_DAYS) {
        orphans.push({
          challanNumber: c.challanNumber,
          age,
          vendor: c.toName,
          qty: String(c.totalQuantity ?? '—'),
          unit: c.unit ?? '',
        });
      }
      continue;
    }

    // S4: the challan never recorded a due date but a job on it knows one.
    if (!c.expectedDate) {
      const due = linked
        .map((j) => j.expectedReturnDate)
        .filter((d): d is Date => d != null)
        .sort((a, b) => a.getTime() - b.getTime())[0];
      if (due) {
        s4.push({
          challanNumber: c.challanNumber,
          from: 'expectedDate NULL',
          to: `expectedDate ${iso(due)}`,
          detail: `from ${linked.length} linked job(s)`,
        });
        if (APPLY) {
          await prisma.challans.update({ where: { id: c.id }, data: { expectedDate: due } });
        }
      }
    }

    // S2: close only when EVERY job on the challan is settled.
    const unsettled = linked.filter((j) => !SETTLED.includes(j.jwoStatus as never));
    if (unsettled.length > 0) continue;

    const allCancelled = linked.every((j) => j.jwoStatus === 'CANCELLED');
    const target = allCancelled ? 'CANCELLED' : 'RECEIVED';
    const when = linked.map((j) => j.receivedDate).filter((d): d is Date => d != null).sort((a, b) => b.getTime() - a.getTime())[0];

    s2.push({
      challanNumber: c.challanNumber,
      from: c.status,
      to: target,
      detail: `${linked.map((j) => `${j.jobWorkNumber} ${j.jwoStatus}`).join(', ')}${when ? ` · received ${iso(when)}` : ''}`,
    });
    snapshot.push({ id: c.id, challanNumber: c.challanNumber, was: { status: c.status, expectedDate: c.expectedDate } });

    if (APPLY) {
      await prisma.challans.update({
        where: { id: c.id },
        data: {
          status: target,
          // Rule: never stamp receivedQuantity on an OUTWARD challan — greige went out, fabric came
          // back. Different material, often a different unit; writing it corrupts a GST document.
          ...(target === 'RECEIVED' ? { receivedDate: when ?? new Date() } : {}),
        },
      });
    }
  }

  // ── Report ──────────────────────────────────────────────────────────────────────────────────
  const show = (title: string, rows: Planned[]) => {
    console.log(`${title} — ${rows.length} row(s)`);
    for (const r of rows) console.log(`  ${r.challanNumber.padEnd(14)} ${r.from} -> ${r.to}   (${r.detail})`);
    console.log();
  };

  show('S1  INWARD DRAFT -> RECEIVED (receipt accepted)', s1);
  show('S2  OUTWARD -> closed (all linked jobs settled)', s2);
  show('S4  OUTWARD expectedDate backfilled', s4);

  console.log(`S3  ORPHAN outward challans — REPORT ONLY, nothing written — ${orphans.length} row(s)`);
  for (const o of orphans) {
    console.log(`  ${o.challanNumber.padEnd(14)} ${String(o.age).padStart(3)} days   ${o.vendor} — ${o.qty} ${o.unit}`);
  }
  if (orphans.length > 0) {
    console.log(
      '\n  These carry no job link, so the data cannot say whether the goods came back.\n' +
        '  Close each on the challan page with a remark, or cancel it if the goods never went.\n' +
        '  Until then they will (correctly) show as overdue on the Manufacturing Control Center.'
    );
  }

  const total = s1.length + s2.length + s4.length;
  console.log(`\n${'-'.repeat(50)}`);
  if (APPLY) {
    const path = join(__dirname, 'challan-lifecycle-backfill-snapshot.json');
    writeFileSync(path, JSON.stringify(snapshot, null, 2));
    console.log(`Applied ${total} change(s). Pre-state snapshot: ${path}`);
  } else {
    console.log(`Dry run — ${total} change(s) planned. Pass --apply to write.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
